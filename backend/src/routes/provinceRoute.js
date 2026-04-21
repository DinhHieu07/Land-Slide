const express = require('express');
const router = express.Router();
const { listProvinces, listAllProvincesPublic } = require('../controllers/provinceController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/public', listAllProvincesPublic);
router.get('/list-provinces/:username', authenticateToken, listProvinces);

module.exports = router;