const mqtt = require('mqtt');
const pool = require('../config/db');
const { sendAlertEmail } = require('./emailService');

// Khởi tạo MQTT client
let mqttClient = null;

const TYPE_TO_CODE_SUFFIX = {
    rainfall_24h: 'RAIN',
    soil_moisture: 'SOIL',
    vibration_g: 'VIB',
    tilt_deg: 'TILT',
    slope_deg: 'SLOPE',
    rain: 'RAIN',
    soil: 'SOIL',
    vibration: 'VIB',
    tilt: 'TILT',
    alert: 'ALERT',
};

function buildSensorLookupKey(sensorCode, value) {
    if (value === undefined || value === null || Number.isNaN(Number(value))) {
        return null;
    }
    if (!sensorCode) {
        return null;
    }

    const normalized = String(sensorCode).trim().toLowerCase();
    return TYPE_TO_CODE_SUFFIX[normalized] || normalized.toUpperCase();
}

async function tryUpdateNodeState(deviceCode, nodeId, sensorType, sensorUnit, value, timestamp) {
    if (!nodeId) return;
    try {
        const typeKey = String(sensorType || 'unknown').trim();
        const unitKey = String(sensorUnit || '').trim();
        const latestDataKey = `${typeKey} (${unitKey})`;
        await pool.query(
            `
            UPDATE nodes n
            SET
                last_seen = COALESCE($3::timestamptz, NOW()),
                updated_at = NOW(),
                latest_data = jsonb_set(
                    COALESCE(n.latest_data, '{}'::jsonb),
                    ARRAY[$4::text],
                    to_jsonb($5::numeric),
                    true
                ),
                status = CASE
                    WHEN n.status = 'disconnected' THEN 'online'
                    ELSE n.status
                END
            FROM devices d
            WHERE n.device_id = d.id
              AND d.device_id = $1
              AND n.node_id = $2
            `,
            [deviceCode, nodeId, timestamp || null, latestDataKey, value]
        );
    } catch (e) {
        if (e.code === '42P01' || e.code === '42703') {
            return;
        }
        console.warn('[MQTT] tryUpdateNodeState:', e.message);
    }
}

async function createGatewayAlertFromLevel(deviceId, nodeId, alertLevel, timestamp, io = null) {
    const level = Number(alertLevel);
    if (!Number.isFinite(level) || level <= 1) {
        return;
    }

    const severity = level == 3 ? 'critical' : 'warning';
    const levelLabel = level == 3 ? 'Nguy hiểm' : 'Cảnh báo';
    const alertTitle = `Cảnh báo Gateway ${deviceId}${nodeId ? ` - Node ${nodeId}` : ''}`;
    const message = `Gateway gửi mức ${levelLabel} (level=${level})`;

    const deviceResult = await pool.query(
        `
        SELECT
            d.id as device_db_id,
            d.device_id as device_code,
            d.name as device_name,
            d.province_id
        FROM devices d
        WHERE d.device_id = $1
        LIMIT 1
        `,
        [deviceId]
    );

    if (deviceResult.rows.length === 0) {
        console.warn(` Không tìm thấy device cho alert: ${deviceId}`);
        return;
    }

    const device = deviceResult.rows[0];
    let nodeLatestData = null;
    if (nodeId) {
        try {
            const nodeResult = await pool.query(
                `
                SELECT n.latest_data
                FROM nodes n
                WHERE n.device_id = $1 AND n.node_id = $2
                LIMIT 1
                `,
                [device.device_db_id, nodeId]
            );
            nodeLatestData = nodeResult.rows[0]?.latest_data || null;
        } catch (error) {
            console.warn(`[MQTT] Không lấy được latest_data của node ${nodeId}:`, error.message);
        }
    }

    const evidenceData = {
        source: 'gateway',
        node_id: nodeId || undefined,
        alert_level: level,
        node_latest_data: nodeLatestData,
        timestamp: timestamp || new Date().toISOString(),
    };

    const alertResult = await pool.query(
        `
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
        VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, 'active')
        RETURNING *
        `,
        [
            device.device_db_id,
            alertTitle,
            message,
            severity,
            level,
            'threshold',
            JSON.stringify(evidenceData),
        ]
    );

    const alert = alertResult.rows[0];
    const fullAlertResult = await pool.query(
        `
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
        `,
        [alert.id]
    );
    const fullAlert = fullAlertResult.rows[0] || alert;

    if (fullAlert.evidence_data && typeof fullAlert.evidence_data === 'string') {
        try {
            fullAlert.evidence_data = JSON.parse(fullAlert.evidence_data);
        } catch (e) {
            // giữ nguyên nếu parse không được
        }
    }

    void notifyAlertByEmail(fullAlert);

    if (io) {
        io.emit('new_alert', fullAlert);
    }
}

