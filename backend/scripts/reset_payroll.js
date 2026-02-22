const pool = require('../config/db');

async function resetAllPayroll() {
    try {
        console.log('🗑️ Starting Full Payroll Reset...');

        // 1. Disable checks just in case
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');

        // 2. Truncate table
        await pool.query('TRUNCATE TABLE payroll_records');
        console.log('✅ Payroll table truncated successfully.');

        // 3. Re-enable checks
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('✨ ALL PAYROLL DATA HAS BEEN CLEARED!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Payroll Reset Failed:', err.message);
        process.exit(1);
    }
}

resetAllPayroll();
