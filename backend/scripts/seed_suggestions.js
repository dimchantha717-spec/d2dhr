const db = require('../config/db');

async function seedSuggestions() {
    try {
        console.log('--- Seeding Chat Suggestions ---');

        await db.query(`
            CREATE TABLE IF NOT EXISTS chat_suggestions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                role VARCHAR(50),
                language VARCHAR(10),
                text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Clear existing data to ensure updates are applied
        console.log('Clearing old suggestions...');
        await db.query('TRUNCATE TABLE chat_suggestions');

        console.log('Inserting new suggestions...');
        const suggestions = [
            // Super Admin
            ['super_admin', 'kh', 'សេចក្តីសង្ខេបដំណើរការក្រុមហ៊ុនប្រចាំខែ'],
            ['super_admin', 'kh', 'វិភាគផ្នែកដែលមានប្រសិទ្ធភាពការងារខ្ពស់បំផុត'],
            ['super_admin', 'kh', 'របាយការណ៍សរុបការចំណាយលើបៀវត្ស'],
            ['super_admin', 'kh', 'ពិនិត្យមើលលំនាំនៃការឈប់សម្រាកបុគ្គលិក'],
            ['super_admin', 'kh', 'ទិដ្ឋភាពទូទៅនៃសន្តិសុខ និងកំណត់ត្រាប្រព័ន្ធ'],
            ['super_admin', 'en', 'Monthly company performance summary'],
            ['super_admin', 'en', 'Identify top performing departments'],
            ['super_admin', 'en', 'Global payroll and expense report'],
            ['super_admin', 'en', 'System security and audit log overview'],

            // System Manager
            ['system_manager', 'kh', 'ពិនិត្យមើលកំណត់ត្រាប្រព័ន្ធ និងសកម្មភាពអ្នកប្រើប្រាស់'],
            ['system_manager', 'kh', 'គ្រប់គ្រងអ្នកប្រើប្រាស់ប្រព័ន្ធ និងសិទ្ធិ'],
            ['system_manager', 'kh', 'វិភាគបញ្ហាបច្ចេកទេស និងដំណើរការប្រព័ន្ធ'],
            ['system_manager', 'kh', 'របាយការណ៍សង្ខេបនៃទិន្នន័យបុគ្គលិកទាំងអស់'],
            ['system_manager', 'en', 'Review system logs and user activities'],
            ['system_manager', 'en', 'Manage system users and permissions'],
            ['system_manager', 'en', 'Analyze technical issues and system performance'],
            ['system_manager', 'en', 'Summary report of all employee data'],

            // Admin
            ['admin', 'kh', 'តារាងពិន្ទុវត្តមានបុគ្គលិកតាមផ្នែក'],
            ['admin', 'kh', 'គ្រប់គ្រងកាលវិភាគការងារ និងការផ្លាស់ប្តូរវេន'],
            ['admin', 'kh', 'របាយការណ៍សមិទ្ធផលការងារប្រចាំខែ'],
            ['admin', 'en', 'Employee attendance scorecard by department'],
            ['admin', 'en', 'Manage work schedules and shift changes'],
            ['admin', 'en', 'Monthly performance achievement report'],

            // HR
            ['hr', 'kh', 'ពិនិត្យមើលសំណើរសុំច្បាប់សម្រាក'],
            ['hr', 'kh', 'របាយការណ៍វាយតម្លៃបុគ្គលិកថ្មី'],
            ['hr', 'kh', 'វិភាគអត្រាអវត្តមាន និងការមកយឺត'],
            ['hr', 'kh', 'រៀបចំកិច្ចសន្យាការងារ និងឯកសារបុគ្គលិក'],
            ['hr', 'en', 'Review pending leave requests'],
            ['hr', 'en', 'New employee evaluation report'],
            ['hr', 'en', 'Analyze absenteeism and late arrival rates'],
            ['hr', 'en', 'Prepare employment contracts and documents'],

            // Accountant
            ['accountant', 'kh', 'ផ្ទៀងផ្ទាត់ការគណនាបៀវត្ស និងការកាត់កង'],
            ['accountant', 'kh', 'របាយការណ៍ចំណាយ និងប្រាក់បៀវត្សប្រចាំខែ'],
            ['accountant', 'kh', 'ការគណនាពន្ធ និង ប.ស.ស'],
            ['accountant', 'en', 'Verify payroll calculations and deductions'],
            ['accountant', 'en', 'Monthly expense and payroll report'],
            ['accountant', 'en', 'Tax and NSSF calculations'],

            // Employee
            ['employee', 'kh', 'តើខ្ញុំអាចបង្កើនពិន្ទុវត្តមានយ៉ាងដូចម្តេច?'],
            ['employee', 'kh', 'បង្ហាញប្រវត្តិវត្តមាន និងការមកយឺតរបស់ខ្ញុំ'],
            ['employee', 'kh', 'តើខ្ញុំនៅសល់ច្បាប់សម្រាកប្រចាំឆ្នាំប៉ុន្មានថ្ងៃ?'],
            ['employee', 'kh', 'គោលការណ៍ក្រុមហ៊ុនអំពីការមកយឺត និងការផាកពិន័យ'],
            ['employee', 'en', 'How can I improve my attendance score?'],
            ['employee', 'en', 'Show my attendance and late arrival history'],
            ['employee', 'en', 'How many annual leave days do I have left?'],
            ['employee', 'en', 'Company policy on late arrivals and penalties']
        ];

        for (const [role, lang, text] of suggestions) {
            await db.query('INSERT INTO chat_suggestions (role, language, text) VALUES (?, ?, ?)', [role, lang, text]);
        }

        console.log('✅ Successfully updated chat suggestions!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to seed suggestions:', err);
        process.exit(1);
    }
}

seedSuggestions();
