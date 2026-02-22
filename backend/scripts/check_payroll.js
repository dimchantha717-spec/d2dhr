const db = require('./backend/db');
async function checkPayroll() {
    try {
        const [rows] = await db.query('SELECT salary, net_salary, status FROM payroll_records WHERE id = ?', ['1_2026-02']);
        console.log('PAYROLL_RECORD_CHECK:', JSON.stringify(rows));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkPayroll();
