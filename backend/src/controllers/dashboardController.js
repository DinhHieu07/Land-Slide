const pool = require('../config/db');

// Lấy thống kê tổng quan hệ thống
const getDashboardStats = async (req, res) => {
    try {
        const { username } = req.query;
        const userRole = req.user?.role;
        const isSuperAdmin = userRole === 'superAdmin';

        // Xây dựng điều kiện lọc theo tỉnh thành
        let deviceFilter = '';
        let deviceJoin = '';
        let queryParams = [];

        if (username && !isSuperAdmin) {
            queryParams.push(username);
            deviceJoin = `
                INNER JOIN user_provinces up_filter ON up_filter.province_id = d.province_id
                INNER JOIN users u_filter ON u_filter.id = up_filter.user_id AND u_filter.username = $${queryParams.length}
            `;
        }

        // Tổng số thiết bị và theo trạng thái
        const devicesStatsQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE d.status = 'online') as online,
                COUNT(*) FILTER (WHERE d.status = 'offline') as offline,
                COUNT(*) FILTER (WHERE d.status = 'disconnected') as disconnected,
                COUNT(*) FILTER (WHERE d.status = 'maintenance') as maintenance
            FROM devices d
            ${deviceJoin}
        `;
        const devicesStats = await pool.query(devicesStatsQuery, queryParams);

        // Tổng số thiết bị theo tỉnh/thành
        const devicesByProvinceQuery = `
            SELECT
                COALESCE(p.code, 'UNKNOWN') AS province_code,
                COALESCE(p.name, 'Không rõ') AS province_name,
                COUNT(*) as count
            FROM devices d
            LEFT JOIN provinces p ON d.province_id = p.id
            ${deviceJoin}
            GROUP BY province_code, province_name
            ORDER BY count DESC
        `;
        const devicesByProvince = await pool.query(devicesByProvinceQuery, queryParams);

        // Tổng số sự kiện và theo mức độ nguy hiểm
        const eventsStats = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE severity = 1) as severity_1,
                COUNT(*) FILTER (WHERE severity = 2) as severity_2,
                COUNT(*) FILTER (WHERE severity = 3) as severity_3,
                COUNT(*) FILTER (WHERE severity = 4) as severity_4,
                COUNT(*) FILTER (WHERE severity = 5) as severity_5
            FROM landslide_events
        `);

        // Sự kiện trong 7 ngày gần nhất
        const eventsLast7Days = await pool.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM landslide_events
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        // Tổng số cảnh báo (lọc theo tỉnh thành nếu không phải superAdmin)
        let alertsStatsQuery = `SELECT COUNT(*) as total FROM alerts a`;
        let alertsJoin = '';
        let alertsParams = [];

        if (username && !isSuperAdmin) {
            alertsParams.push(username);
            alertsJoin = `
                INNER JOIN devices d_alert ON a.device_id = d_alert.id
                INNER JOIN user_provinces up_alert ON up_alert.province_id = d_alert.province_id
                INNER JOIN users u_alert ON u_alert.id = up_alert.user_id AND u_alert.username = $${alertsParams.length}
            `;
        }
        alertsStatsQuery += alertsJoin;
        const alertsStats = await pool.query(alertsStatsQuery, alertsParams);

        // Tổng số khu vực
        const areasStats = await pool.query(`
            SELECT COUNT(*) as total
            FROM areas
        `);

        // Thiết bị cập nhật gần nhất (24h)
        const recentDevicesQuery = `
            SELECT COUNT(*) as count
            FROM devices d
            ${deviceJoin}
            WHERE d.last_seen >= NOW() - INTERVAL '24 hours'
        `;
        const recentDevices = await pool.query(recentDevicesQuery, queryParams);

        // Sự kiện trong 24h gần nhất
        const recentEvents = await pool.query(`
            SELECT COUNT(*) as count
            FROM landslide_events
            WHERE created_at >= NOW() - INTERVAL '24 hours'
        `);

        return res.json({
            success: true,
            data: {
                devices: {
                    total: parseInt(devicesStats.rows[0].total),
                    online: parseInt(devicesStats.rows[0].online),
                    offline: parseInt(devicesStats.rows[0].offline),
                    disconnected: parseInt(devicesStats.rows[0].disconnected),
                    maintenance: parseInt(devicesStats.rows[0].maintenance),
                    byProvince: devicesByProvince.rows.map(r => ({
                        province_code: r.province_code,
                        province_name: r.province_name,
                        count: parseInt(r.count)
                    })),
                    recentUpdates: parseInt(recentDevices.rows[0].count)
                },
                events: {
                    total: parseInt(eventsStats.rows[0].total),
                    severity: {
                        1: parseInt(eventsStats.rows[0].severity_1),
                        2: parseInt(eventsStats.rows[0].severity_2),
                        3: parseInt(eventsStats.rows[0].severity_3),
                        4: parseInt(eventsStats.rows[0].severity_4),
                        5: parseInt(eventsStats.rows[0].severity_5)
                    },
                    last7Days: eventsLast7Days.rows.map(r => ({
                        date: r.date,
                        count: parseInt(r.count)
                    })),
                    recent: parseInt(recentEvents.rows[0].count)
                },
                alerts: {
                    total: parseInt(alertsStats.rows[0].total)
                },
                areas: {
                    total: parseInt(areasStats.rows[0].total)
                }
            }
        });
    } catch (error) {
        console.error('getDashboardStats error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Thống kê dữ liệu cảm biến theo thời gian cho dashboard (dựa trên sensor_data_history)
const getSensorStatsForDashboard = async (req, res) => {
    try {
        const { hours = 24, interval = "hour", username } = req.query;
        const userRole = req.user?.role;
        const isSuperAdmin = userRole === 'superAdmin';

        // Chỉ số hóa time bucket
        let dateTrunc;
        switch (interval) {
            case "minute":
                dateTrunc = "date_trunc('minute', recorded_at)";
                break;
            case "day":
                dateTrunc = "date_trunc('day', recorded_at)";
                break;
            case "hour":
            default:
                dateTrunc = "date_trunc('hour', recorded_at)";
        }

        // Xây dựng điều kiện lọc theo tỉnh thành
        let sensorFilter = '';
        let sensorJoin = '';
        let queryParams = [`${hours} hours`];

        if (username && !isSuperAdmin) {
            queryParams.push(username);
            sensorJoin = `
                INNER JOIN devices d_sensor ON s.device_id = d_sensor.id
                INNER JOIN user_provinces up_sensor ON up_sensor.province_id = d_sensor.province_id
                INNER JOIN users u_sensor ON u_sensor.id = up_sensor.user_id AND u_sensor.username = $${queryParams.length}
            `;
        }

        const sql = `
            SELECT
                ${dateTrunc} AS time_bucket,
                s.type AS sensor_type,
                COUNT(*) AS count,
                AVG(h.value) AS avg_value
            FROM sensor_data_history h
            JOIN sensors s ON s.id = h.sensor_id
            ${sensorJoin}
            WHERE h.recorded_at >= NOW() - $1::interval
                AND h.recorded_at < NOW()
            GROUP BY time_bucket, s.type
            HAVING COUNT(*) > 0
            ORDER BY time_bucket ASC;
        `;

        const { rows } = await pool.query(sql, queryParams);

        // Chuẩn hóa kết quả theo sensor_type
        const data = {};
        rows.forEach((r) => {
            const bucket = r.time_bucket;
            const type = r.sensor_type;
            if (!data[type]) data[type] = [];
            data[type].push({
                time: bucket,
                count: parseInt(r.count),
                avg_value: r.avg_value !== null ? Number(r.avg_value) : null,
            });
        });

        // Top thiết bị cập nhật nhiều nhất trong khoảng thời gian
        let topDevicesJoin = '';
        if (username && !isSuperAdmin) {
            topDevicesJoin = `
                INNER JOIN user_provinces up_top ON up_top.province_id = d.province_id
                INNER JOIN users u_top ON u_top.id = up_top.user_id AND u_top.username = $${queryParams.length}
            `;
        }

        const topDevicesSql = `
            SELECT d.device_id, COUNT(*) as samples
            FROM sensor_data_history h
            JOIN sensors s ON s.id = h.sensor_id
            JOIN devices d ON d.id = s.device_id
            ${topDevicesJoin}
            WHERE h.recorded_at >= NOW() - $1::interval
            GROUP BY d.device_id
            ORDER BY samples DESC
            LIMIT 5;
        `;
        const topDevices = await pool.query(topDevicesSql, queryParams);

        return res.json({
            success: true,
            data,
            topDevices: topDevices.rows.map((r) => ({
                device_id: r.device_id,
                samples: parseInt(r.samples),
            })),
        });
    } catch (error) {
        console.error("getSensorStatsForDashboard error:", error);
        return res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// Thống kê dữ liệu cảm biến theo thiết bị cụ thể
const getSensorStatsByDevice = async (req, res) => {
    try {
        const { device_id, hours = 24, interval = "hour" } = req.query;
        const { username } = req.query;
        const userRole = req.user?.role;
        const isSuperAdmin = userRole === 'superAdmin';

        if (!device_id) {
            return res.status(400).json({ success: false, message: 'Thiếu device_id' });
        }

        // Chỉ số hóa time bucket
        let dateTrunc;
        switch (interval) {
            case "minute":
                dateTrunc = "date_trunc('minute', recorded_at)";
                break;
            case "day":
                dateTrunc = "date_trunc('day', recorded_at)";
                break;
            case "hour":
            default:
                dateTrunc = "date_trunc('hour', recorded_at)";
        }

        // Xây dựng điều kiện lọc theo tỉnh thành và device_id
        let deviceFilter = '';
        let queryParams = [`${hours} hours`, device_id];

        // Kiểm tra quyền truy cập thiết bị (nếu không phải superAdmin)
        if (!isSuperAdmin) {
            if (username) {
                queryParams.push(username);
                deviceFilter = `
                    AND EXISTS (
                        SELECT 1 FROM devices d_check
                        INNER JOIN user_provinces up_check ON up_check.province_id = d_check.province_id
                        INNER JOIN users u_check ON u_check.id = up_check.user_id AND u_check.username = $${queryParams.length}
                        WHERE d_check.device_id = $2
                    )
                `;
            } else {
                return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
            }
        }

        const sql = `
            SELECT
                ${dateTrunc} AS time_bucket,
                s.type AS sensor_type,
                s.code AS sensor_code,
                s.name AS sensor_name,
                COUNT(*) AS count,
                AVG(h.value) AS avg_value,
                MIN(h.value) AS min_value,
                MAX(h.value) AS max_value
            FROM sensor_data_history h
            JOIN sensors s ON s.id = h.sensor_id
            JOIN devices d ON d.id = s.device_id
            WHERE d.device_id = $2
                AND h.recorded_at >= NOW() - $1::interval
                AND h.recorded_at < NOW()
                ${deviceFilter}
            GROUP BY time_bucket, s.type, s.code, s.name
            HAVING COUNT(*) > 0
            ORDER BY time_bucket ASC, s.type ASC;
        `;

        const { rows } = await pool.query(sql, queryParams);

        // Chuẩn hóa kết quả theo sensor_code (mỗi cảm biến riêng biệt)
        const data = {};
        rows.forEach((r) => {
            const bucket = r.time_bucket;
            const sensorKey = `${r.sensor_code}_${r.sensor_type}`; // Key duy nhất cho mỗi cảm biến
            if (!data[sensorKey]) {
                data[sensorKey] = {
                    sensor_code: r.sensor_code,
                    sensor_name: r.sensor_name || r.sensor_code,
                    sensor_type: r.sensor_type,
                    data: []
                };
            }
            data[sensorKey].data.push({
                time: bucket,
                count: parseInt(r.count),
                avg_value: r.avg_value !== null ? Number(r.avg_value) : null,
                min_value: r.min_value !== null ? Number(r.min_value) : null,
                max_value: r.max_value !== null ? Number(r.max_value) : null,
            });
        });

        // Lấy thông tin thiết bị
        const deviceInfoQuery = `
            SELECT d.device_id, d.name, d.status, d.last_seen, d.province_id, p.name AS province_name
            FROM devices d
            LEFT JOIN provinces p ON d.province_id = p.id
            WHERE d.device_id = $1
        `;
        const deviceInfo = await pool.query(deviceInfoQuery, [device_id]);

        return res.json({
            success: true,
            device: deviceInfo.rows[0] || null,
            sensors: Object.values(data),
        });
    } catch (error) {
        console.error("getSensorStatsByDevice error:", error);
        return res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

module.exports = {
    getDashboardStats,
    getSensorStatsForDashboard,
    getSensorStatsByDevice
};