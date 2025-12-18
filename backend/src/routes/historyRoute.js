const express = require('express');
const router = express.Router();
const { getAlertHistory, getSensorDataHistory, saveSensorData, getSensorDataStats } = require('../controllers/historyController');
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get('/alerts', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getAlertHistory);
router.get('/sensor-data', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getSensorDataHistory);
router.get('/sensor-data/stats', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getSensorDataStats);
router.post('/sensor-data', saveSensorData);

module.exports = router;