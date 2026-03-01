const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'd2donehr',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true, // Prevents Hostinger dropping idle connections
  keepAliveInitialDelay: 0,
  timezone: '+00:00', // Align with SQL script
  dateStrings: true   // Return dates as strings to avoid UTC conversion shifts
});

// Test connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    if (err.code === 'ER_BAD_DB_ERROR') {
      console.error('👉 Hint: The database name in .env does not exist. Please create it or check your SQL script.');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('👉 Hint: Check your DB_USER and DB_PASSWORD in .env.');
    }
  } else {
    console.log('✅ Database connected successfully!');
    connection.release();
  }
});

module.exports = {
  // Using promise wrapper for async/await compatibility
  query: async (text, params) => {
    const promisePool = pool.promise();
    // mysql2 does not accept 'undefined' in bind parameters.
    // We convert all 'undefined' to 'null' for compatibility.
    const cleanParams = Array.isArray(params)
      ? params.map(p => p === undefined ? null : p)
      : params;
    return promisePool.execute(text, cleanParams);
  },
  pool
};
