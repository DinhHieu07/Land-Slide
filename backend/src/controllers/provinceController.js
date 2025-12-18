const pool = require('../config/db');

const listProvinces = async (req, res) => {
    try {
        const sql = `SELECT id, name, code FROM provinces ORDER BY id`;
        const { rows } = await pool.query(sql);
        return res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách tỉnh/thành:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}

module.exports = {
    listProvinces
}