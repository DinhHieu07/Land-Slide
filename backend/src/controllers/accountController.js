const pool = require('../config/db');
const bcrypt = require('bcrypt');

// Lấy danh sách tài khoản
const listAccounts = async (req, res) => {
    try {
        const { search, role, limit = 10, offset = 0 } = req.query;
        
        let whereConditions = [];
        let params = [];
        let paramCount = 0;

        // Filter theo search (username)
        if (search) {
            paramCount++;
            whereConditions.push(`username ILIKE $${paramCount}`);
            params.push(`%${search}%`);
        }

        // Filter theo role
        if (role && role !== 'all') {
            paramCount++;
            whereConditions.push(`role = $${paramCount}`);
            params.push(role);
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        // Đếm tổng số bản ghi
        const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        // Lấy danh sách với phân trang
        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const query = `
            SELECT 
                id,
                username,
                role,
                avatar,
                created_at,
                updated_at
            FROM users
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount - 1} OFFSET $${paramCount}
        `;

        const { rows } = await pool.query(query, params);

        return res.json({
            success: true,
            data: rows,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('listAccounts error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Lấy thông tin chi tiết một tài khoản
const getAccountById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT id, username, role, avatar, created_at, updated_at FROM users WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        }

        return res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('getAccountById error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Tạo tài khoản mới
const createAccount = async (req, res) => {
    try {
        const { username, password, role = 'admin' } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Thiếu tên đăng nhập hoặc mật khẩu' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        if (!['admin', 'superAdmin'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Role không hợp lệ' });
        }

        // Kiểm tra username đã tồn tại
        const checkUser = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (checkUser.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại' });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const initial = username.charAt(0).toUpperCase();
        const avatar = `https://ui-avatars.com/api/?name=${initial}&background=000&color=fff`;

        const result = await pool.query(
            'INSERT INTO users (username, password_hash, role, avatar) VALUES ($1, $2, $3, $4) RETURNING id, username, role, avatar, created_at',
            [username, passwordHash, role, avatar]
        );

        return res.status(201).json({
            success: true,
            message: 'Tạo tài khoản thành công',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('createAccount error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Cập nhật tài khoản (username, role)
const updateAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, role } = req.body;

        // Không cho phép cập nhật tài khoản của chính mình
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ success: false, message: 'Không thể cập nhật tài khoản của chính bạn' });
        }

        // Kiểm tra tài khoản có tồn tại không
        const checkAccount = await pool.query(
            'SELECT id, username FROM users WHERE id = $1',
            [id]
        );

        if (checkAccount.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        }

        const updateFields = [];
        const params = [];
        let paramCount = 0;

        if (username) {
            // Kiểm tra username đã tồn tại (trừ chính tài khoản này)
            const checkUsername = await pool.query(
                'SELECT id FROM users WHERE username = $1 AND id != $2',
                [username, id]
            );

            if (checkUsername.rows.length > 0) {
                return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại' });
            }

            paramCount++;
            updateFields.push(`username = $${paramCount}`);
            params.push(username);
        }

        if (role) {
            if (!['admin', 'superAdmin'].includes(role)) {
                return res.status(400).json({ success: false, message: 'Role không hợp lệ' });
            }
            paramCount++;
            updateFields.push(`role = $${paramCount}`);
            params.push(role);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, message: 'Không có dữ liệu để cập nhật' });
        }

        paramCount++;
        updateFields.push(`updated_at = NOW()`);
        paramCount++;
        params.push(id);

        const query = `
            UPDATE users 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCount}
            RETURNING id, username, role, avatar, created_at, updated_at
        `;

        const result = await pool.query(query, params);

        return res.json({
            success: true,
            message: 'Cập nhật tài khoản thành công',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('updateAccount error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Xóa tài khoản
const deleteAccount = async (req, res) => {
    try {
        const { id } = req.params;

        // Không cho phép xóa tài khoản của chính mình
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ success: false, message: 'Không thể xóa tài khoản của chính bạn' });
        }

        // Kiểm tra tài khoản có tồn tại không
        const checkAccount = await pool.query(
            'SELECT id FROM users WHERE id = $1',
            [id]
        );

        if (checkAccount.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [id]);

        return res.json({
            success: true,
            message: 'Xóa tài khoản thành công'
        });
    } catch (error) {
        console.error('deleteAccount error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Reset mật khẩu (chỉ superAdmin)
const resetPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
        }

        // Kiểm tra tài khoản có tồn tại không
        const checkAccount = await pool.query(
            'SELECT id FROM users WHERE id = $1',
            [id]
        );

        if (checkAccount.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        }

        // Hash password mới
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        await pool.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, id]
        );

        return res.json({
            success: true,
            message: 'Đặt lại mật khẩu thành công'
        });
    } catch (error) {
        console.error('resetPassword error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Thay đổi role
const changeRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!role || !['admin', 'superAdmin'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Role không hợp lệ' });
        }

        // Không cho phép thay đổi role của chính mình
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ success: false, message: 'Không thể thay đổi role của chính bạn' });
        }

        // Kiểm tra tài khoản có tồn tại không
        const checkAccount = await pool.query(
            'SELECT id FROM users WHERE id = $1',
            [id]
        );

        if (checkAccount.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        }

        const result = await pool.query(
            'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, role, avatar, created_at, updated_at',
            [role, id]
        );

        return res.json({
            success: true,
            message: 'Thay đổi role thành công',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('changeRole error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Lấy danh sách tỉnh thành của một account
const getAccountProvinces = async (req, res) => {
    try {
        const { id } = req.params;

        // Kiểm tra tài khoản có tồn tại không
        const checkAccount = await pool.query(
            'SELECT id, username, role FROM users WHERE id = $1',
            [id]
        );

        if (checkAccount.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        }

        const account = checkAccount.rows[0];

        // Nếu là superAdmin, trả về tất cả tỉnh thành
        if (account.role === 'superAdmin') {
            const allProvinces = await pool.query(
                'SELECT id, name, code FROM provinces ORDER BY id'
            );
            return res.json({
                success: true,
                data: allProvinces.rows,
                isSuperAdmin: true
            });
        }

        // Lấy danh sách tỉnh thành của account
        const result = await pool.query(
            `SELECT p.id, p.name, p.code 
             FROM provinces p
             INNER JOIN user_provinces up ON p.id = up.province_id
             WHERE up.user_id = $1
             ORDER BY p.id`,
            [id]
        );

        return res.json({
            success: true,
            data: result.rows,
            isSuperAdmin: false
        });
    } catch (error) {
        console.error('getAccountProvinces error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Cập nhật danh sách tỉnh thành của account (thay thế toàn bộ)
const updateAccountProvinces = async (req, res) => {
    try {
        const { id } = req.params;
        const { provinceIds } = req.body;

        // Kiểm tra tài khoản có tồn tại không
        const checkAccount = await pool.query(
            'SELECT id, username, role FROM users WHERE id = $1',
            [id]
        );

        if (checkAccount.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        }

        const account = checkAccount.rows[0];

        // SuperAdmin không cần quản lý tỉnh thành (quản lý tất cả)
        if (account.role === 'superAdmin') {
            return res.status(400).json({ 
                success: false, 
                message: 'SuperAdmin quản lý tất cả tỉnh thành, không cần cập nhật' 
            });
        }

        // Validate provinceIds
        if (!Array.isArray(provinceIds)) {
            return res.status(400).json({ success: false, message: 'provinceIds phải là mảng' });
        }

        // Kiểm tra tất cả provinceIds có tồn tại không
        if (provinceIds.length > 0) {
            const placeholders = provinceIds.map((_, index) => `$${index + 1}`).join(',');
            const checkProvinces = await pool.query(
                `SELECT id FROM provinces WHERE id IN (${placeholders})`,
                provinceIds
            );

            if (checkProvinces.rows.length !== provinceIds.length) {
                return res.status(400).json({ success: false, message: 'Một hoặc nhiều tỉnh thành không tồn tại' });
            }
        }

        // Bắt đầu transaction
        await pool.query('BEGIN');

        try {
            // Xóa tất cả tỉnh thành hiện tại của account
            await pool.query('DELETE FROM user_provinces WHERE user_id = $1', [id]);

            // Thêm các tỉnh thành mới
            if (provinceIds.length > 0) {
                const insertValues = provinceIds.map((provinceId, index) => 
                    `($${index * 2 + 1}, $${index * 2 + 2})`
                ).join(', ');
                
                const insertParams = [];
                provinceIds.forEach(provinceId => {
                    insertParams.push(id, provinceId);
                });

                await pool.query(
                    `INSERT INTO user_provinces (user_id, province_id) VALUES ${insertValues}`,
                    insertParams
                );
            }

            await pool.query('COMMIT');

            // Lấy lại danh sách tỉnh thành đã cập nhật
            const updatedProvinces = await pool.query(
                `SELECT p.id, p.name, p.code 
                 FROM provinces p
                 INNER JOIN user_provinces up ON p.id = up.province_id
                 WHERE up.user_id = $1
                 ORDER BY p.id`,
                [id]
            );

            return res.json({
                success: true,
                message: 'Cập nhật tỉnh thành thành công',
                data: updatedProvinces.rows
            });
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('updateAccountProvinces error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Thêm một tỉnh thành cho account
const addAccountProvince = async (req, res) => {
    try {
        const { id } = req.params;
        const { provinceId } = req.body;

        // Kiểm tra tài khoản có tồn tại không
        const checkAccount = await pool.query(
            'SELECT id, username, role FROM users WHERE id = $1',
            [id]
        );

        if (checkAccount.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        }

        const account = checkAccount.rows[0];

        // SuperAdmin không cần quản lý tỉnh thành
        if (account.role === 'superAdmin') {
            return res.status(400).json({ 
                success: false, 
                message: 'SuperAdmin quản lý tất cả tỉnh thành' 
            });
        }

        if (!provinceId) {
            return res.status(400).json({ success: false, message: 'Thiếu provinceId' });
        }

        // Kiểm tra tỉnh thành có tồn tại không
        const checkProvince = await pool.query(
            'SELECT id FROM provinces WHERE id = $1',
            [provinceId]
        );

        if (checkProvince.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tỉnh thành' });
        }

        // Kiểm tra đã tồn tại chưa
        const checkExists = await pool.query(
            'SELECT id FROM user_provinces WHERE user_id = $1 AND province_id = $2',
            [id, provinceId]
        );

        if (checkExists.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Tỉnh thành đã được thêm vào tài khoản này' });
        }

        // Thêm tỉnh thành
        await pool.query(
            'INSERT INTO user_provinces (user_id, province_id) VALUES ($1, $2)',
            [id, provinceId]
        );

        // Lấy thông tin tỉnh thành vừa thêm
        const province = await pool.query(
            'SELECT id, name, code FROM provinces WHERE id = $1',
            [provinceId]
        );

        return res.json({
            success: true,
            message: 'Thêm tỉnh thành thành công',
            data: province.rows[0]
        });
    } catch (error) {
        console.error('addAccountProvince error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Xóa một tỉnh thành khỏi account
const removeAccountProvince = async (req, res) => {
    try {
        const { id, provinceId } = req.params;

        // Kiểm tra tài khoản có tồn tại không
        const checkAccount = await pool.query(
            'SELECT id, username, role FROM users WHERE id = $1',
            [id]
        );

        if (checkAccount.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        }

        const account = checkAccount.rows[0];

        // SuperAdmin không cần quản lý tỉnh thành
        if (account.role === 'superAdmin') {
            return res.status(400).json({ 
                success: false, 
                message: 'SuperAdmin quản lý tất cả tỉnh thành' 
            });
        }

        // Kiểm tra tỉnh thành có trong danh sách của account không
        const checkExists = await pool.query(
            'SELECT id FROM user_provinces WHERE user_id = $1 AND province_id = $2',
            [id, provinceId]
        );

        if (checkExists.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Tỉnh thành không có trong danh sách quản lý của tài khoản này' });
        }

        // Xóa tỉnh thành
        await pool.query(
            'DELETE FROM user_provinces WHERE user_id = $1 AND province_id = $2',
            [id, provinceId]
        );

        return res.json({
            success: true,
            message: 'Xóa tỉnh thành thành công'
        });
    } catch (error) {
        console.error('removeAccountProvince error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = {
    listAccounts,
    getAccountById,
    createAccount,
    updateAccount,
    deleteAccount,
    resetPassword,
    changeRole,
    getAccountProvinces,
    updateAccountProvinces,
    addAccountProvince,
    removeAccountProvince
};