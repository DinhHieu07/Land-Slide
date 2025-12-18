const express = require('express');
const router = express.Router();
const { listProvinces } = require('../controllers/provinceController');

router.get('/list-provinces', listProvinces);

module.exports = router;