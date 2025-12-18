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

module.exports = {
    listAccounts,
    getAccountById,
    createAccount,
    updateAccount,
    deleteAccount,
    resetPassword,
    changeRole
};