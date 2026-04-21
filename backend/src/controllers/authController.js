const pool = require('../config/db');
const redisClient = require('../config/redis');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendOtpEmail } = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const register = async (req, res) => {
    try {
        const { username, password, role = 'user' } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Thiếu tên đăng nhập (Email) hoặc mật khẩu' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        const checkUser = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (checkUser.rows.length > 0) {
            return res.status(400).json({ error: 'Tên đăng nhập (Email) đã tồn tại' });
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
            return res.status(400).json({ error: 'Thiếu tên đăng nhập (Email) hoặc mật khẩu' });
        }

        const result = await pool.query(
            'SELECT id, username, password_hash, role, avatar FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Tên đăng nhập (Email) hoặc mật khẩu không đúng' });
        }

        const user = result.rows[0];

        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Tên đăng nhập (Email) hoặc mật khẩu không đúng' });
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

function generateOtp6Digits() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function findUserByEmailOrUsername(identifier) {
    const input = String(identifier || '').trim();
    if (!input) return null;

    try {
        const withEmail = await pool.query(
            'SELECT id, username FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
            [input]
        );
        return withEmail.rows[0] || null;
    } catch (error) {
        console.error('Lỗi tìm kiếm người dùng:', error);
        return null;
    }
}

const requestResetPasswordOtp = async (req, res) => {
    try {
        const { email } = req.body;
        const input = String(email || '').trim();
        if (!input) {
            return res.status(400).json({ error: 'Thiếu email' });
        }

        const user = await findUserByEmailOrUsername(input);
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        }

        const otp = generateOtp6Digits();
        const payload = JSON.stringify({ otp, userId: user.id });
        await redisClient.setPasswordResetOtp(input, payload, 60);

        const emailToSend = String(input).trim();
        const sent = await sendOtpEmail(emailToSend, otp);
        if (!sent.success) {
            return res.status(500).json({ error: sent.message || 'Không gửi được OTP' });
        }

        return res.status(200).json({
            message: 'Đã gửi OTP, mã có hiệu lực trong 1 phút',
        });
    } catch (error) {
        console.error('Lỗi request OTP quên mật khẩu:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
};

const resetPasswordWithOtp = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const input = String(email || '').trim();
        const otpInput = String(otp || '').trim();

        if (!input || !otpInput || !newPassword) {
            return res.status(400).json({ error: 'Thiếu email, OTP hoặc mật khẩu mới' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
        }

        const rawOtp = await redisClient.getPasswordResetOtp(input);
        if (!rawOtp) {
            return res.status(400).json({ error: 'OTP không hợp lệ hoặc đã hết hạn' });
        }

        const parsed = JSON.parse(rawOtp);
        if (String(parsed.otp) !== otpInput) {
            return res.status(400).json({ error: 'OTP không đúng' });
        }

        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, parsed.userId]);

        await redisClient.deletePasswordResetOtp(input);
        await redisClient.deleteRefreshToken(parsed.userId);

        return res.status(200).json({ message: 'Đặt lại mật khẩu thành công' });
    } catch (error) {
        console.error('Lỗi reset mật khẩu bằng OTP:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
};

const getMyProvinceRequest = async (req, res) => {
    try {
        const userId = req.user.id;

        const pending = await pool.query(
            `SELECT
                upr.id,
                upr.status,
                upr.created_at,
                p.id AS province_id,
                p.name AS province_name,
                p.code AS province_code
             FROM user_province_requests upr
             JOIN provinces p ON p.id = upr.province_id
             WHERE upr.user_id = $1
             ORDER BY upr.created_at DESC
             LIMIT 1`,
            [userId]
        );

        const approved = await pool.query(
            `SELECT p.id AS province_id, p.name AS province_name, p.code AS province_code
             FROM user_provinces up
             JOIN provinces p ON p.id = up.province_id
             WHERE up.user_id = $1
             ORDER BY p.id
             LIMIT 1`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            data: {
                latestRequest: pending.rows[0] || null,
                approvedProvince: approved.rows[0] || null,
            },
        });
    } catch (error) {
        console.error('Lỗi khi lấy yêu cầu tỉnh thành của user:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

const submitMyProvinceRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const { provinceId } = req.body;

        if (!provinceId) {
            return res.status(400).json({ success: false, message: 'Thiếu provinceId' });
        }

        const provinceCheck = await pool.query('SELECT id FROM provinces WHERE id = $1', [provinceId]);
        if (provinceCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tỉnh thành' });
        }

        await pool.query('BEGIN');
        try {
            await pool.query(
                `UPDATE user_province_requests
                 SET status = 'replaced',
                     updated_at = NOW()
                 WHERE user_id = $1 AND status = 'pending'`,
                [userId]
            );

            await pool.query(
                `INSERT INTO user_province_requests (user_id, province_id, status)
                 VALUES ($1, $2, 'pending')`,
                [userId, provinceId]
            );

            await pool.query('COMMIT');
        } catch (err) {
            await pool.query('ROLLBACK');
            throw err;
        }

        return res.status(200).json({
            success: true,
            message: 'Đã gửi yêu cầu cập nhật tỉnh thành. Vui lòng chờ admin duyệt.',
        });
    } catch (error) {
        console.error('Lỗi khi gửi yêu cầu tỉnh thành:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

const submitProvinceRequestByUsername = async (req, res) => {
    try {
        const { username, provinceId } = req.body;

        const normalizedUsername = String(username || '').trim();
        if (!normalizedUsername || !provinceId) {
            return res.status(400).json({ success: false, message: 'Thiếu tên đăng nhập (Email) hoặc provinceId' });
        }

        const userResult = await pool.query(
            'SELECT id, role FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
            [normalizedUsername]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        }
        if (userResult.rows[0].role !== 'user') {
            return res.status(400).json({ success: false, message: 'Tài khoản này không áp dụng luồng tỉnh thành cho user' });
        }

        const userId = userResult.rows[0].id;
        const provinceCheck = await pool.query('SELECT id FROM provinces WHERE id = $1', [provinceId]);
        if (provinceCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tỉnh thành' });
        }

        await pool.query(
            `UPDATE user_province_requests
             SET status = 'replaced',
                 updated_at = NOW()
             WHERE user_id = $1 AND status = 'pending'`,
            [userId]
        );

        await pool.query(
            `INSERT INTO user_province_requests (user_id, province_id, status)
             VALUES ($1, $2, 'pending')`,
            [userId, provinceId]
        );

        return res.status(200).json({
            success: true,
            message: 'Đã gửi yêu cầu chọn tỉnh thành. Vui lòng chờ admin duyệt.',
        });
    } catch (error) {
        console.error('Lỗi khi gửi yêu cầu tỉnh thành theo username:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = {
    register,
    login,
    refreshToken,
    logout,
    getCurrentUser,
    changePassword,
    requestResetPasswordOtp,
    resetPasswordWithOtp,
    getMyProvinceRequest,
    submitMyProvinceRequest,
    submitProvinceRequestByUsername,
};