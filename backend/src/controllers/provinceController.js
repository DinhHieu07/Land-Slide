const pool = require('../config/db');

const listProvinces = async (req, res) => {
    try {
        const { username } = req.params;
        const userRole = req.user?.role;

        const isSuperAdmin = userRole === 'superAdmin';

        if (isSuperAdmin) {
            const sql = `SELECT id, name, code FROM provinces ORDER BY id`;
            const { rows } = await pool.query(sql);
            return res.status(200).json({ success: true, data: rows });
        }

        if (!username) {
            return res.status(200).json({ success: true, data: [] });
        }

        // Lấy provinces của user cụ thể
        const sql = `
            SELECT DISTINCT p.id, p.name, p.code 
            FROM provinces p
            INNER JOIN user_provinces up ON p.id = up.province_id
            INNER JOIN users u ON u.id = up.user_id
            WHERE u.username = $1
            ORDER BY p.id
        `;
        const { rows } = await pool.query(sql, [username]);
        return res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách tỉnh/thành:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}

module.exports = {
    listProvinces
}