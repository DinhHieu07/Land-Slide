const express = require('express');
const router = express.Router();
const { listAlerts, createAlert } = require('../controllers/alertController');

router.get('/list-alerts', listAlerts);
router.post('/create-alert', createAlert);

module.exports = router;