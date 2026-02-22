const pool = require('../config/db');

async function migrate() {
    try {
        console.log('🔄 Starting Migration: Adding duration to leave_requests...');

        // Check if column exists
        const [columns] = await pool.query("SHOW COLUMNS FROM leave_requests LIKE 'duration'");
        if (columns.length > 0) {
            console.log('✅ Column duration already exists. Skipping.');
            process.exit(0);
        }

        // Add column
        await pool.query("ALTER TABLE leave_requests ADD COLUMN duration VARCHAR(20) DEFAULT 'Full Day' AFTER end_date");
        console.log('✅ Column duration added successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration Failed:', err.message);
        process.exit(1);
    }
}

migrate();
