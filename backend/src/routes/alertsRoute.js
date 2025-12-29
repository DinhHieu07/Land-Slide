const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { 
    listAlerts, 
    getAlertById, 
    updateAlertStatus, 
    createAlert,
    getAlertStats 
} = require('../controllers/alertController');

router.get('/', authenticateToken, roleMiddleware(['admin', 'superAdmin']), listAlerts);
router.get('/stats', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getAlertStats);
router.get('/:id', authenticateToken, roleMiddleware(['admin', 'superAdmin']), getAlertById);
router.put('/:id/status', authenticateToken, roleMiddleware(['admin', 'superAdmin']), updateAlertStatus);
router.post('/', authenticateToken, roleMiddleware(['admin', 'superAdmin']), createAlert);

module.exports = router;