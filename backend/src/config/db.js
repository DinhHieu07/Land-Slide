const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({ 
    path: path.resolve(__dirname, '../../.env') 
});

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

pool.on('error', (err) => {
    console.error('Error in PostgreSQL connection:', err);
});

module.exports = pool;