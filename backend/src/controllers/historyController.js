const pool = require('../config/db');

// Lấy lịch sử cảnh báo với filter
const getAlertHistory = async (req, res) => {
    try {
        const {
            start_date,
            end_date,
            alert_level,
            event_id,
            q,
            limit = 10,
            offset = 0,
        } = req.query;

        const conditions = [];
        const values = [];
        let paramCount = 0;

        if (start_date) {
            paramCount++;
            values.push(start_date);
            conditions.push(`a.created_at >= $${paramCount}`);
        }

        if (end_date) {
            paramCount++;
            values.push(end_date);
            conditions.push(`a.created_at <= $${paramCount}`);
        }

        if (alert_level) {
            paramCount++;
            values.push(alert_level);
            conditions.push(`a.alert_level = $${paramCount}`);
        }

        if (event_id) {
            paramCount++;
            values.push(event_id);
            conditions.push(`a.event_id = $${paramCount}`);
        }

        if (q) {
            paramCount++;
            values.push(`%${q}%`);
            conditions.push(`(a.message ILIKE $${paramCount} OR e.name ILIKE $${paramCount})`);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        
        paramCount++;
        values.push(parseInt(limit) || 10);
        paramCount++;
        values.push(parseInt(offset) || 0);

        // Lấy tổng số để pagination
        const countQuery = `SELECT COUNT(*) as total FROM alerts a LEFT JOIN landslide_events e ON a.event_id = e.id ${whereClause}`;
        const countResult = await pool.query(countQuery, values.slice(0, -2));
        const total = parseInt(countResult.rows[0].total);

        // Lấy dữ liệu
        const query = `
            SELECT 
                a.id,
                a.event_id,
                a.alert_level,
                a.message,
                a.created_at,
                e.name as event_name,
                e.severity as event_severity
            FROM alerts a
            LEFT JOIN landslide_events e ON a.event_id = e.id
            ${whereClause}
            ORDER BY id DESC
            LIMIT $${paramCount - 1} OFFSET $${paramCount}
        `;

        const result = await pool.query(query, values);

        return res.json({
            success: true,
            data: result.rows,
            pagination: {
                total,
                limit: parseInt(limit) || 10,
                offset: parseInt(offset) || 0,
                totalPages: Math.ceil(total / (parseInt(limit) || 100))
            }
        });
    } catch (error) {
        console.error('getAlertHistory error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Lấy lịch sử dữ liệu cảm biến với filter
const getSensorDataHistory = async (req, res) => {
    try {
        const {
            device_id,
            sensor_type,
            start_date,
            end_date,
            q,
            limit = 10,
            offset = 0,
        } = req.query;

        const conditions = [];
        const values = [];
        let paramCount = 0;

        if (device_id) {
            paramCount++;
            values.push(device_id);
            conditions.push(`s.device_id = $${paramCount}`);
        }

        if (sensor_type) {
            paramCount++;
            values.push(sensor_type);
            conditions.push(`s.sensor_type = $${paramCount}`);
        }

        if (start_date) {
            paramCount++;
            values.push(start_date);
            conditions.push(`s.recorded_at >= $${paramCount}`);
        }

        if (end_date) {
            paramCount++;
            values.push(end_date);
            conditions.push(`s.recorded_at <= $${paramCount}`);
        }

        if (q) {
            paramCount++;
            values.push(`%${q}%`);
            conditions.push(`(s.device_id ILIKE $${paramCount} OR d.name ILIKE $${paramCount})`);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        
        paramCount++;
        values.push(parseInt(limit) || 10);
        paramCount++;
        values.push(parseInt(offset) || 0);

        // Lấy tổng số
        const countQuery = `SELECT COUNT(*) as total FROM sensor_data_history s LEFT JOIN devices d ON s.device_id = d.device_id ${whereClause}`;
        const countResult = await pool.query(countQuery, values.slice(0, -2));
        const total = parseInt(countResult.rows[0].total);

        // Lấy dữ liệu với thông tin thiết bị
        const query = `
            SELECT 
                s.id,
                s.device_id,
                d.name as device_name,
                s.sensor_type,
                s.data,
                s.recorded_at,
                s.created_at
            FROM sensor_data_history s
            LEFT JOIN devices d ON s.device_id = d.device_id
            ${whereClause}
            ORDER BY s.recorded_at DESC
            LIMIT $${paramCount - 1} OFFSET $${paramCount}
        `;

        const result = await pool.query(query, values);

        return res.json({
            success: true,
            data: result.rows,
            pagination: {
                total,
                limit: parseInt(limit) || 10,
                offset: parseInt(offset) || 0,
                totalPages: Math.ceil(total / (parseInt(limit) || 100))
            }
        });
    } catch (error) {
        console.error('getSensorDataHistory error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Lưu dữ liệu cảm biến mới (cho IoT devices gửi dữ liệu)
const saveSensorData = async (req, res) => {
    try {
        const { device_id, sensor_type, data } = req.body;

        // Kiểm tra thiết bị tồn tại
        const deviceCheck = await pool.query(
            'SELECT id FROM devices WHERE device_id = $1',
            [device_id]
        );

        if (deviceCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thiết bị' });
        }

        // Lưu lịch sử
        const insertQuery = `
            INSERT INTO sensor_data_history (device_id, sensor_type, data, recorded_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id
        `;
        const insertResult = await pool.query(insertQuery, [device_id, sensor_type, JSON.stringify(data)]);

        // Cập nhật latest_data và last_seen của thiết bị
        const updateQuery = `
            UPDATE devices 
            SET latest_data = $1, last_seen = NOW(), updated_at = NOW()
            WHERE device_id = $2
        `;
        await pool.query(updateQuery, [JSON.stringify(data), device_id]);

        return res.json({
            success: true,
            data: { id: insertResult.rows[0].id }
        });
    } catch (error) {
        console.error('saveSensorData error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Lấy thống kê dữ liệu cảm biến theo thời gian (cho biểu đồ)
const getSensorDataStats = async (req, res) => {
    try {
        const { device_id, sensor_type, start_date, end_date, interval = 'hour' } = req.query;

        const conditions = [];
        const values = [];
        let paramCount = 0;

        if (device_id) {
            paramCount++;
            values.push(device_id);
            conditions.push(`device_id = $${paramCount}`);
        }

        if (sensor_type) {
            paramCount++;
            values.push(sensor_type);
            conditions.push(`sensor_type = $${paramCount}`);
        }

        if (start_date) {
            paramCount++;
            values.push(start_date);
            conditions.push(`recorded_at >= $${paramCount}`);
        } else {
            // Mặc định 7 ngày gần nhất
            paramCount++;
            values.push(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
            conditions.push(`recorded_at >= $${paramCount}`);
        }

        if (end_date) {
            paramCount++;
            values.push(end_date);
            conditions.push(`recorded_at <= $${paramCount}`);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        
        let dateTrunc;
        switch (interval) {
            case 'minute':
                dateTrunc = "date_trunc('minute', recorded_at)";
                break;
            case 'hour':
                dateTrunc = "date_trunc('hour', recorded_at)";
                break;
            case 'day':
                dateTrunc = "date_trunc('day', recorded_at)";
                break;
            default:
                dateTrunc = "date_trunc('hour', recorded_at)";
        }

        const query = `
            SELECT 
                ${dateTrunc} as time_bucket,
                COUNT(*) as count,
                AVG((data->>'value')::numeric) as avg_value,
                MIN((data->>'value')::numeric) as min_value,
                MAX((data->>'value')::numeric) as max_value
            FROM sensor_data_history
            ${whereClause}
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
        `;

        const result = await pool.query(query, values);

        return res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('getSensorDataStats error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = {
    getAlertHistory,
    getSensorDataHistory,
    saveSensorData,
    getSensorDataStats
};