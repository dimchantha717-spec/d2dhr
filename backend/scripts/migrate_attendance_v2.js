const db = require('../config/db');

const migration = `
ALTER TABLE attendance_records 
ADD COLUMN check_in2 TIMESTAMP NULL DEFAULT NULL AFTER check_out,
ADD COLUMN check_out2 TIMESTAMP NULL DEFAULT NULL AFTER check_in2,
ADD COLUMN ot_hours DECIMAL(5,2) DEFAULT 0 AFTER is_holiday_work;
`;

(async () => {
    try {
        console.log('Running Attendance V2 Migration...');
        // Check if columns already exist to avoid errors
        const [columns] = await db.query('SHOW COLUMNS FROM attendance_records');
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('check_in2')) {
            await db.query('ALTER TABLE attendance_records ADD COLUMN check_in2 TIMESTAMP NULL DEFAULT NULL AFTER check_out');
            console.log('✅ Added check_in2');
        }
        if (!columnNames.includes('check_out2')) {
            await db.query('ALTER TABLE attendance_records ADD COLUMN check_out2 TIMESTAMP NULL DEFAULT NULL AFTER check_in2');
            console.log('✅ Added check_out2');
        }
        if (!columnNames.includes('ot_hours')) {
            await db.query('ALTER TABLE attendance_records ADD COLUMN ot_hours DECIMAL(5,2) DEFAULT 0 AFTER is_holiday_work');
            console.log('✅ Added ot_hours');
        }

        console.log('✅ Migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
})();
