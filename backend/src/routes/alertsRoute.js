const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { 
    listAlerts, 
    getAlertById, 
    updateAlertStatus, 
    createAlert,
    getAlertStats,
    getEvidenceData,
    getAlertHeatmap,
} = require('../controllers/alertController');

router.get('/evidence-data', getEvidenceData);
router.get('/heatmap', authenticateToken, roleMiddleware(['user', 'admin', 'superAdmin']), getAlertHeatmap);
router.get('/', authenticateToken, roleMiddleware(['user', 'admin', 'superAdmin']), listAlerts);
router.get('/stats', authenticateToken, roleMiddleware(['user', 'admin', 'superAdmin']), getAlertStats);
router.get('/:id', authenticateToken, roleMiddleware(['user', 'admin', 'superAdmin']), getAlertById);
router.put('/:id/status', authenticateToken, roleMiddleware(['admin', 'superAdmin']), updateAlertStatus);
router.post('/', authenticateToken, roleMiddleware(['admin', 'superAdmin']), createAlert);

module.exports = router;