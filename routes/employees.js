const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { snakeToCamel } = require('../utils/mapKeys');
const { logAction } = require('../utils/auditLogger');
const { authenticateToken } = require('../utils/authMiddleware');
const { ensurePhysicalFile } = require('../utils/fileHandler');
const { sendNotification } = require('../services/telegramService');


// GET all employees (excluding deleted ones)
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Auto-purge employees in trash for more than 30 days
        await db.query('DELETE FROM employees WHERE deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');

        const [rows] = await db.query('SELECT * FROM employees WHERE deleted_at IS NULL ORDER BY created_at DESC');
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET trashed employees
router.get('/trash', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM employees WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET employee by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM employees WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST new employee
router.post('/', authenticateToken, async (req, res) => {
    try {
        const isManager = ['super_admin', 'system_manager', 'hr', 'admin'].includes(req.user.role);
        if (!isManager) return res.status(403).json({ error: 'Permission denied. Management only.' });
        const {
            name, gender, position, department, email, phone, joinDate, dob, nationality,
            salary, status, avatar, username, password, role, shiftId,
            offDay, breakTime, address, emergencyContactName, emergencyContactPhone,
            bankName, bankAccountName, bankAccountNumber, bankQrCode,
            cvDocument, idCardDocument
        } = req.body;
        const resigned_reason = req.body.resigned_reason || req.body.resignedReason;

        const id = req.body.id || Date.now().toString();

        // Check for duplicate username or email
        const [existing] = await db.query(
            'SELECT id, name, username, email FROM employees WHERE username = ? OR email = ?',
            [username, email]
        );
        if (existing.length > 0) {
            const match = existing[0];
            const field = match.username === username ? 'Username' : 'Email';
            return res.status(409).json({
                error: `${field} "${field === 'Username' ? username : email}" belongs to ${match.name}.`
            });
        }

        const bcrypt = require('bcryptjs');
        const plainPassword = password || '123';
        const passwordHash = await bcrypt.hash(plainPassword, 10);

        // Sanitize dates: MySQL doesn't like empty strings for DATE columns
        const validJoinDate = joinDate ? joinDate : null;
        const validDob = dob ? dob : null;

        const cleanSalary = Number(salary) || 0;

        // Ensure all files are stored physically on disk
        const host = req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;

        const physicalAvatar = await ensurePhysicalFile(avatar, 'avatar', host, protocol);
        const physicalQrCode = await ensurePhysicalFile(bankQrCode, 'qr', host, protocol);
        const physicalCv = await ensurePhysicalFile(cvDocument, 'cv', host, protocol);
        const physicalIdCard = await ensurePhysicalFile(idCardDocument, 'id', host, protocol);

        const [result] = await db.query(
            `INSERT INTO employees (
                id, name, gender, position, department, email, phone, join_date, dob, nationality,
                salary, status, avatar, username, password_hash, role, shift_id,
                off_day, break_time, address, emergency_contact_name, emergency_contact_phone,
                bank_name, bank_account_name, bank_account_number, bank_qr_code,
                cv_document, id_card_document, annual_leave_total, annual_leave_used,
                resigned_reason
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, 
                ?, ?, ?, ?, 
                ?
            )`,
            [
                id, name, gender || 'Male', position, department, email, phone, validJoinDate, validDob, nationality,
                cleanSalary, status, physicalAvatar, username, passwordHash, role, shiftId,
                offDay, breakTime, address, emergencyContactName, emergencyContactPhone,
                bankName, bankAccountName, bankAccountNumber, physicalQrCode,
                physicalCv, physicalIdCard, 18, 0,
                resigned_reason || null
            ]
        );

        const [rows] = await db.query('SELECT * FROM employees WHERE id = ?', [id]);
        const employee = rows[0];

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionCreateEmployee',
            `Created employee: ${employee.name} (ID: ${employee.id})`,
            'categoryEmployee'
        );

        res.status(201).json(snakeToCamel(employee));
    } catch (err) {
        console.error('Create Error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// PUT update employee
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const isManager = ['super_admin', 'system_manager', 'hr', 'admin'].includes(req.user.role);
        if (!isManager) return res.status(403).json({ error: 'Permission denied. Management only.' });
        const { id } = req.params;
        const isSelf = String(req.user.id) === String(id);

        if (!isManager && !isSelf) {
            return res.status(403).json({ error: 'Permission denied. Management only.' });
        }
        const {
            name, gender, position, department, email, phone, joinDate, dob, nationality,
            salary, status, avatar, username, password, role, shiftId,
            offDay, breakTime, address, emergencyContactName, emergencyContactPhone,
            bankName, bankAccountName, bankAccountNumber, bankQrCode,
            cvDocument, idCardDocument, annualLeaveTotal, annualLeaveUsed
        } = req.body;
        const resigned_reason = req.body.resigned_reason || req.body.resignedReason;


        // Check for duplicate username or email (excluding current employee)
        const [existing] = await db.query(
            'SELECT id, name, username, email FROM employees WHERE (username = ? OR email = ?) AND id != ?',
            [username, email, id]
        );

        if (existing.length > 0) {
            const match = existing[0];
            const field = match.username === username ? 'Username' : 'Email';
            return res.status(409).json({
                error: `${field} "${field === 'Username' ? username : email}" belongs to ${match.name}.`
            });
        }

        const validJoinDate = joinDate ? joinDate : null;
        const validDob = dob ? dob : null;

        // Sanitize numbers
        const safeLeaveTotal = (annualLeaveTotal === undefined || annualLeaveTotal === null) ? 18 : annualLeaveTotal;
        const safeLeaveUsed = (annualLeaveUsed === undefined || annualLeaveUsed === null) ? 0 : annualLeaveUsed;
        const cleanSalary = Number(salary) || 0;

        // Sanitize optional fields - convert undefined to null
        const safeAvatar = avatar !== undefined ? avatar : null;
        const safeOffDay = offDay !== undefined ? offDay : null;
        const safeBreakTime = breakTime !== undefined ? breakTime : null;
        const safeAddress = address !== undefined ? address : null;
        const safeEmergencyName = emergencyContactName !== undefined ? emergencyContactName : null;
        const safeEmergencyPhone = emergencyContactPhone !== undefined ? emergencyContactPhone : null;
        const safeBankName = bankName !== undefined ? bankName : null;
        const safeBankAccountName = bankAccountName !== undefined ? bankAccountName : null;
        const safeBankAccountNumber = bankAccountNumber !== undefined ? bankAccountNumber : null;
        const safeBankQrCode = bankQrCode !== undefined ? bankQrCode : null;
        const safeCvDocument = cvDocument !== undefined ? cvDocument : null;
        const safeIdCardDocument = idCardDocument !== undefined ? idCardDocument : null;

        // Handle password update if provided
        let passwordUpdate = '';
        const params = [
            name, gender || 'Male', position, department, email, phone,
            validJoinDate, validDob, nationality, cleanSalary, status,
            safeAvatar, username, role, shiftId,
            safeOffDay, safeBreakTime, safeAddress,
            safeEmergencyName, safeEmergencyPhone,
            safeBankName, safeBankAccountName, safeBankAccountNumber, safeBankQrCode,
            safeCvDocument, safeIdCardDocument,
            safeLeaveTotal, safeLeaveUsed
        ];

        if (password && password.length > 0) {
            const bcrypt = require('bcryptjs');
            // 🛡️ Prevent double-hashing: If it looks like a bcrypt hash ($2a$ or $2b$), don't re-hash it
            const isAlreadyHash = (password.startsWith('$2a$') || password.startsWith('$2b$')) && password.length >= 60;

            if (!isAlreadyHash) {
                const passwordHash = await bcrypt.hash(password, 10);
                passwordUpdate = ', password_hash = ?';
                params.push(passwordHash);
            }
        }

        params.push(id);

        // Ensure all files are stored physically on disk
        const host = req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;

        const physicalAvatar = await ensurePhysicalFile(avatar, 'avatar', host, protocol);
        const physicalQrCode = await ensurePhysicalFile(bankQrCode, 'qr', host, protocol);
        const physicalCv = await ensurePhysicalFile(cvDocument, 'cv', host, protocol);
        const physicalIdCard = await ensurePhysicalFile(idCardDocument, 'id', host, protocol);

        const [result] = await db.query(
            `UPDATE employees SET
                name = ?, gender = ?, position = ?, department = ?, email = ?, phone = ?,
                join_date = ?, dob = ?, nationality = ?, salary = ?, status = ?,
                avatar = ?, username = ?, role = ?, shift_id = ?,
                off_day = ?, break_time = ?, address = ?,
                emergency_contact_name = ?, emergency_contact_phone = ?,
                bank_name = ?, bank_account_name = ?, bank_account_number = ?, bank_qr_code = ?,
                cv_document = ?, id_card_document = ?,
                annual_leave_total = ?, annual_leave_used = ?,
                resigned_reason = ?,
                updated_at = CURRENT_TIMESTAMP
                ${passwordUpdate}
            WHERE id = ?`,
            [
                name, gender || 'Male', position, department, email, phone,
                validJoinDate, validDob, nationality, cleanSalary, status,
                physicalAvatar, username, role, shiftId,
                safeOffDay, safeBreakTime, safeAddress,
                safeEmergencyName, safeEmergencyPhone,
                safeBankName, safeBankAccountName, safeBankAccountNumber, physicalQrCode,
                physicalCv, physicalIdCard,
                safeLeaveTotal, safeLeaveUsed,
                resigned_reason || null,
                ...(passwordUpdate ? [params[params.length - 2]] : []),
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        const [rows] = await db.query('SELECT * FROM employees WHERE id = ?', [id]);
        const employee = rows[0];

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionUpdateEmployee',
            `Updated employee: ${employee.name} (ID: ${employee.id})`,
            'categoryEmployee'
        );

        // Send Telegram notification if the employee became resigned
        if (status === 'លាឈប់' || status === 'Resigned') {
            const telegramMsg = `👋 *Employee Resigned*\n━━━━━━━━━━━━━━\n👤 Name: *${employee.name}*\n📝 Reason: ${resigned_reason || 'Not specified'}\n👤 By: ${req.user.name}\n━━━━━━━━━━━━━━`;
            sendNotification(telegramMsg);
        }

        res.json(snakeToCamel(employee));
    } catch (err) {
        console.error('Update Error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// DELETE employee (Soft Delete - Move to Trash)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const isManager = ['super_admin', 'system_manager', 'hr', 'admin'].includes(req.user.role);
        if (!isManager) return res.status(403).json({ error: 'Permission denied. Management only.' });

        const { id } = req.params;
        const [result] = await db.query('UPDATE employees SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json({ message: 'Employee moved to trash' });

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionDeleteEmployee',
            `Moved employee ID ${id} to trash`,
            'categoryEmployee'
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// RESTORE employee from trash
router.post('/:id/restore', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('UPDATE employees SET deleted_at = NULL WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json({ message: 'Employee restored successfully' });

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionRestoreEmployee',
            `Restored employee ID ${id} from trash`,
            'categoryEmployee'
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// FORCE DELETE employee (Permanent deletion)
router.delete('/:id/force', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM employees WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json({ message: 'Employee permanently deleted' });

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionForceDeleteEmployee',
            `Permanently deleted employee ID ${id}`,
            'categoryEmployee'
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST update password
router.post('/:id/password', async (req, res) => {
    try {
        const { id } = req.params;
        const { password, newPassword } = req.body;

        const finalPassword = newPassword || password;

        if (!finalPassword) {
            return res.status(400).json({ error: 'Password is required' });
        }

        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash(finalPassword, 10);

        const [result] = await db.query(
            'UPDATE employees SET password_hash = ? WHERE id = ?',
            [passwordHash, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Password Update Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
