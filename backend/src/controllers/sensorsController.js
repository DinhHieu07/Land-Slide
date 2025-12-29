const pool = require('../config/db');

// Lấy danh sách cảm biến theo device_id 
const getSensorsByDeviceId = async (req, res) => {
    try {
        const { deviceId } = req.params;

        if (!deviceId) {
            return res.status(400).json({ success: false, message: 'Thiếu deviceId' });
        }

        const sql = `
            SELECT 
                s.id,
                s.code,
                s.name,
                s.type,
                s.model,
                s.unit,
                s.min_threshold,
                s.max_threshold,
                s.created_at,
                s.updated_at
            FROM sensors s
            JOIN devices d ON d.id = s.device_id
            WHERE d.device_id = $1
            ORDER BY s.id ASC
        `;

        const { rows } = await pool.query(sql, [deviceId]);

        return res.json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error('getSensorsByDeviceId error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = {
    getSensorsByDeviceId,
};

