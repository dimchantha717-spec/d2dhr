const db = require('../config/db');

async function seedShifts() {
    try {
        console.log('--- Seeding shifts table ---');

        await db.query(`
            INSERT INTO shifts (id, name, start_time, end_time, break_time_duration) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE name=name
        `, ['shift-1', 'វេនរដ្ឋបាល (Full-Time)', '08:00:00', '17:00:00', '12:00-13:00']);

        console.log('✅ Successfully seeded shifts!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to seed shifts:', err);
        process.exit(1);
    }
}

seedShifts();
