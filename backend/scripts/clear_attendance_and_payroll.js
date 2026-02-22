const pool = require('../config/db');

async function clearData() {
    try {
        console.log('🗑️ Starting Data Clear (Attendance History & Payroll)...');

        // 1. Disable foreign key checks
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');

        // 2. Clear Attendance History
        await pool.query('TRUNCATE TABLE attendance_records');
        console.log('✅ attendance_records table truncated successfully.');

        // 3. Clear Payroll
        await pool.query('TRUNCATE TABLE payroll_records');
        console.log('✅ payroll_records table truncated successfully.');

        // 4. Re-enable foreign key checks
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('✨ ALL ATTENDANCE AND PAYROLL DATA HAS BEEN CLEARED!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Data Clear Failed:', err.message);
        process.exit(1);
    }
}

clearData();
