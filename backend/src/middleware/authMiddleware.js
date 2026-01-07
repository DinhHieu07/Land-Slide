const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'my_secret_key';

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Không có token xác thực' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        // Nếu token hết hạn, thử refresh token
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token đã hết hạn',
                code: 'TOKEN_EXPIRED'
            });
        }
        return res.status(401).json({ error: 'Token không hợp lệ', code: 'INVALID_TOKEN' });
    }
};

module.exports = {
    authenticateToken,
};