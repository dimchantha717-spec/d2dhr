const db = require('./db');

async function migrate() {
    try {
        console.log('Starting migration...');
        await db.query(`ALTER TABLE attendance_records ADD COLUMN ot_hours DECIMAL(4,2) DEFAULT 0.00;`);
        console.log('✅ Added ot_hours to attendance_records');
        process.exit(0);
    } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
            console.log('⚠️ Column already exists, skipping.');
            process.exit(0);
        }
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
