const express = require('express');
const router = express.Router();
const { getAlertHistory, getSensorDataHistory } = require('../controllers/historyController');
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get('/alerts', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getAlertHistory);
router.get('/sensor-data', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getSensorDataHistory);

module.exports = router;