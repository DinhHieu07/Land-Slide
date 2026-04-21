const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getCurrentUser);
router.post('/change-password', authenticateToken, changePassword);
router.post('/forgot-password/request-otp', requestResetPasswordOtp);
router.post('/forgot-password/reset', resetPasswordWithOtp);
router.get('/my-province-request', authenticateToken, getMyProvinceRequest);
router.put('/my-province-request', authenticateToken, submitMyProvinceRequest);
router.post('/province-request-by-username', submitProvinceRequestByUsername);

module.exports = router;