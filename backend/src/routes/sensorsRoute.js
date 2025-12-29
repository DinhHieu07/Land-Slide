const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { getSensorsByDeviceId } = require('../controllers/sensorsController');

const router = express.Router();

router.get('/by-device/:deviceId', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getSensorsByDeviceId);

module.exports = router;

