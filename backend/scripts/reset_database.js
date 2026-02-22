const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mysqlPromise = require('mysql2/promise');

async function resetDatabase() {
    let conn;
    try {
        console.log('🚀 Starting Full Database Reset...');

        // 1. Create a separate connection that allows multiple statements
        conn = await mysqlPromise.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'd2donehr',
            port: process.env.DB_PORT || 3306,
            multipleStatements: true
        });

        // 2. Disable Foreign Key Checks
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        console.log('🔗 Foreign key checks disabled.');

        // 3. Get all tables and DROP them
        const [tables] = await conn.query('SHOW TABLES');
        for (const tableObj of tables) {
            const tableName = Object.values(tableObj)[0];
            await conn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
            console.log(`🗑️ Dropped: ${tableName}`);
        }

        // 4. Read and Execute Schema from database_mysql.sql
        console.log('📜 Executing Base Schema...');
        const sqlPath = path.join(__dirname, '../database_mysql.sql');
        let sql = fs.readFileSync(sqlPath, 'utf8');

        // Remove ALL INSERT INTO statements (including multi-line) to allow clean manual seed
        sql = sql.replace(/INSERT INTO[\s\S]*?;/gi, '');

        await conn.query(sql);
        console.log('✅ Base schema created.');

        // 5. Create missing tables (Performance and Chat Suggestions)
        console.log('📊 Creating Auxiliary Tables...');
        const auxiliaryTables = `
            CREATE TABLE IF NOT EXISTS performance_reviews (
                id VARCHAR(50) NOT NULL,
                employee_id VARCHAR(50) NOT NULL,
                reviewer_id VARCHAR(50) DEFAULT NULL,
                review_date DATE NOT NULL,
                rating INT(11) DEFAULT 0,
                comments TEXT,
                goals TEXT,
                status VARCHAR(20) DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY employee_id (employee_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS chat_suggestions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                role VARCHAR(50),
                language VARCHAR(10),
                text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
        await conn.query(auxiliaryTables);
        console.log('✅ Auxiliary tables created.');

        // 6. Seed Shifts
        console.log('🕐 Seeding Shifts...');
        await conn.query(`
            INSERT INTO shifts (id, name, start_time, end_time, break_time_duration) 
            VALUES ('shift-1', 'វេនរដ្ឋបាល (Full-Time)', '08:00:00', '17:00:00', '12:00-13:00')
        `);

        // 7. Seed Employees using standard db utility
        console.log('👥 Seeding ONLY Super Admin...');
        const employees = [
            {
                id: '1',
                name: 'Poum Moniroth',
                position: 'CEO',
                department: 'Management',
                email: 'moniroth.poum@company.com',
                phone: '012 222 111',
                joinDate: '2021-03-10',
                dob: '1992-04-18',
                nationality: 'Khmer',
                salary: 2500,
                status: 'សកម្ម',
                username: 'moniroth',
                password: '123',
                role: 'super_admin',
                shiftId: 'shift-1',
                offDay: 'Sunday',
                breakTime: '12:00-13:00',
                address: 'Phnom Penh, Cambodia',
                emergencyContactName: 'Emergency Contact',
                emergencyContactPhone: '098 111 222',
                bankName: 'ABA Bank',
                bankAccountName: 'POUM MONIROTH',
                bankAccountNumber: '001 111 222'
            }
        ];

        for (const emp of employees) {
            const passwordHash = await bcrypt.hash(emp.password, 10);
            await db.query(
                `INSERT INTO employees (
                    id, name, position, department, email, phone, join_date, dob, nationality, 
                    salary, status, username, password_hash, role, shift_id, off_day, 
                    break_time, address, emergency_contact_name, emergency_contact_phone, 
                    bank_name, bank_account_name, bank_account_number
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    emp.id, emp.name, emp.position, emp.department, emp.email, emp.phone, emp.joinDate, emp.dob, emp.nationality,
                    emp.salary, emp.status, emp.username, passwordHash, emp.role, emp.shiftId, emp.offDay,
                    emp.breakTime, emp.address, emp.emergencyContactName, emp.emergencyContactPhone,
                    emp.bankName, emp.bankAccountName, emp.bankAccountNumber
                ]
            );
            console.log(`👤 Seeded MUST-HAVE: ${emp.name} (${emp.role})`);
        }

        // 8. Seed Chat Suggestions (Minimal)
        console.log('🤖 Seeding Chat Suggestions...');
        const suggestions = [
            ['super_admin', 'kh', 'សេចក្តីសង្ខេបដំណើរការក្រុមហ៊ុន'], ['super_admin', 'en', 'Company performance summary']
        ];
        for (const [role, lang, text] of suggestions) {
            await db.query('INSERT INTO chat_suggestions (role, language, text) VALUES (?, ?, ?)', [role, lang, text]);
        }

        // 9. Seed System Settings
        console.log('⚙️ Seeding System Settings...');
        const defaultSettings = {
            workStartTime: '08:00',
            gracePeriodMinutes: 15,
            workEndTime: '17:00',
            halfDayTime: '12:00',
            otRate: 5.0,
            maxDistanceMeters: 100,
            shifts: [
                { id: 'shift-1', name: 'វេនរដ្ឋបាល (Full-Time)', startTime: '08:00', endTime: '17:00', breakTime: '12:00-13:00' }
            ],
            lateTiersAuthorized: [
                { id: 't1', minMinutes: 1, maxMinutes: 15, penaltyType: 'fixed', penaltyValue: 5 },
                { id: 't2', minMinutes: 16, maxMinutes: 60, penaltyType: 'fixed', penaltyValue: 10 },
                { id: 't3', minMinutes: 61, maxMinutes: null, penaltyType: 'daySalary', penaltyValue: 0.5 }
            ],
            lateTiersUnauthorized: [
                { id: 't1', minMinutes: 1, maxMinutes: 15, penaltyType: 'fixed', penaltyValue: 5 },
                { id: 't2', minMinutes: 16, maxMinutes: 60, penaltyType: 'fixed', penaltyValue: 10 },
                { id: 't3', minMinutes: 61, maxMinutes: null, penaltyType: 'daySalary', penaltyValue: 0.5 }
            ],
            earlyLeaveTiersAuthorized: [
                { id: 't1', minMinutes: 1, maxMinutes: 15, penaltyType: 'fixed', penaltyValue: 5 },
                { id: 't2', minMinutes: 16, maxMinutes: 60, penaltyType: 'fixed', penaltyValue: 10 },
                { id: 't3', minMinutes: 61, maxMinutes: null, penaltyType: 'daySalary', penaltyValue: 0.5 }
            ],
            earlyLeaveTiersUnauthorized: [
                { id: 't1', minMinutes: 1, maxMinutes: 15, penaltyType: 'fixed', penaltyValue: 5 },
                { id: 't2', minMinutes: 16, maxMinutes: 60, penaltyType: 'fixed', penaltyValue: 10 },
                { id: 't3', minMinutes: 61, maxMinutes: null, penaltyType: 'daySalary', penaltyValue: 0.5 }
            ],
            publicHolidays: [],
            telegram: { botToken: '', chatId: '', enabled: false },
            payrollOpeningSchedule: { mode: 'once', firstPeriod: { startDay: 1, endDay: 31 } }
        };
        await db.query('INSERT INTO system_settings (\`key\`, \`value\`) VALUES (?, ?)', ['attendance_settings', JSON.stringify(defaultSettings)]);

        // 10. Re-enable Foreign Key Checks
        await db.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('🔗 Foreign key checks re-enabled.');

        console.log('✨ DATABASE RESET SUCCESSFUL!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Database Reset Failed:', err);
        process.exit(1);
    }
}

resetDatabase();
