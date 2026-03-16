const db = require('../config/db');
const { addColumn, modifyColumn, tableExists } = require('../utils/dbHelper');

async function runMigrations() {
    console.log('🚀 Running database migrations...');

    try {
        // --- Employees Table ---
        await addColumn('employees', 'created_by', 'VARCHAR(100) DEFAULT NULL');
        await addColumn('employees', 'changed_by', 'VARCHAR(100) DEFAULT NULL');
        await addColumn('employees', 'resigned_reason', 'TEXT DEFAULT NULL');
        
        // Ensure annual_leave_total and annual_leave_used exist (they should, but just in case)
        await addColumn('employees', 'annual_leave_total', 'DECIMAL(10,2) DEFAULT 18.00');
        await addColumn('employees', 'annual_leave_used', 'DECIMAL(10,2) DEFAULT 0.00');

        // --- Leave Requests Table ---
        await modifyColumn('leave_requests', 'evidence_photo', 'LONGTEXT');
        await modifyColumn('leave_requests', 'evidence_audio', 'LONGTEXT');
        await addColumn('leave_requests', 'approved_by', 'VARCHAR(255) DEFAULT NULL');
        await addColumn('leave_requests', 'approved_at', 'DATETIME DEFAULT NULL');
        await addColumn('leave_requests', 'resigned_reason', 'TEXT DEFAULT NULL');
        await addColumn('leave_requests', 'duration', 'VARCHAR(50) DEFAULT "Full Day"');
        await addColumn('leave_requests', 'late_duration_value', 'INT DEFAULT 0');
        await addColumn('leave_requests', 'late_duration_unit', 'VARCHAR(20) DEFAULT "នាទី"');

        // --- Notifications Table ---
        const hasNotifications = await tableExists('notifications');
        if (!hasNotifications) {
            console.log('📦 Creating notifications table...');
            await db.query(`
                CREATE TABLE notifications (
                    id varchar(50) NOT NULL,
                    title varchar(255) NOT NULL,
                    message text,
                    target_type varchar(50) DEFAULT NULL,
                    target_value varchar(100) DEFAULT NULL,
                    priority varchar(20) DEFAULT 'Normal',
                    is_read boolean DEFAULT FALSE,
                    pushed_by varchar(255) DEFAULT NULL,
                    image LONGTEXT DEFAULT NULL,
                    date timestamp DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
        } else {
            await addColumn('notifications', 'pushed_by', 'VARCHAR(255) DEFAULT NULL');
            await addColumn('notifications', 'image', 'LONGTEXT DEFAULT NULL');
            await addColumn('notifications', 'priority', 'VARCHAR(20) DEFAULT "Normal"');
        }

        // --- Chat Suggestions Table ---
        const hasChatSuggestions = await tableExists('chat_suggestions');
        if (!hasChatSuggestions) {
            console.log('📦 Creating chat_suggestions table...');
            await db.query(`
                CREATE TABLE chat_suggestions (
                    id int(11) NOT NULL AUTO_INCREMENT,
                    role varchar(50) DEFAULT NULL,
                    language varchar(10) DEFAULT NULL,
                    text text DEFAULT NULL,
                    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✅ chat_suggestions table created.');
        }

        console.log('✅ Database migrations completed successfully.');
    } catch (err) {
        console.error('❌ Database migration error:', err);
    }
}

module.exports = { runMigrations };
