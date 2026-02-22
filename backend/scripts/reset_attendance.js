const pool = require('../config/db');

async function resetAttendance() {
    try {
        console.log('🗑️ Starting Attendance History Reset...');

        // 1. Disable checks just in case
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');

        // 2. Truncate table
        await pool.query('TRUNCATE TABLE attendance_records');
        console.log('✅ Attendance table truncated successfully.');

        // 3. Re-enable checks
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('✨ ALL ATTENDANCE HISTORY HAS BEEN CLEARED!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Attendance Reset Failed:', err.message);
        process.exit(1);
    }
}

resetAttendance();
