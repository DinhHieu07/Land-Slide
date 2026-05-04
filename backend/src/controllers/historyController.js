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
        const isSuperAdmin = req.user?.role === 'superAdmin';
        const requesterUsername = req.user?.username;

        let permissionJoin = '';
        if (!isSuperAdmin) {
            if (!requesterUsername) {
                return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
            }
            paramCount++;
            values.push(requesterUsername);
            permissionJoin = `
                 JOIN user_provinces up_filter ON up_filter.province_id = d.province_id
                 JOIN users u_filter ON u_filter.id = up_filter.user_id AND u_filter.username = $${paramCount}
            `;
        }

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
        const countQuery = `
            SELECT COUNT(*) as total
            FROM alerts a
            LEFT JOIN landslide_events e ON a.event_id = e.id
            LEFT JOIN devices d ON a.device_id = d.id
            ${permissionJoin}
            ${whereClause}
        `;
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
            LEFT JOIN devices d ON a.device_id = d.id
            ${permissionJoin}
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
        const isSuperAdmin = req.user?.role === 'superAdmin';
        const requesterUsername = req.user?.username;

        let permissionJoin = '';
        if (!isSuperAdmin) {
            if (!requesterUsername) {
                return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
            }
            paramCount++;
            values.push(requesterUsername);
            permissionJoin = `
                 JOIN user_provinces up_filter ON up_filter.province_id = d.province_id
                 JOIN users u_filter ON u_filter.id = up_filter.user_id AND u_filter.username = $${paramCount}
            `;
        }

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
            JOIN nodes n ON n.id = s.node_id
            JOIN devices d ON d.id = n.device_id
            ${permissionJoin}
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, values.slice(0, -2));
        const total = parseInt(countResult.rows[0].total);

        // Lấy dữ liệu với thông tin thiết bị và cảm biến
        const query = `
            SELECT 
                h.id,
                n.node_id,
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
            JOIN nodes n ON n.id = s.node_id
            JOIN devices d ON d.id = n.device_id
            ${permissionJoin}
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

module.exports = {
    getAlertHistory,
    getSensorDataHistory
};