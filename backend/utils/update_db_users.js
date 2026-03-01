const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateUsers() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'd2donehr',
        port: process.env.DB_PORT || 3306,
    });

    try {
        console.log('Updating user moniroth...');
        await connection.execute(
            "UPDATE employees SET name = 'Poum Moniroth', username = 'moniroth', password_hash = '123' WHERE id = '1'"
        );

        console.log('Checking if savtey exists...');
        const [rows] = await connection.execute("SELECT * FROM employees WHERE id = '2'");
        if (rows.length === 0) {
            console.log('Inserting user savtey...');
            await connection.execute(
                "INSERT INTO employees (id, name, position, department, username, password_hash, role, status) VALUES ('2', 'Ouk Savtey', 'HR & Admin', 'HR', 'savtey', '123', 'admin', 'សកម្ម')"
            );
        } else {
            console.log('Updating user savtey...');
            await connection.execute(
                "UPDATE employees SET name = 'Ouk Savtey', username = 'savtey', password_hash = '123' WHERE id = '2'"
            );
        }

        console.log('✅ Users updated successfully!');
    } catch (err) {
        console.error('❌ Error updating users:', err.message);
    } finally {
        await connection.end();
    }
}

updateUsers();
