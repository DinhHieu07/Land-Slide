const cron = require('node-cron');
const pool = require('../config/db');
const { sendAlertEmail } = require('./emailService');

let io = null;
let monitorInterval = null;

const checkOfflineDevices = async (timeoutMinutes = 5, createAlert = true) => {
    try {
        const timeoutInterval = `${timeoutMinutes} minutes`;
        
        // Tìm các thiết bị có last_seen quá timeout và status không phải 'offline' hoặc 'disconnected'
        const query = `
            SELECT 
                d.id,
                d.device_id,
                d.name,
                d.status,
                d.last_seen,
                d.province_id,
                p.name as province_name,
                p.code as province_code
            FROM devices d
            LEFT JOIN provinces p ON d.province_id = p.id
            WHERE 
                d.last_seen < NOW() - INTERVAL '${timeoutInterval}'
                AND d.status NOT IN ('offline', 'disconnected', 'maintenance')
            ORDER BY d.last_seen ASC
        `;

        const result = await pool.query(query);
        const offlineDevices = result.rows;

        if (offlineDevices.length === 0) {
            console.log(`[DeviceMonitor] Không có thiết bị nào cần cập nhật trạng thái`);
            return;
        }

        console.log(`[DeviceMonitor] Tìm thấy ${offlineDevices.length} thiết bị cần chuyển sang offline`);

        // Cập nhật trạng thái và tạo alert cho từng thiết bị
        for (const device of offlineDevices) {
            try {
                // Cập nhật trạng thái sang 'offline'
                const updateQuery = `
                    UPDATE devices 
                    SET status = 'disconnected', updated_at = NOW()
                    WHERE id = $1
                    RETURNING id, device_id, name, status, last_seen
                `;
                const updateResult = await pool.query(updateQuery, [device.id]);
                
                if (updateResult.rows.length > 0) {
                    console.log(`[DeviceMonitor] ✅ Đã chuyển thiết bị ${device.device_id} (${device.name}) sang offline`);
                    
                    // Tạo alert nếu được bật
                    if (createAlert) {
                        await createOfflineAlert(device);
                    }

                    // Emit socket event để frontend cập nhật real-time
                    if (io) {
                        io.emit('device_status_updated', {
                            device_id: device.device_id,
                            status: 'disconnected',
                            last_seen: device.last_seen,
                            updated_at: new Date().toISOString()
                        });
                    }
                }
            } catch (error) {
                console.error(`[DeviceMonitor] ❌ Lỗi khi cập nhật thiết bị ${device.device_id}:`, error);
            }
        }
    } catch (error) {
        console.error('[DeviceMonitor] ❌ Lỗi khi kiểm tra thiết bị offline:', error);
    }
};

/**
 * Tạo alert cho thiết bị offline
 */
