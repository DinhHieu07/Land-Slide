const mqtt = require('mqtt');
const pool = require('../config/db');
const { sendAlertEmail } = require('./emailService');

// Khởi tạo MQTT client
let mqttClient = null;

// Hàm xử lý dữ liệu cảm biến từ MQTT
const processSensorReading = async (deviceId, sensorId, value, timestamp, io = null) => {
    try {
        // Tìm sensor theo device_id và code
        const sensorQuery = `
            SELECT 
                s.id,
                s.device_id as sensor_device_id,
                s.code as sensor_code,
                s.name,
                s.type,
                s.min_threshold,
                s.max_threshold,
                s.unit,
                d.id as device_db_id,
                d.device_id as device_code
            FROM sensors s
            INNER JOIN devices d ON s.device_id = d.id
            WHERE d.device_id = $1 AND s.code = $2
            LIMIT 1
        `;
        
        const sensorResult = await pool.query(sensorQuery, [deviceId, sensorId]);
        
        if (sensorResult.rows.length === 0) {
            console.warn(` Không tìm thấy sensor: device_id=${deviceId}, code=${sensorId}`);
            return;
        }
        
        const sensor = sensorResult.rows[0];
        const sensorDbId = sensor.id;
        const deviceDbId = sensor.device_db_id;
        
        // Lưu vào sensor_data_history
        const insertHistoryQuery = `
            INSERT INTO sensor_data_history (sensor_id, value, recorded_at)
            VALUES ($1, $2, COALESCE($3::timestamptz, NOW()))
            RETURNING id, sensor_id, value, recorded_at
        `;
        
        let insertResult;
        try {
            insertResult = await pool.query(insertHistoryQuery, [sensorDbId, value, timestamp || null]);
            console.log(`[DEBUG] INSERT query đã chạy, result.rows.length=${insertResult.rows?.length || 0}`);
        } catch (insertError) {
            console.error(` Lỗi khi INSERT vào sensor_data_history:`, insertError);
            console.error(`Chi tiết: sensor_id=${sensorDbId}, value=${value}, error_code=${insertError.code}, error_message=${insertError.message}`);
            throw insertError; // Re-throw để catch bên ngoài xử lý
        }
        
        if (!insertResult || !insertResult.rows || insertResult.rows.length === 0) {
            console.error(` Lỗi: INSERT không trả về id - sensor_id=${sensorDbId}, value=${value}`);
            console.error(`INSERT result:`, insertResult);
            return;
        }
        
        const historyId = insertResult.rows[0].id;
        const recordedAt = insertResult.rows[0].recorded_at;
        console.log(`✅ Đã lưu vào sensor_data_history với id=${historyId} - sensor_id=${sensorDbId}, value=${value}`);
        
        // Cập nhật devices.latest_data và last_seen
        const updateDeviceQuery = `
            UPDATE devices 
            SET 
                latest_data = jsonb_set(
                    COALESCE(latest_data, '{}'::jsonb),
                    ARRAY[$1::text],
                    to_jsonb($2::numeric),
                    true
                ),
                last_seen = COALESCE($3::timestamptz, NOW()),
                updated_at = NOW(),
                status = CASE 
                    WHEN status = 'disconnected' THEN 'online'
                    ELSE status
                END
            WHERE id = $4
        `;
        await pool.query(updateDeviceQuery, [sensor.type, value, timestamp, deviceDbId]);
        
        console.log(`Đã lưu: ${sensor.device_code} - ${sensor.name} (${sensor.sensor_code}) = ${value} ${sensor.unit || ''}`);
        
        // Emit socket event cho từng sensor reading để frontend cập nhật real-time
        if (io) {
            io.emit('sensor_data_update', {
                device_id: deviceId,
                device_db_id: deviceDbId,
                sensor_id: sensorDbId,
                sensor_code: sensor.sensor_code,
                sensor_name: sensor.name,
                sensor_type: sensor.type,
                value: value,
                unit: sensor.unit || '',
                recorded_at: recordedAt,
                timestamp: timestamp || new Date().toISOString()
            });
        }
        
        // Kiểm tra threshold và tạo alert nếu cần
        let shouldCreateAlert = false;
        let severity = 'info';
        let message = '';
        
        if (sensor.min_threshold !== null && value < sensor.min_threshold) {
            shouldCreateAlert = true;
            severity = 'warning';
            message = `${sensor.name} có giá trị ${value}${sensor.unit ? ' ' + sensor.unit : ''} thấp hơn ngưỡng tối thiểu ${sensor.min_threshold}${sensor.unit ? ' ' + sensor.unit : ''}`;
        } else if (sensor.max_threshold !== null && value > sensor.max_threshold) {
            shouldCreateAlert = true;
            // Xác định mức độ nghiêm trọng dựa trên mức vượt ngưỡng
            const thresholdDiff = value - sensor.max_threshold;
            const thresholdPercent = (thresholdDiff / sensor.max_threshold) * 100;
            
            if (thresholdPercent > 50) {
                severity = 'critical';
            } else if (thresholdPercent > 20) {
                severity = 'warning';
            } else {
                severity = 'info';
            }
            
            message = `${sensor.name} có giá trị ${value}${sensor.unit ? ' ' + sensor.unit : ''} vượt ngưỡng tối đa ${sensor.max_threshold}${sensor.unit ? ' ' + sensor.unit : ''}`;
        }
        
        if (shouldCreateAlert) {
            // Tạo alert
            const alertTitle = `Cảnh báo ${sensor.name} - ${sensor.device_code}`;
            const alertQuery = `
                INSERT INTO alerts (
                    device_id, 
                    sensor_id, 
                    title, 
                    message, 
                    severity, 
                    triggered_value, 
                    category, 
                    evidence_data, 
                    status
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
                RETURNING *
            `;
            
            const evidenceData = {
                sensor_code: sensor.sensor_code,
                sensor_name: sensor.name,
                sensor_type: sensor.type,
                value: value,
                unit: sensor.unit,
                threshold: sensor.max_threshold !== null ? sensor.max_threshold : sensor.min_threshold,
                device_code: sensor.device_code,
                timestamp: timestamp || new Date().toISOString()
            };
            
            const alertResult = await pool.query(alertQuery, [
                deviceDbId,
                sensorDbId,
                alertTitle,
                message,
                severity,
                value,
                'threshold',
                JSON.stringify(evidenceData)
            ]);
            
            const alert = alertResult.rows[0];
            
            // Lấy thông tin đầy đủ của alert để gửi email và emit socket
            const fullAlertQuery = `
                SELECT 
                    a.id,
                    a.device_id,
                    a.sensor_id,
                    a.title,
                    a.message,
                    a.severity,
                    a.triggered_value,
                    a.status,
                    a.resolved_by,
                    a.resolved_at,
                    a.resolved_note,
                    a.category,
                    a.evidence_data,
                    a.created_at,
                    a.updated_at,
                    d.device_id as device_code,
                    d.name as device_name,
                    d.province_id,
                    p.name as province_name,
                    p.code as province_code,
                    s.code as sensor_code,
                    s.name as sensor_name,
                    s.type as sensor_type,
                    u.username as resolved_by_username
                FROM alerts a
                LEFT JOIN devices d ON a.device_id = d.id
                LEFT JOIN provinces p ON d.province_id = p.id
                LEFT JOIN sensors s ON a.sensor_id = s.id
                LEFT JOIN users u ON a.resolved_by = u.id
                WHERE a.id = $1
            `;
            const fullAlertResult = await pool.query(fullAlertQuery, [alert.id]);
            const fullAlert = fullAlertResult.rows[0] || alert;
            
            // Parse evidence_data nếu là string
            if (fullAlert.evidence_data && typeof fullAlert.evidence_data === 'string') {
                try {
                    fullAlert.evidence_data = JSON.parse(fullAlert.evidence_data);
                } catch (e) {
                    // Giữ nguyên nếu không parse được
                }
            }
            
            // Gửi email cảnh báo 
            (async () => {
                try {
                    // Lấy danh sách người quản lý tỉnh thành
                    let recipientEmails = [];
                    
                    if (fullAlert.province_id) {
                        try {
                            const checkEmailColumn = await pool.query(`
                                SELECT column_name 
                                FROM information_schema.columns 
                                WHERE table_name = 'users' AND column_name = 'email'
                            `);
                            
                            const hasEmailColumn = checkEmailColumn.rows.length > 0;
                            const emailDomain = process.env.EMAIL_DOMAIN || 'landslide-monitoring.com';
                            
                            let managersQuery;
                            if (hasEmailColumn) {
                                managersQuery = `
                                    SELECT DISTINCT 
                                        u.id,
                                        u.username,
                                        u.role,
                                        COALESCE(u.email, u.username || '@' || $1::text) as email
                                    FROM users u
                                    INNER JOIN user_provinces up ON u.id = up.user_id
                                    WHERE up.province_id = $2
                                    UNION
                                    SELECT 
                                        id,
                                        username,
                                        role,
                                        COALESCE(email, username || '@' || $1::text) as email
                                    FROM users
                                    WHERE role = 'superAdmin'
                                `;
                            } else {
                                managersQuery = `
                                    SELECT DISTINCT 
                                        u.id,
                                        u.username,
                                        u.role,
                                        (u.username || '@' || $1::text) as email
                                    FROM users u
                                    INNER JOIN user_provinces up ON u.id = up.user_id
                                    WHERE up.province_id = $2
                                    UNION
                                    SELECT 
                                        id,
                                        username,
                                        role,
                                        (username || '@' || $1::text) as email
                                    FROM users
                                    WHERE role = 'superAdmin'
                                `;
                            }
                            
                            const managersResult = await pool.query(managersQuery, [emailDomain, fullAlert.province_id]);
                            
                            recipientEmails = managersResult.rows
                                .map(row => {
                                    let email = row.email;
                                    if (!email) return null;
                                    
                                    const parts = email.split('@');
                                    if (parts.length > 2) {
                                        const firstPart = parts[0];
                                        const lastPart = parts[parts.length - 1];
                                        
                                        if (lastPart === emailDomain) {
                                            email = parts.slice(0, -1).join('@');
                                        } else {
                                            email = `${firstPart}@${lastPart}`;
                                        }
                                    }
                                    
                                    if (email && email.includes('@') && email.indexOf('@') === email.lastIndexOf('@')) {
                                        return email;
                                    }
                                    return null;
                                })
                                .filter(email => email && email.includes('@'));
                            
                            console.log(`Tìm thấy ${recipientEmails.length} người quản lý cho cảnh báo`);
                        } catch (error) {
                            console.error('Lỗi khi lấy danh sách người quản lý:', error);
                        }
                    }
                    
                    if (recipientEmails.length === 0) {
                        const defaultEmail = process.env.ALERT_EMAIL_RECIPIENT;
                        if (defaultEmail) {
                            recipientEmails = [defaultEmail];
                        }
                    }
                    
                    if (recipientEmails.length > 0) {
                        await sendAlertEmail(recipientEmails, fullAlert);
                        console.log(` Đã gửi email cảnh báo tới ${recipientEmails.length} người nhận`);
                    }
                } catch (error) {
                    console.error('Lỗi khi gửi email cảnh báo:', error);
                }
            })();
            
            // Emit socket event để frontend cập nhật real-time
            if (io) {
                io.emit('new_alert', fullAlert);
                console.log(`Đã emit socket event 'new_alert' cho frontend`);
            } else {
                console.warn(` Không có io instance để emit socket event`);
            }
            
            console.log(`Đã tạo cảnh báo: ${alertTitle} - ${message}`);
        }
        
    } catch (error) {
        console.error(`Lỗi khi xử lý dữ liệu cảm biến:`, error);
    }
};

