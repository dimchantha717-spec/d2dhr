const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkUsers() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'd2donehr',
        port: process.env.DB_PORT || 3306,
    });

    try {
        const [rows] = await connection.execute('SELECT id, name, username, password_hash, role, status FROM employees');
        const fs = require('fs');
        fs.writeFileSync('db_users.json', JSON.stringify(rows, null, 2));
        console.log('Done writing to db_users.json');
    } catch (err) {
        console.error('Error checking users:', err.message);
    } finally {
        await connection.end();
    }
}

checkUsers();
