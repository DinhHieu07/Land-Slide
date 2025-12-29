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
            conditions.push(`d.device_id = $${paramCount}`);
        }

        if (sensor_type) {
            paramCount++;
            values.push(sensor_type);
            conditions.push(`s.type = $${paramCount}`);
        }

        if (start_date) {
            paramCount++;
            values.push(start_date);
            conditions.push(`h.recorded_at >= $${paramCount}`);
        }

        if (end_date) {
            paramCount++;
            values.push(end_date);
            conditions.push(`h.recorded_at <= $${paramCount}`);
        }

        if (q) {
            paramCount++;
            values.push(`%${q}%`);
            conditions.push(`(d.device_id ILIKE $${paramCount} OR d.name ILIKE $${paramCount})`);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        
        paramCount++;
        values.push(parseInt(limit) || 10);
        paramCount++;
        values.push(parseInt(offset) || 0);

        // Lấy tổng số
        const countQuery = `
            SELECT COUNT(*) as total
            FROM sensor_data_history h
            JOIN sensors s ON s.id = h.sensor_id
            JOIN devices d ON d.id = s.device_id
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, values.slice(0, -2));
        const total = parseInt(countResult.rows[0].total);

        // Lấy dữ liệu với thông tin thiết bị và cảm biến
        const query = `
            SELECT 
                h.id,
                d.device_id,
                d.name as device_name,
                s.type as sensor_type,
                s.code,
                s.name as sensor_name,
                h.value,
                h.recorded_at,
                h.created_at
            FROM sensor_data_history h
            JOIN sensors s ON s.id = h.sensor_id
            JOIN devices d ON d.id = s.device_id
            ${whereClause}
            ORDER BY h.recorded_at DESC
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
        const { code, value } = req.body;

        // Kiểm tra sensor tồn tại và lấy device
        const sensorCheck = await pool.query(
            'SELECT id, device_id, type FROM sensors WHERE code = $1 LIMIT 1',
            [code]
        );

        if (sensorCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cảm biến' });
        }

        const sensorRow = sensorCheck.rows[0];

        // Lưu lịch sử
        const insertQuery = `
            INSERT INTO sensor_data_history (sensor_id, value, recorded_at)
            VALUES ($1, $2, NOW())
            RETURNING id
        `;
        const insertResult = await pool.query(insertQuery, [sensorRow.id, value]);

        // Cập nhật latest_data và last_seen của thiết bị (lưu key theo loại cảm biến)
        const updateQuery = `
            UPDATE devices 
            SET latest_data = jsonb_set(
                    COALESCE(latest_data, '{}'::jsonb),
                    ARRAY[$1],
                    to_jsonb($2::numeric),
                    true
                ),
                last_seen = NOW(),
                updated_at = NOW()
            WHERE id = $3
        `;
        await pool.query(updateQuery, [sensorRow.type, value, sensorRow.device_id]);

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
            conditions.push(`d.device_id = $${paramCount}`);
        }

        if (sensor_type) {
            paramCount++;
            values.push(sensor_type);
            conditions.push(`s.type = $${paramCount}`);
        }

        if (start_date) {
            paramCount++;
            values.push(start_date);
            conditions.push(`h.recorded_at >= $${paramCount}`);
        } else {
            // Mặc định 7 ngày gần nhất
            paramCount++;
            values.push(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
            conditions.push(`h.recorded_at >= $${paramCount}`);
        }

        if (end_date) {
            paramCount++;
            values.push(end_date);
            conditions.push(`h.recorded_at <= $${paramCount}`);
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
                s.type as sensor_type,
                COUNT(*) as count,
                AVG(value) as avg_value,
                MIN(value) as min_value,
                MAX(value) as max_value
            FROM sensor_data_history h
            JOIN sensors s ON s.id = h.sensor_id
            JOIN devices d ON d.id = s.device_id
            ${whereClause}
            GROUP BY time_bucket, s.type
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