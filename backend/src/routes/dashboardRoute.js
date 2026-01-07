const express = require('express');
const router = express.Router();
const { getDashboardStats, getSensorStatsForDashboard, getSensorStatsByDevice } = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get('/stats', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getDashboardStats);
router.get('/sensor-stats', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getSensorStatsForDashboard);
router.get('/sensor-stats-by-device', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getSensorStatsByDevice);

module.exports = router;