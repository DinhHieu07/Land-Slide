const mqtt = require('mqtt');
const pool = require('../config/db');
const { createGatewayAlertFromLevel } = require('./createGatewayAlert');
const { insertDatasetFromGatewayPayload } = require('./insertDataset');

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

function parseGatewaySlugFromTopic(topic) {
    if (!topic || typeof topic !== 'string') return null;
    const parts = topic.split('/').filter(Boolean);
    if (parts.length < 3) return null;
    const root = parts[0].toLowerCase();
    const tail = parts[parts.length - 1].toLowerCase();
    if (root === 'landslide' && tail === 'data') {
        return parts[1] || null;
    }
    return null;
}

function resolveDeviceCodeFromMessage(topic, data) {
    const fromPayload = data.device;
    if (fromPayload !== undefined && fromPayload !== null && String(fromPayload).trim() !== '') {
        return String(fromPayload).trim();
    }
    const fromTopic = parseGatewaySlugFromTopic(topic);
    return fromTopic ? String(fromTopic).trim() : null;
}

function parseMqttTopicList(raw) {
    if (!raw || typeof raw !== 'string') return [];
    return raw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
}

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
                s.warning_threshold,
                s.danger_threshold,
                s.unit,
                n.id as node_db_id,
                n.node_id as node_code,
                d.id as device_db_id,
                d.device_id as device_code
            FROM sensors s
             JOIN nodes n ON s.node_id = n.id
             JOIN devices d ON n.device_id = d.id
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
        
        const topics = parseMqttTopicList(process.env.MQTT_TOPIC);
        if (topics.length === 0) {
            console.error('MQTT_TOPIC chưa cấu hình hoặc rỗng');
            return;
        }
        mqttClient.subscribe(topics, (err) => {
            if (err) {
                console.error('Lỗi khi subscribe topic:', err);
            } else {
                console.log(`Đã subscribe ${topics.length} topic: ${topics.join(', ')}`);
            }
        });
    });
    
    mqttClient.on('message', async (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            const deviceCode = resolveDeviceCodeFromMessage(topic, data);
            console.log(`[MQTT] topic=${topic} device=${deviceCode || '—'}`, data);

            if (!deviceCode) {
                console.warn('[MQTT] Thiếu mã Gateway');
                return;
            }

            if (!data.node) {
                console.warn('[MQTT] Dữ liệu thiếu node');
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

            const sensorCodes = ['rain', 'soil', 'tilt', 'vibration', 'alert'];
            await Promise.all(
                sensorCodes.map((sensorCode) =>
                    processSensorReading(
                        deviceCode,
                        nodeId,
                        sensorCode,
                        parseFloat(sensorDatas[sensorCode]),
                        data.timestamp || null,
                        io
                    )
                )
            );

            const datasetResult = await insertDatasetFromGatewayPayload({
                deviceCode,
                nodeId,
                rain: sensorDatas.rain,
                soil: sensorDatas.soil,
                tilt: sensorDatas.tilt,
                vibration: sensorDatas.vibration,
                alert: sensorDatas.alert,
                timestamp: data.timestamp || null,
            });

            if (datasetResult?.mlPrediction) {
                const { predictedLabel, probabilities } = datasetResult.mlPrediction;
                console.log(
                    `[ML] device=${deviceCode} node=${nodeId} -> ${predictedLabel || 'UNKNOWN'} ${
                        probabilities ? JSON.stringify(probabilities) : ''
                    }`
                );
            }

            const finalAlertLevel = Number(datasetResult?.alertDecision?.chosenLevel || 1);
            if (finalAlertLevel > 1) {
                await createGatewayAlertFromLevel(
                    deviceCode,
                    nodeId,
                    finalAlertLevel,
                    data.timestamp || null,
                    io
                );
                console.log(
                    `[ALERT_DECISION] device=${deviceCode} node=${nodeId} mqtt=${datasetResult?.alertDecision?.mqttLevel} ai=${datasetResult?.alertDecision?.aiLevel} final=${finalAlertLevel} source=${datasetResult?.alertDecision?.decisionSource}`
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

