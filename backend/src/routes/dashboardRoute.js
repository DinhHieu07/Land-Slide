const express = require('express');
const router = express.Router();
const { getDashboardStats, getSensorStatsForDashboard } = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get('/stats', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getDashboardStats);
router.get('/sensor-stats', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getSensorStatsForDashboard);

module.exports = router;