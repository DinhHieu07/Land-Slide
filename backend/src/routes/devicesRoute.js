const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { listDevices, getDeviceById, createDevice, updateDevice, deleteDevice } = require('../controllers/devicesController');
const router = express.Router();

router.get('/', authenticateToken, roleMiddleware(['admin', 'superAdmin']), listDevices);
router.get('/:id', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getDeviceById);
router.post('/', authenticateToken, roleMiddleware(['admin', 'superAdmin']), createDevice);
router.put('/:id', authenticateToken, roleMiddleware(['admin', 'superAdmin']), updateDevice);
router.delete('/:id', authenticateToken, roleMiddleware(['admin', 'superAdmin']), deleteDevice);

module.exports = router;