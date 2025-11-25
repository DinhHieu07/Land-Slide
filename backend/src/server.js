require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const eventsRoute = require('./routes/eventsRoute');    
const areasRoute = require('./routes/areasRoute');
const alertsRoute = require('./routes/alertsRoute');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(helmet());
app.use('/api/events', eventsRoute);
app.use('/api/areas', areasRoute);
app.use('/api/alerts', alertsRoute);

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});