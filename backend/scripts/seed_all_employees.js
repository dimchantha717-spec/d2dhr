const db = require('../config/db');
const bcrypt = require('bcryptjs');

const employees = [
    {
        id: '1',
        name: 'Dim Chantha',
        position: 'System Manager',
        department: 'IT',
        email: 'chantha.dim@company.com',
        phone: '012 222 111',
        joinDate: '2021-03-10',
        dob: '1992-04-18',
        nationality: 'Khmer',
        salary: 1500,
        status: 'សកម្ម',
        avatar: '',
        annualLeaveTotal: 18,
        annualLeaveUsed: 2,
        username: 'chantha',
        password: '123',
        role: 'super_admin',
        shiftId: 'shift-1',
        offDay: 'Sunday',
        breakTime: '12:00-13:00',
        address: 'Phnom Penh, Cambodia',
        emergencyContactName: 'Dim Sreyneang',
        emergencyContactPhone: '098 111 222',
        bankName: 'ABA Bank',
        bankAccountName: 'DIM CHANTHA',
        bankAccountNumber: '001 111 222'
    },

];

(async () => {
    try {
        console.log('Starting seed process...');

        for (const emp of employees) {
            const [exists] = await db.query("SELECT id FROM employees WHERE id = ?", [emp.id]);
            if (exists.length > 0) {
                console.log(`Skipping ${emp.name} (ID ${emp.id} already exists)`);
                continue;
            }

            console.log(`Seeding ${emp.name}...`);
            const passwordHash = await bcrypt.hash(emp.password, 10);

            await db.query(
                `INSERT INTO employees (
                    id, name, position, department, email, phone, join_date, dob, nationality,
                    salary, status, avatar, username, password_hash, role, shift_id,
                    off_day, break_time, address, emergency_contact_name, emergency_contact_phone,
                    bank_name, bank_account_name, bank_account_number,
                    annual_leave_total, annual_leave_used
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?
                )`,
                [
                    emp.id, emp.name, emp.position, emp.department, emp.email, emp.phone, emp.joinDate, emp.dob, emp.nationality,
                    emp.salary, emp.status, emp.avatar, emp.username, passwordHash, emp.role, emp.shiftId,
                    emp.offDay, emp.breakTime, emp.address, emp.emergencyContactName, emp.emergencyContactPhone,
                    emp.bankName, emp.bankAccountName, emp.bankAccountNumber,
                    emp.annualLeaveTotal, emp.annualLeaveUsed
                ]
            );
        }

        console.log('✅ All initial employees seeded successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Seed Error:', err);
        process.exit(1);
    }
})();