// Khởi tạo MQTT subscriber
const initMqttSubscriber = (io) => {
    if (mqttClient) {
        console.log('MQTT client đã được khởi tạo');
        return;
    }
    
    const mqttOptions = {
        host: process.env.MQTT_HOST,
        port: parseInt(process.env.MQTT_PORT),
        protocol: process.env.MQTT_PROTOCOL,
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        rejectUnauthorized: true,
    };
    
    console.log('Đang kết nối tới MQTT broker...');
    mqttClient = mqtt.connect(mqttOptions);
    
    mqttClient.on('connect', () => {
        console.log('Đã kết nối MQTT broker thành công!');
        
        const topic = process.env.MQTT_TOPIC;
        mqttClient.subscribe(topic, (err) => {
            if (err) {
                console.error('Lỗi khi subscribe topic:', err);
            } else {
                console.log(`Đã subscribe topic: ${topic}`);
            }
        });
    });
    
    mqttClient.on('message', async (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log(` Nhận dữ liệu từ MQTT:`, data);
            
            // Kiểm tra format dữ liệu
            if (!data.device_id) {
                console.warn(' Dữ liệu thiếu device_id');
                return;
            }
            
            if (!data.readings || !Array.isArray(data.readings)) {
                console.warn(' Dữ liệu thiếu readings hoặc không phải array');
                return;
            }
            
            // Xử lý từng sensor reading
            for (const reading of data.readings) {
                if (!reading.sensor_id || reading.value === undefined || reading.value === null) {
                    console.warn(` Reading không hợp lệ:`, reading);
                    continue;
                }
                
                await processSensorReading(
                    data.device_id,
                    reading.sensor_id,
                    parseFloat(reading.value),
                    data.timestamp || null,
                    io
                );
            }
        
            
        } catch (error) {
            console.error('Lỗi khi xử lý message MQTT:', error);
            console.error('Message:', message.toString());
        }
    });
    
    mqttClient.on('error', (err) => {
        console.error('Lỗi MQTT:', err);
    });
    
    mqttClient.on('close', () => {
        console.log(' MQTT connection đã đóng');
    });
    
    mqttClient.on('reconnect', () => {
        console.log(' Đang kết nối lại MQTT...');
    });
};

// Dừng MQTT subscriber
const stopMqttSubscriber = () => {
    if (mqttClient) {
        mqttClient.end();
        mqttClient = null;
        console.log(' Đã dừng MQTT subscriber');
    }
};

module.exports = {
    initMqttSubscriber,
    stopMqttSubscriber
};

