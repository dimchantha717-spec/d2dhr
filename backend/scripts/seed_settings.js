const db = require('../config/db');

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
    payrollOpeningSchedule: {
        mode: 'once',
        firstPeriod: { startDay: 1, endDay: 31 } // Open all month for easy start
    }
};

async function seedSettings() {
    try {
        console.log('--- Seeding system_settings table ---');

        await db.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                \`key\` VARCHAR(50) NOT NULL,
                \`value\` TEXT,
                PRIMARY KEY (\`key\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await db.query('INSERT INTO system_settings (\`key\`, \`value\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`value\` = ?',
            ['attendance_settings', JSON.stringify(defaultSettings), JSON.stringify(defaultSettings)]
        );

        console.log('✅ Successfully seeded system settings!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to seed settings:', err);
        process.exit(1);
    }
}

seedSettings();
