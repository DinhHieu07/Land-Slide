require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const eventsRoute = require('./routes/eventsRoute');    
const areasRoute = require('./routes/areasRoute');
const alertsRoute = require('./routes/alertsRoute');
const authRoute = require('./routes/authRoute');
const devicesRoute = require('./routes/devicesRoute');
const dashboardRoute = require('./routes/dashboardRoute');
const historyRoute = require('./routes/historyRoute');
const provinceRoute = require('./routes/provinceRoute');
const accountRoute = require('./routes/accountRoute');

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(helmet());
app.use('/api/auth', authRoute);
app.use('/api/events', eventsRoute);
app.use('/api/areas', areasRoute);
app.use('/api/alerts', alertsRoute);
app.use('/api/devices', devicesRoute);
app.use('/api/dashboard', dashboardRoute);
app.use('/api/history', historyRoute);
app.use('/api/provinces', provinceRoute);
app.use('/api/accounts', accountRoute);

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});