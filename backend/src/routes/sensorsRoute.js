const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { getSensorsByDeviceId, getSensorsByNodeId, updateSensorThreshold } = require('../controllers/sensorsController');

const router = express.Router();

router.get('/by-device/:deviceId', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getSensorsByDeviceId);
router.get('/by-node/:nodeId', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getSensorsByNodeId);
router.put('/:id/threshold', authenticateToken, roleMiddleware(['admin', 'superAdmin']), updateSensorThreshold);

module.exports = router;

