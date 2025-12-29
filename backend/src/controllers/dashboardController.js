const pool = require('../config/db');

// Lấy thống kê tổng quan hệ thống
const getDashboardStats = async (req, res) => {
    try {
        // Tổng số thiết bị và theo trạng thái
        const devicesStats = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'online') as online,
                COUNT(*) FILTER (WHERE status = 'offline') as offline,
                COUNT(*) FILTER (WHERE status = 'disconnected') as disconnected,
                COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance
            FROM devices
        `);

        // Tổng số thiết bị theo tỉnh/thành
        const devicesByProvince = await pool.query(`
            SELECT
                COALESCE(p.code, 'UNKNOWN') AS province_code,
                COALESCE(p.name, 'Không rõ') AS province_name,
                COUNT(*) as count
            FROM devices d
            LEFT JOIN provinces p ON d.province_id = p.id
            GROUP BY province_code, province_name
            ORDER BY count DESC
        `);

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

        // Tổng số cảnh báo
        const alertsStats = await pool.query(`
            SELECT COUNT(*) as total
            FROM alerts
        `);

        // Tổng số khu vực
        const areasStats = await pool.query(`
            SELECT COUNT(*) as total
            FROM areas
        `);

        // Thiết bị cập nhật gần nhất (24h)
        const recentDevices = await pool.query(`
            SELECT COUNT(*) as count
            FROM devices
            WHERE last_seen >= NOW() - INTERVAL '24 hours'
        `);

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
        const { hours = 24, interval = "hour" } = req.query;

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

        const sql = `
            SELECT
                ${dateTrunc} AS time_bucket,
                s.type AS sensor_type,
                COUNT(*) AS count,
                AVG(h.value) AS avg_value
            FROM sensor_data_history h
            JOIN sensors s ON s.id = h.sensor_id
            WHERE h.recorded_at >= NOW() - $1::interval
                AND h.recorded_at < NOW()
            GROUP BY time_bucket, s.type
            HAVING COUNT(*) > 0
            ORDER BY time_bucket ASC;
        `;

        const { rows } = await pool.query(sql, [`${hours} hours`]);

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
        const topDevicesSql = `
            SELECT d.device_id, COUNT(*) as samples
            FROM sensor_data_history h
            JOIN sensors s ON s.id = h.sensor_id
            JOIN devices d ON d.id = s.device_id
            WHERE h.recorded_at >= NOW() - $1::interval
            GROUP BY d.device_id
            ORDER BY samples DESC
            LIMIT 5;
        `;
        const topDevices = await pool.query(topDevicesSql, [`${hours} hours`]);

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

module.exports = {
    getDashboardStats,
    getSensorStatsForDashboard
};