const pool = require('../config/db');
const { sendAlertEmail } = require('../services/emailService');

// Danh sách cảnh báo với filter và pagination
const listAlerts = async (req, res) => {
    try {
        const { 
            search = '', 
            severity, 
            status, 
            category,
            deviceId,
            username,
            limit = 10, 
            offset = 0 
        } = req.query;

        const conditions = [];
        const values = [];

        if (search) {
            values.push(`%${search}%`);
            conditions.push(`(a.title ILIKE $${values.length} OR a.message ILIKE $${values.length})`);
        }

        if (severity) {
            values.push(severity);
            conditions.push(`a.severity = $${values.length}`);
        }

        if (status) {
            values.push(status);
            conditions.push(`a.status = $${values.length}`);
        }

        if (category) {
            values.push(category);
            conditions.push(`a.category = $${values.length}`);
        }

        if (deviceId) {
            values.push(deviceId);
            conditions.push(`a.device_id = $${values.length}`);
        }

        // superAdmin có thể xem tất cả alerts
        let usernameJoin = '';
        const userRole = req.user?.role;
        const isSuperAdmin = userRole === 'superAdmin';
        
        if (username && !isSuperAdmin) {
            values.push(username);
            usernameJoin = `
                INNER JOIN user_provinces up_filter ON up_filter.province_id = d.province_id
                INNER JOIN users u_filter ON u_filter.id = up_filter.user_id AND u_filter.username = $${values.length}
            `;
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        // Đếm tổng số alerts
        const countQuery = `
            SELECT COUNT(*) as total
            FROM alerts a
            LEFT JOIN devices d ON a.device_id = d.id
            ${usernameJoin}
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, values);
        const total = parseInt(countResult.rows[0].total, 10);

        // Thêm limit/offset
        values.push(parseInt(limit) || 20);
        values.push(parseInt(offset) || 0);

        // Query chính với join devices và users
        const query = `
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
                u.username as resolved_by_username,
                s.code as sensor_code,
                s.name as sensor_name,
                s.type as sensor_type
            FROM alerts a
            LEFT JOIN devices d ON a.device_id = d.id
            LEFT JOIN provinces p ON d.province_id = p.id
            LEFT JOIN users u ON a.resolved_by = u.id
            LEFT JOIN sensors s ON a.sensor_id = s.id
            ${usernameJoin}
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT $${values.length - 1} OFFSET $${values.length}
        `;

        const result = await pool.query(query, values);

        return res.json({
            success: true,
            data: result.rows,
            pagination: {
                total,
                limit: parseInt(limit) || 20,
                offset: parseInt(offset) || 0,
                totalPages: Math.max(1, Math.ceil(total / (parseInt(limit) || 20))),
            },
        });
    } catch (error) {
        console.error('listAlerts error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Lấy chi tiết alert
const getAlertById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                a.*,
                d.device_id as device_code,
                d.name as device_name,
                d.province_id,
                p.name as province_name,
                p.code as province_code,
                u.username as resolved_by_username,
                s.code as sensor_code,
                s.name as sensor_name,
                s.type as sensor_type
            FROM alerts a
            LEFT JOIN devices d ON a.device_id = d.id
            LEFT JOIN provinces p ON d.province_id = p.id
            LEFT JOIN users u ON a.resolved_by = u.id
            LEFT JOIN sensors s ON a.sensor_id = s.id
            WHERE a.id = $1
        `;
        const result = await pool.query(query, [id]);
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cảnh báo' });
        }
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('getAlertById error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Cập nhật trạng thái alert
const updateAlertStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolved_note } = req.body;
        const username = req.user?.username;

        if (!status || !['active', 'acknowledged', 'resolved'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
        }

        // Lấy user_id từ username nếu có
        let userId = null;
        if (status === 'resolved' && username) {
            const userQuery = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
            if (userQuery.rows.length > 0) {
                userId = userQuery.rows[0].id;
            }
        }

        const updates = [];
        const values = [];

        updates.push(`status = $${values.length + 1}`);
        values.push(status);

        updates.push(`updated_at = NOW()`);
        
        if (status === 'resolved' && userId) {
            updates.push(`resolved_by = $${values.length + 1}`);
            values.push(userId);
            updates.push(`resolved_at = NOW()`);
        }

        if (resolved_note) {
            updates.push(`resolved_note = $${values.length + 1}`);
            values.push(resolved_note);
        }

        values.push(id);

        const query = `
            UPDATE alerts
            SET ${updates.join(', ')}
            WHERE id = $${values.length}
            RETURNING *
        `;

        const result = await pool.query(query, values);
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cảnh báo' });
        }

        // Emit socket event for updated alert
        const io = req.app.get('io');
        if (io) {
            io.emit('alert_updated', result.rows[0]);
        }

        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('updateAlertStatus error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Tạo alert mới (cho testing hoặc từ hệ thống)
const createAlert = async (req, res) => {
    try {
        const { 
            device_id, 
            sensor_id, 
            title, 
            message, 
            severity, 
            triggered_value, 
            category,
            evidence_data 
        } = req.body;

        if (!device_id || !title || !message || !severity || !category) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
        }

        const query = `
            INSERT INTO alerts (
                device_id, sensor_id, title, message, severity, 
                triggered_value, category, evidence_data, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
            RETURNING *
        `;
        const values = [
            device_id,
            sensor_id || null,
            title,
            message,
            severity,
            triggered_value || null,
            category,
            evidence_data ? JSON.stringify(evidence_data) : null,
        ];

        const result = await pool.query(query, values);
        const alert = result.rows[0];

        // Lấy thông tin đầy đủ của alert (device, sensor, province)
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
                s.type as sensor_type
            FROM alerts a
            LEFT JOIN devices d ON a.device_id = d.id
            LEFT JOIN provinces p ON d.province_id = p.id
            LEFT JOIN sensors s ON a.sensor_id = s.id
            WHERE a.id = $1
        `;
        const fullAlertResult = await pool.query(fullAlertQuery, [alert.id]);
        const fullAlert = fullAlertResult.rows[0] || alert;

        // Gửi email đến địa chỉ cố định
        const recipientEmail = process.env.ALERT_EMAIL_RECIPIENT || 'dinhhieu3072004@gmail.com';
        
        // Gửi email
        sendAlertEmail([recipientEmail], fullAlert).catch(error => {
            console.error('Lỗi khi gửi email cảnh báo (không ảnh hưởng đến response):', error);
        });

        // Emit socket event for new alert
        const io = req.app.get('io');
        if (io) {
            io.emit('new_alert', fullAlert);
        }

        return res.status(201).json({ success: true, data: fullAlert });
    } catch (error) {
        console.error('createAlert error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Thống kê alerts
const getAlertStats = async (req, res) => {
    try {
        const { username } = req.query;
        
        // superAdmin có thể xem tất cả alerts
        let usernameJoin = '';
        let values = [];
        const userRole = req.user?.role;
        const isSuperAdmin = userRole === 'superAdmin';
        
        if (username && !isSuperAdmin) {
            values.push(username);
            usernameJoin = `
                INNER JOIN devices d ON a.device_id = d.id
                INNER JOIN user_provinces up_filter ON up_filter.province_id = d.province_id
                INNER JOIN users u_filter ON u_filter.id = up_filter.user_id AND u_filter.username = $${values.length}
            `;
        }

        const query = `
            SELECT 
                COUNT(*) FILTER (WHERE a.status = 'active') as active_count,
                COUNT(*) FILTER (WHERE a.status = 'acknowledged') as acknowledged_count,
                COUNT(*) FILTER (WHERE a.status = 'resolved') as resolved_count,
                COUNT(*) FILTER (WHERE a.severity = 'critical') as critical_count,
                COUNT(*) FILTER (WHERE a.severity = 'warning') as warning_count,
                COUNT(*) FILTER (WHERE a.severity = 'info') as info_count,
                COUNT(*) as total_count
            FROM alerts a
            ${usernameJoin}
        `;
        const result = await pool.query(query, values);
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('getAlertStats error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = {
    listAlerts,
    getAlertById,
    updateAlertStatus,
    createAlert,
    getAlertStats,
};