function buildManagersEmailQuery() {
    return `
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

async function getRecipientEmailsByProvince(provinceId) {
    if (!provinceId) {
        return [];
    }

    const emailDomain = process.env.EMAIL_DOMAIN || 'https://land-slide.vercel.app';
    const managersQuery = buildManagersEmailQuery();
    const managersResult = await pool.query(managersQuery, [emailDomain, provinceId]);

    return managersResult.rows
        .map((row) => row.email)
        .filter((email) => email && email.includes('@') && email.indexOf('@') === email.lastIndexOf('@'));
}

async function notifyAlertByEmail(fullAlert) {
    try {
        let recipientEmails = [];
        try {
            recipientEmails = await getRecipientEmailsByProvince(fullAlert.province_id);
        } catch (error) {
            console.error('Loi khi lay danh sach nguoi quan ly:', error);
        }

        if (recipientEmails.length === 0 && process.env.ALERT_EMAIL_RECIPIENT) {
            recipientEmails = [process.env.ALERT_EMAIL_RECIPIENT];
        }

        if (recipientEmails.length > 0) {
            // await sendAlertEmail(recipientEmails, fullAlert);
        }
    } catch (error) {
        console.error('Loi gui email canh bao:', error);
    }
}

// Hàm xử lý dữ liệu cảm biến từ MQTT
const processSensorReading = async (deviceId, nodeId, sensorCode, value, timestamp, io = null) => {
    try {
        const normalizedSensorCode = buildSensorLookupKey(sensorCode, value);
        if (!normalizedSensorCode) {
            console.warn(` Sensor không hợp lệ: device=${deviceId}, node=${nodeId}, code=${sensorCode}, value=${value}`);
            return;
        }

        if (normalizedSensorCode === 'ALERT') {
            await createGatewayAlertFromLevel(deviceId, nodeId, value, timestamp, io);
            return;
        }

        // Tìm sensor theo device_id + node_id + (sensor_code hoặc sensor_type)
        const sensorQuery = `
            SELECT 
                s.id,
                s.node_id as sensor_node_id,
                s.code as sensor_code,
                s.name,
                s.type,
                s.min_threshold,
                s.max_threshold,
                s.unit,
                n.id as node_db_id,
                n.node_id as node_code,
                d.id as device_db_id,
                d.device_id as device_code
            FROM sensors s
            INNER JOIN nodes n ON s.node_id = n.id
            INNER JOIN devices d ON n.device_id = d.id
            WHERE d.device_id = $1
              AND n.node_id = $2
              AND (
                    UPPER(s.code) = UPPER($3)
                    OR UPPER(s.type) = UPPER($3)
                    OR UPPER(s.type) = UPPER($4)
              )
            ORDER BY CASE WHEN UPPER(s.code) = UPPER($3) THEN 0 ELSE 1 END
            LIMIT 1
        `;

        const typeAlias = String(sensorCode || '').trim();
        const sensorResult = await pool.query(sensorQuery, [deviceId, nodeId, normalizedSensorCode, typeAlias]);
        
        if (sensorResult.rows.length === 0) {
            console.warn(` Không tìm thấy sensor: device_id=${deviceId}, node_id=${nodeId}, code=${sensorCode}`);
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
            throw insertError;
        }
        
        if (!insertResult || !insertResult.rows || insertResult.rows.length === 0) {
            console.error(` Lỗi: INSERT không trả về id - sensor_id=${sensorDbId}, value=${value}`);
            console.error(`INSERT result:`, insertResult);
            return;
        }
        
        const historyId = insertResult.rows[0].id;
        const recordedAt = insertResult.rows[0].recorded_at;
        console.log(`Đã lưu vào sensor_data_history với id=${historyId} - sensor_id=${sensorDbId}, value=${value}`);
        
        // Cập nhật devices.latest_data và last_seen (gộp theo node để không đè giữa nhiều node)
        const updateDeviceQuery = `
            UPDATE devices 
            SET 
                latest_data = COALESCE(latest_data, '{}'::jsonb) || jsonb_build_object($1::text, $2::numeric),
                last_seen = COALESCE($3::timestamptz, NOW()),
                updated_at = NOW(),
                status = CASE 
                    WHEN status = 'disconnected' THEN 'online'
                    ELSE status
                END
            WHERE id = $4
        `;

        const nodeLatestKey = String(nodeId || 'unknown');
        const sensorTypeKey = String(sensor.type || sensor.sensor_code || 'unknown').trim();
        const sensorUnit = String(sensor.unit || '').trim();
        const latestDataKey = `${nodeLatestKey}_${sensorTypeKey} (${sensorUnit})`;
        const deviceUpdateResult = await pool.query(updateDeviceQuery, [latestDataKey, value, timestamp, deviceDbId]);
        if (deviceUpdateResult.rowCount === 0) {
            console.warn(` Không cập nhật được devices.latest_data: device_id=${deviceId}, device_db_id=${deviceDbId}`);
        }

        await tryUpdateNodeState(deviceId, nodeId, sensor.type, sensor.unit, value, timestamp);
        
        console.log(`Đã lưu: ${sensor.device_code} - ${sensor.name} (${sensor.sensor_code}) = ${value} ${sensor.unit || ''}`);
        
        // Emit socket event cho từng sensor reading để frontend cập nhật real-time
        if (io) {
            io.emit('sensor_data_update', {
                device_id: deviceId,
                node_id: nodeId || undefined,
                node_db_id: sensor.node_db_id,
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
            if (!data.device) {
                console.warn(' Dữ liệu thiếu device_id');
                return;
            }

            if (!data.node) {
                console.warn(' Dữ liệu thiếu node');
                return;
            }
            
            const nodeId = data.node;

            const sensorDatas = {
                rain: data.rain,
                soil: data.soil,
                tilt: data.tilt,
                vibration: data.vibration,
                alert: data.alert
            };

            //Xử lý từng sensor 
            await Promise.all([
                ['rain', 'soil', 'tilt', 'vibration', 'alert'].map(sensorCode => processSensorReading(data.device, nodeId, sensorCode, parseFloat(sensorDatas[sensorCode]), data.timestamp || null, io))
            ]);
        
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

