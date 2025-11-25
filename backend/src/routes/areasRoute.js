const express = require('express');
const router = express.Router();
const { listAreas, createArea, getAreaById } = require('../controllers/areasController');

router.get('/list-areas', listAreas);
router.post('/create-area', createArea);
router.get('/get-area/:id', getAreaById);

module.exports = router;