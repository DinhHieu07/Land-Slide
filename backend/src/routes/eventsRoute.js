const express = require('express');
const router = express.Router();
const { listEvents, getEventById, createEvent, deleteEvent, searchNearBy } = require('../controllers/eventsController');

router.get('/list-events', listEvents);
router.get('/get-event/:id', getEventById);
router.post('/create-event', createEvent);
router.delete('/delete-event/:id', deleteEvent);
router.get('/search-near-by', searchNearBy);

module.exports = router;