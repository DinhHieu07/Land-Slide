const pool = require('../config/db');
const redisClient = require('../config/redis');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const register = async (req, res) => {
    try {
        const { username, password, role = 'user' } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Thiếu tên đăng nhập hoặc mật khẩu' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        const checkUser = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (checkUser.rows.length > 0) {
            return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const initial = username.charAt(0).toUpperCase();
        const avatar = `https://ui-avatars.com/api/?name=${initial}&background=000&color=fff`;

        const result = await pool.query(
            'INSERT INTO users (username, password_hash, role, avatar) VALUES ($1, $2, $3, $4) RETURNING id, username, role, created_at, avatar',
            [username, passwordHash, role, avatar]
        );

        const user = result.rows[0];

        return res.status(201).json({
            message: 'Đăng ký thành công. Vui lòng đăng nhập để tiếp tục.',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    avatar: user.avatar,
                },
            },
        });
    } catch (error) {
        console.error('Lỗi khi đăng ký:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
};

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Thiếu tên đăng nhập hoặc mật khẩu' });
        }

        const result = await pool.query(
            'SELECT id, username, password_hash, role, avatar FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
        }

        const user = result.rows[0];

        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
        }

        // Tạo access token (30 phút)
        const accessToken = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '30m' }
        );

        // Tạo refresh token (7 ngày)
        const refreshToken = jwt.sign(
            { id: user.id, type: 'refresh' },
            JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        // Lưu refresh token vào Redis
        await redisClient.setRefreshToken(user.id, refreshToken);

        // Set refresh token vào httpOnly cookie
        const cookieOptions = {
            httpOnly: true, // Không cho JavaScript truy cập
            secure: process.env.NODE_ENV === 'production', // Chỉ gửi qua HTTPS trong production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Bảo vệ khỏi CSRF
            maxAge: 7 * 24 * 60 * 60 * 1000, 
            path: '/', // Cookie có hiệu lực cho toàn bộ site
        };

        res.cookie('refreshToken', refreshToken, cookieOptions);

        return res.status(200).json({
            message: 'Đăng nhập thành công',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    avatar: user.avatar,
                },
                accessToken,
            },
        });
    } catch (error) {
        console.error('Lỗi khi đăng nhập:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
};

// api refresh token
const refreshToken = async (req, res) => {
    try {
        // Lấy refresh token từ cookie
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token không được để trống' });
        }

        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        } catch (err) {
            return res.status(403).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' });
        }

        const storedToken = await redisClient.getRefreshToken(decoded.id);
        
        if (!storedToken || storedToken !== refreshToken) {
            return res.status(403).json({ error: 'Refresh token không tồn tại hoặc không hợp lệ' });
        }

        const userResult = await pool.query(
            'SELECT id, username, role FROM users WHERE id = $1',
            [decoded.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        }

        const user = userResult.rows[0];

        // Tạo access token mới
        const newAccessToken = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '30m' }
        );

        return res.status(200).json({
            message: 'Token đã được làm mới',
            data: {
                accessToken: newAccessToken,
            },
        });
    } catch (error) {
        console.error('Lỗi khi refresh token:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
};

const logout = async (req, res) => {
    try {
        const userId = req.user.id;
        const storedToken = await redisClient.getRefreshToken(userId);
        if (!storedToken) {
            return res.status(400).json({ error: 'Refresh token không tồn tại' });
        }
        await redisClient.deleteRefreshToken(userId);

        // Xóa cookie
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/',
        });

        return res.status(200).json({
            message: 'Đăng xuất thành công',
        });
    } catch (error) {
        console.error('Lỗi khi đăng xuất:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
};

// Lấy thông tin user hiện tại
const getCurrentUser = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            'SELECT id, username, role, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        }

        return res.status(200).json({
            message: 'Success',
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Lỗi khi lấy thông tin user:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
};

// Đổi mật khẩu 
const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Thiếu mật khẩu hiện tại hoặc mật khẩu mới' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
        }

        const result = await pool.query(
            'SELECT id, password_hash FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        }

        const user = result.rows[0];

        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng' });
        }

        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        await pool.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [newPasswordHash, userId]
        );

        return res.status(200).json({
            message: 'Đổi mật khẩu thành công',
        });
    } catch (error) {
        console.error('Lỗi khi đổi mật khẩu:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
};

module.exports = {
    register,
    login,
    refreshToken,
    logout,
    getCurrentUser,
    changePassword,
};