const db = require('../config/db');

async function migrate() {
    try {
        console.log("Checking if 'deleted_at' column exists in 'employees' table...");
        const [columns] = await db.query("SHOW COLUMNS FROM employees LIKE 'deleted_at'");

        if (columns.length === 0) {
            console.log("Adding 'deleted_at' column to 'employees' table...");
            await db.query("ALTER TABLE employees ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL");
            console.log("Column 'deleted_at' added successfully.");
        } else {
            console.log("Column 'deleted_at' already exists.");
        }

        console.log("Migration completed.");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
