const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({ 
    path: path.resolve(__dirname, '../../.env') 
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on('error', (err) => {
    console.error('Error in PostgreSQL connection:', err);
});

module.exports = pool;