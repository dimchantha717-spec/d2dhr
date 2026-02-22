const db = require('../config/db');
const mysqlPromise = require('mysql2/promise');

async function clearEmployees() {
    try {
        console.log('🧹 Starting Employee Cleanup...');

        // 1. Get IDs of employees to delete (Everyone except Super Admin ID '1')
        const [rows] = await db.query("SELECT id, name FROM employees WHERE id != '1'");

        if (rows.length === 0) {
            console.log('✅ No employees to clear (Super Admin is preserved).');
            process.exit(0);
        }

        const idsToDelete = rows.map(r => r.id);
        const namesToDelete = rows.map(r => r.name);

        console.log(`Found ${idsToDelete.length} employees to delete:`, namesToDelete.join(', '));

        // 2. Delete Attendance Records explicitly (since constraint is SET NULL)
        // We want to remove the records, not just nullify the employee_id
        console.log('🗑️ Deleting related attendance records...');
        const placeholder = idsToDelete.map(() => '?').join(',');
        await db.query(`DELETE FROM attendance_records WHERE employee_id IN (${placeholder})`, idsToDelete);

        // 3. Delete Employees
        // Other tables like payroll, leaves, etc. should cascade delete
        console.log('🗑️ Deleting employees...');
        await db.query(`DELETE FROM employees WHERE id IN (${placeholder})`, idsToDelete);

        console.log('✨ Cleanup Successful! All test employees removed.');
        process.exit(0);

    } catch (err) {
        console.error('❌ Employee Cleanup Failed:', err);
        process.exit(1);
    }
}

clearEmployees();
