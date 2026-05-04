const pool = require('../config/db');
const { sendAlertEmail } = require('../services/emailService');
const { getAlertRecipientEmailsByProvince } = require('../services/alertRecipientsService');

function getHeatmapWeight(row) {
    const alertLevel = Number(row.alert_level || 0);
    const severity = String(row.severity || '').toLowerCase();
    const category = String(row.category || '').toLowerCase();
    const text = `${row.title || ''} ${row.message || ''}`.toLowerCase();

    if (alertLevel >= 3) return 1.0;
    if (alertLevel >= 2) return 0.75;
    if (alertLevel >= 1) return 0.5;

    if (severity === 'critical') return 1.0;
    if (severity === 'warning') return 0.75;
    if (severity === 'info') return 0.5;

    if (category.includes('connect') || text.includes('mất kết nối') || text.includes('mat ket noi')) {
        return 0.8;
    }

    return 0.45;
}

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
            start_date,
            end_date,
            limit = 10, 
            offset = 0 
        } = req.query;

        const conditions = [];
        const values = [];

        if (start_date) {
            values.push(start_date);
            conditions.push(`a.created_at >= $${values.length}`);
        }

        if (end_date) {
            values.push(end_date);
            conditions.push(`a.created_at <= ($${values.length}::timestamp + interval '23 hours 59 minutes 59 seconds')`);
        }

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
                 JOIN user_provinces up_filter ON up_filter.province_id = d.province_id
                 JOIN users u_filter ON u_filter.id = up_filter.user_id AND u_filter.username = $${values.length}
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
            ORDER BY 
                CASE a.status 
                    WHEN 'active' THEN 1 
                    WHEN 'acknowledged' THEN 2 
                    WHEN 'resolved' THEN 3 
                    ELSE 4 
                END ASC,
                CASE a.severity 
                    WHEN 'critical' THEN 1 
                    WHEN 'warning' THEN 2 
                    WHEN 'info' THEN 3 
                    ELSE 4 
                END ASC,
                a.created_at DESC
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

        // Lấy danh sách người quản lý tỉnh thành chứa thiết bị có cảnh báo
        let recipientEmails = [];
        
        if (fullAlert.province_id) {
            try {
                recipientEmails = await getAlertRecipientEmailsByProvince(fullAlert.province_id);
                console.log(
                    `Tìm thấy ${recipientEmails.length} người nhận cho tỉnh thành ID ${fullAlert.province_id}:`,
                    recipientEmails
                );
            } catch (error) {
                console.error('Lỗi khi lấy danh sách người nhận:', error);
            }
        }
        
        // Nếu không có người quản lý, gửi đến email mặc định
        if (recipientEmails.length === 0) {
            const defaultEmail = process.env.ALERT_EMAIL_RECIPIENT || 'dinhhieu3072004@gmail.com';
            recipientEmails = [defaultEmail];
            console.log('Không tìm thấy người quản lý, gửi đến email mặc định:', defaultEmail);
        }
        
        // Gửi email
        sendAlertEmail(recipientEmails, fullAlert).catch(error => {
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
                 JOIN devices d ON a.device_id = d.id
                 JOIN user_provinces up_filter ON up_filter.province_id = d.province_id
                 JOIN users u_filter ON u_filter.id = up_filter.user_id AND u_filter.username = $${values.length}
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

const getEvidenceData = async (req, res) => {
    try {
        const query = `SELECT evidence_data FROM alerts `;
        const result = await pool.query(query);
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('getEvidenceData error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

/** Điểm nhiệt theo cảnh báo active (bản đồ) */
const getAlertHeatmap = async (req, res) => {
    try {
        const { username, hours = '24', type = 'all' } = req.query;
        const h = Math.min(168, Math.max(1, parseInt(String(hours), 10) || 24));
        const userRole = req.user?.role;
        const isSuperAdmin = userRole === 'superAdmin';

        const params = [`${h} hours`];
        const where = [
            "a.status = 'active'",
            "a.created_at >= NOW() - $1::interval",
        ];

        let permissionJoin = '';
        if (!isSuperAdmin) {
            if (!username) {
                return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
            }
            params.push(username);
            permissionJoin = `
                JOIN user_provinces up_filter ON up_filter.province_id = d.province_id
                JOIN users u_filter ON u_filter.id = up_filter.user_id AND u_filter.username = $${params.length}
            `;
        }

        if (type === 'threshold') {
            where.push("COALESCE(a.evidence_data->>'node_id', '') <> ''");
        } else if (type === 'disconnect') {
            where.push(
                "(LOWER(COALESCE(a.message,'')) LIKE '%mất kết nối%' OR LOWER(COALESCE(a.title,'')) LIKE '%mất kết nối%' OR LOWER(COALESCE(a.category,'')) LIKE '%connect%')"
            );
        }

        const sql = `
            SELECT
                a.id,
                a.severity,
                a.category,
                a.title,
                a.message,
                a.created_at,
                d.device_id AS device_code,
                d.name AS device_name,
                COALESCE(a.evidence_data->>'node_id', '') AS node_id,
                COALESCE(a.evidence_data->>'alert_level', '') AS alert_level,
                n.lat AS node_lat,
                n.lon AS node_lon,
                d.lat AS device_lat,
                d.lon AS device_lon
            FROM alerts a
            JOIN devices d ON d.id = a.device_id
            LEFT JOIN nodes n
                ON n.device_id = d.id
               AND UPPER(TRIM(n.node_id)) = UPPER(TRIM(COALESCE(a.evidence_data->>'node_id', '')))
            ${permissionJoin}
            WHERE ${where.join(' AND ')}
        `;

        const { rows } = await pool.query(sql, params);

        /** Mức cao nhất theo từng Gateway (mọi cảnh báo của GW + Node thuộc GW) — đồng bộ màu Node vs GW */
        const deviceMaxLevel = new Map();
        for (const r of rows) {
            const code = r.device_code;
            const w = getHeatmapWeight(r);
            const lv = w >= 0.95 ? 3 : w >= 0.7 ? 2 : 1;
            deviceMaxLevel.set(code, Math.max(deviceMaxLevel.get(code) || 0, lv));
        }

        const pointMap = new Map();

        for (const r of rows) {
            const lat = r.node_lat ?? r.device_lat;
            const lon = r.node_lon ?? r.device_lon;
            if (lat === null || lon === null) continue;

            const weight = getHeatmapWeight(r);
            const level = weight >= 0.95 ? 3 : weight >= 0.7 ? 2 : 1;
            const key = `${Number(lat).toFixed(6)}_${Number(lon).toFixed(6)}`;
            const cur = pointMap.get(key);

            if (!cur) {
                pointMap.set(key, {
                    lat: Number(lat),
                    lon: Number(lon),
                    weight,
                    count: 1,
                    max_level: level,
                    latest_at: r.created_at,
                    device_code: r.device_code,
                    node_id: r.node_id || null,
                    alert_types: [r.category || 'unknown'],
                });
            } else {
                cur.weight += weight;
                cur.count += 1;
                cur.max_level = Math.max(cur.max_level, level);
                if (new Date(r.created_at).getTime() > new Date(cur.latest_at).getTime()) {
                    cur.latest_at = r.created_at;
                    cur.device_code = r.device_code;
                    cur.node_id = r.node_id || null;
                }
                const cat = r.category || 'unknown';
                if (!cur.alert_types.includes(cat)) cur.alert_types.push(cat);
            }
        }

        let points = Array.from(pointMap.values()).map((p) => ({
            ...p,
            max_level: Math.max(p.max_level, deviceMaxLevel.get(p.device_code) || 0),
            weight: Math.min(3, Number(p.weight.toFixed(2))),
        }));

        /** Cùng một Gateway: mọi điểm (GW + các Node) dùng chung một mức = max trên toàn hệ */
        const unifiedByDevice = new Map();
        for (const p of points) {
            const code = p.device_code;
            if (!code) continue;
            unifiedByDevice.set(code, Math.max(unifiedByDevice.get(code) || 0, p.max_level));
        }
        points = points.map((p) => ({
            ...p,
            max_level: p.device_code ? unifiedByDevice.get(p.device_code) ?? p.max_level : p.max_level,
        }));

        return res.json({
            success: true,
            window_hours: h,
            points,
        });
    } catch (error) {
        console.error('getAlertHeatmap error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = {
    listAlerts,
    getAlertById,
    updateAlertStatus,
    createAlert,
    getAlertStats,
    getEvidenceData,
    getAlertHeatmap,
};