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

// Cập nhật ngưỡng cảm biến
const updateSensorThreshold = async (req, res) => {
    try {
        const { id } = req.params;
        const { min_threshold, max_threshold } = req.body;

        // Validation: nếu cả 2 đều có thì min phải < max
        if (min_threshold !== null && min_threshold !== undefined && 
            max_threshold !== null && max_threshold !== undefined) {
            if (min_threshold >= max_threshold) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Ngưỡng tối thiểu phải nhỏ hơn ngưỡng tối đa' 
                });
            }
        }

        // Kiểm tra sensor có tồn tại không
        const checkSensor = await pool.query('SELECT id FROM sensors WHERE id = $1', [id]);
        if (checkSensor.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cảm biến' });
        }

        // Cập nhật ngưỡng
        const updateQuery = `
            UPDATE sensors 
            SET 
                min_threshold = $1,
                max_threshold = $2,
                updated_at = NOW()
            WHERE id = $3
            RETURNING id, code, name, type, unit, min_threshold, max_threshold, updated_at
        `;

        const result = await pool.query(updateQuery, [
            min_threshold !== null && min_threshold !== undefined ? min_threshold : null,
            max_threshold !== null && max_threshold !== undefined ? max_threshold : null,
            id
        ]);

        return res.json({
            success: true,
            message: 'Đã cập nhật ngưỡng cảm biến thành công',
            data: result.rows[0],
        });
    } catch (error) {
        console.error('updateSensorThreshold error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = {
    getSensorsByDeviceId,
    updateSensorThreshold,
};

