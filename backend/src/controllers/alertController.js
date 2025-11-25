const pool = require('../config/db');

const listAlerts = async (req, res) => {
    try {
        const sql = `SELECT *
                    FROM alerts
                    ORDER BY created_at DESC
                    LIMIT 200
                    `
        const { rows } = await pool.query(sql);
        return res.status(200).json({ message: 'Success', data: rows });
    }
    catch (error) {
        console.error('Lỗi khi lấy danh sách cảnh báo:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
}

const createAlert = async (req, res) => {
    try {
        const { event_id, alert_level, message } = req.body;
        if (!event_id || !alert_level || !message) {
            return res.status(400).json({ error: 'Thiếu dữ liệu' });
        }
        const sql = `INSERT INTO alerts (event_id, alert_level, message) VALUES ($1, $2, $3) RETURNING id`;
        const { rows } = await pool.query(sql, [event_id, alert_level, message]);
        return res.status(200).json({ message: 'Success', data: rows[0].id });
    } catch (error) {
        console.error('Lỗi khi tạo cảnh báo:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
}

module.exports = {
    listAlerts,
    createAlert
}