const createOfflineAlert = async (device) => {
    try {
        const alertTitle = `Thiết bị ${device.device_id} mất kết nối`;
        const lastSeenDate = device.last_seen ? new Date(device.last_seen) : new Date();
        const minutesAgo = Math.floor((new Date() - lastSeenDate) / (1000 * 60));
        const alertMessage = `Thiết bị ${device.name || device.device_id} không gửi dữ liệu trong ${minutesAgo} phút. Lần cuối nhận dữ liệu: ${lastSeenDate.toLocaleString('vi-VN')}`;

        const alertQuery = `
            INSERT INTO alerts (
                device_id, sensor_id, title, message, severity, 
                triggered_value, category, evidence_data, status
            )
            VALUES ($1, NULL, $2, $3, $4, NULL, $5, $6, 'active')
            RETURNING *
        `;

        const evidenceData = {
            device_code: device.device_id,
            device_name: device.name,
            last_seen: device.last_seen,
            province_id: device.province_id,
            province_name: device.province_name,
            province_code: device.province_code,
            timestamp: new Date().toISOString()
        };

        const alertResult = await pool.query(alertQuery, [
            device.id,
            alertTitle,
            alertMessage,
            'warning',
            'system',
            JSON.stringify(evidenceData)
        ]);

        const alert = alertResult.rows[0];

        // Lấy thông tin đầy đủ của alert
        const fullAlertQuery = `
            SELECT 
                a.id, a.device_id, a.sensor_id, a.title, a.message, a.severity, a.triggered_value, a.status,
                a.resolved_by, a.resolved_at, a.resolved_note, a.category, a.evidence_data, a.created_at, a.updated_at,
                d.device_id as device_code, d.name as device_name, d.province_id, p.name as province_name, p.code as province_code,
                u.username as resolved_by_username, s.code as sensor_code, s.name as sensor_name, s.type as sensor_type
            FROM alerts a
            LEFT JOIN devices d ON a.device_id = d.id
            LEFT JOIN provinces p ON d.province_id = p.id
            LEFT JOIN users u ON a.resolved_by = u.id
            LEFT JOIN sensors s ON a.sensor_id = s.id
            WHERE a.id = $1
        `;
        const fullAlertResult = await pool.query(fullAlertQuery, [alert.id]);
        const fullAlert = fullAlertResult.rows[0] || alert;

        if (fullAlert.evidence_data && typeof fullAlert.evidence_data === 'string') {
            try {
                fullAlert.evidence_data = JSON.parse(fullAlert.evidence_data);
            } catch (e) {
                
            }
        }

        // Gửi email cảnh báo
        let recipientEmails = [];
        if (fullAlert.province_id) {
            try {
                const emailDomain = process.env.EMAIL_DOMAIN || 'landslide-monitoring.com';
                const managersQuery = `
                    SELECT DISTINCT 
                        u.id, u.username, u.role,
                        CASE 
                            WHEN u.email IS NOT NULL AND u.email LIKE '%@%' THEN u.email
                            ELSE u.username || '@' || $1::text
                        END as email
                    FROM users u
                    INNER JOIN user_provinces up ON u.id = up.user_id
                    WHERE up.province_id = $2
                    UNION
                    SELECT 
                        id, username, role,
                        CASE 
                            WHEN email IS NOT NULL AND email LIKE '%@%' THEN email
                            ELSE username || '@' || $1::text
                        END as email
                    FROM users
                    WHERE role = 'superAdmin'
                `;
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
            } catch (error) {
                console.error('[DeviceMonitor] Lỗi khi lấy danh sách người quản lý:', error);
            }
        }

        if (recipientEmails.length === 0) {
            const defaultEmail = process.env.ALERT_EMAIL_RECIPIENT;
            if (defaultEmail) {
                recipientEmails = [defaultEmail];
            }
        }

        if (recipientEmails.length > 0) {
            sendAlertEmail(recipientEmails, fullAlert).catch(error => {
                console.error('[DeviceMonitor] Lỗi khi gửi email cảnh báo:', error);
            });
        }

        // Emit socket event
        if (io) {
            io.emit('new_alert', fullAlert);
        }

        console.log(`[DeviceMonitor] ✅ Đã tạo alert cho thiết bị ${device.device_id}`);
    } catch (error) {
        console.error('[DeviceMonitor] ❌ Lỗi khi tạo alert:', error);
    }
};

const startDeviceMonitor = (socketIO, schedule = '*/1 * * * *', timeoutMinutes = 5, createAlert = true) => {
    if (monitorInterval) {
        console.log('[DeviceMonitor] Cronjob đã được khởi động');
        return;
    }

    io = socketIO;

    // Chạy ngay lần đầu
    checkOfflineDevices(timeoutMinutes, createAlert);

    // Thiết lập cronjob
    monitorInterval = cron.schedule(schedule, () => {
        checkOfflineDevices(timeoutMinutes, createAlert);
    }, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh"
    });

    console.log(`[DeviceMonitor] ✅ Đã khởi động cronjob kiểm tra thiết bị offline`);
    console.log(`[DeviceMonitor] - Schedule: ${schedule} (mỗi 5 phút)`);
    console.log(`[DeviceMonitor] - Timeout: ${timeoutMinutes} phút`);
    console.log(`[DeviceMonitor] - Tạo alert: ${createAlert ? 'Có' : 'Không'}`);
};

const stopDeviceMonitor = () => {
    if (monitorInterval) {
        monitorInterval.stop();
        monitorInterval = null;
        console.log('[DeviceMonitor] Đã dừng cronjob');
    }
};

module.exports = {
    startDeviceMonitor,
    stopDeviceMonitor,
    checkOfflineDevices
};

