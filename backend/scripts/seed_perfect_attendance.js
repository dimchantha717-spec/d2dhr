const db = require('../config/db');

async function seedPerfectAttendance() {
    try {
        console.log('--- Seeding Perfect Attendance for Feb 2026 ---');

        const [employeeRows] = await db.query('SELECT id FROM employees');
        const employees = employeeRows.map(r => r.id);
        const days = [2, 3, 4, 5, 6, 7]; // Monday to Saturday (Feb 1 was Sunday)

        for (const empId of employees) {
            for (const day of days) {
                const date = `2026-02-${String(day).padStart(2, '0')}`;
                const checkIn = `${date} 08:00:00`;
                const checkOut = `${date} 12:00:00`;
                const checkIn2 = `${date} 13:00:00`;
                const checkOut2 = `${date} 17:00:00`;
                const id = `att_${empId}_${day}`;

                await db.query(`
                    INSERT INTO attendance_records (id, employee_id, date, check_in, check_out, check_in2, check_out2, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE status='មកទាន់ពេល'
                `, [id, empId, date, checkIn, checkOut, checkIn2, checkOut2, 'មកទាន់ពេល']);
            }
            console.log(`✅ Seeded attendance for Employee ${empId}`);
        }

        console.log('✨ Attendance seeding complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to seed attendance:', err);
        process.exit(1);
    }
}

seedPerfectAttendance();
