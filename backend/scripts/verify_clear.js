const pool = require('../config/db');

async function verifyClear() {
    try {
        const [attendance] = await pool.query('SELECT COUNT(*) as count FROM attendance_records');
        const [payroll] = await pool.query('SELECT COUNT(*) as count FROM payroll_records');

        console.log(`Attendance Records Count: ${attendance[0].count}`);
        console.log(`Payroll Records Count: ${payroll[0].count}`);

        if (attendance[0].count === 0 && payroll[0].count === 0) {
            console.log('✅ Verification successful: All data cleared.');
        } else {
            console.log('❌ Verification failed: Some data still remains.');
        }
        process.exit(0);
    } catch (err) {
        console.error('❌ Verification Error:', err.message);
        process.exit(1);
    }
}

verifyClear();
