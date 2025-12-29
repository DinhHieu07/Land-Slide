require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const eventsRoute = require('./routes/eventsRoute');    
const areasRoute = require('./routes/areasRoute');
const alertsRoute = require('./routes/alertsRoute');
const authRoute = require('./routes/authRoute');
const devicesRoute = require('./routes/devicesRoute');
const sensorsRoute = require('./routes/sensorsRoute');
const dashboardRoute = require('./routes/dashboardRoute');
const historyRoute = require('./routes/historyRoute');
const provinceRoute = require('./routes/provinceRoute');
const accountRoute = require('./routes/accountRoute');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

app.set('io', io);

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

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
app.use('/api/sensors', sensorsRoute);
app.use('/api/dashboard', dashboardRoute);
app.use('/api/history', historyRoute);
app.use('/api/provinces', provinceRoute);
app.use('/api/accounts', accountRoute);

const port = process.env.PORT || 5000;
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Socket.io is ready`);
});

module.exports = { io };