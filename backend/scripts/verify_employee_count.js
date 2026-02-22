const db = require('../config/db');

async function verify() {
    try {
        const [rows] = await db.query('SELECT id, name, role FROM employees');
        console.log('Current Employees:', rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

verify();
