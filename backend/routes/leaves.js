const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { snakeToCamel } = require('../utils/mapKeys');
const { logAction } = require('../utils/auditLogger');
const { authenticateToken } = require('../utils/authMiddleware');

// GET all leave requests
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM leave_requests ORDER BY created_at DESC');
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET leave requests by Employee ID
router.get('/employee/:employee_id', authenticateToken, async (req, res) => {
    try {
        const { employee_id } = req.params;
        const [rows] = await db.query('SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC', [employee_id]);
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST new leave request
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            id, employeeId, type, startDate, endDate, reason,
            evidencePhoto, evidenceAudio, lateDurationValue, lateDurationUnit,
            newBankName, newBankAccountName, newBankAccountNumber,
            duration
        } = req.body;

        // Generate ID if not provided
        const recordId = id || Date.now().toString();

        // Handling optional fields for specific types
        await db.query(
            `INSERT INTO leave_requests (
                id, employee_id, type, start_date, end_date, reason, 
                evidence_photo, evidence_audio, late_duration_value, late_duration_unit,
                new_bank_name, new_bank_account_name, new_bank_account_number,
                duration
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                recordId,
                employeeId || null,
                type || null,
                startDate || null,
                endDate || null,
                reason || null,
                evidencePhoto || null,
                evidenceAudio || null,
                lateDurationValue || null,
                lateDurationUnit || null,
                newBankName || null,
                newBankAccountName || null,
                newBankAccountNumber || null,
                duration || 'Full Day'
            ]
        );

        const [rows] = await db.query('SELECT * FROM leave_requests WHERE id = ?', [recordId]);

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionCreateLeave',
            `Created leave request: ${type} for employee ${employeeId}`,
            'categoryLeave'
        );

        res.status(201).json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update leave status (Approve/Reject)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Get the current request to check its type and employee_id before updating
        const [requestRows] = await db.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
        const leaveRequest = requestRows[0];

        if (!leaveRequest) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const [result] = await db.query(
            'UPDATE leave_requests SET status = ? WHERE id = ?',
            [status, id]
        );

        // If approved, trigger side effects based on request type
        if (status === 'អនុម័ត' || status === 'Approved') {
            const { type, employee_id, start_date, end_date, new_bank_name, new_bank_account_name, new_bank_account_number } = leaveRequest;

            if (type === 'ឈប់សម្រាកប្រចាំឆ្នាំ' || type === 'annualLeave' || type === 'Annual Leave') {
                // Fetch settings for public holidays and employee for off_day
                const [settingsRows] = await db.query('SELECT value FROM system_settings WHERE `key` = "attendance_settings"');
                const [empRows] = await db.query('SELECT off_day FROM employees WHERE id = ?', [employee_id]);

                let publicHolidays = [];
                if (settingsRows.length > 0) {
                    try {
                        const settings = JSON.parse(settingsRows[0].value);
                        publicHolidays = settings.publicHolidays || [];
                    } catch (e) { console.error('Failed to parse settings'); }
                }

                const offDay = empRows.length > 0 ? empRows[0].off_day : 'Sunday';

                // Calculate working days (excluding off-days and holidays)
                const start = new Date(start_date);
                const end = new Date(end_date);
                let diffDays = 0;

                const dayIndexMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
                const offDayIndex = dayIndexMap[offDay] ?? 0;

                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    const dateStr = d.toISOString().split('T')[0];
                    const isOffDay = d.getDay() === offDayIndex;
                    const isHoliday = publicHolidays.some(h => h.date === dateStr);

                    if (!isOffDay && !isHoliday) {
                        diffDays++;
                    }
                }

                if (diffDays > 0) {
                    // Check for half day
                    if (leaveRequest.duration === 'Morning' || leaveRequest.duration === 'Afternoon') {
                        diffDays = diffDays * 0.5;
                    }

                    await db.query(
                        'UPDATE employees SET annual_leave_used = annual_leave_used + ? WHERE id = ?',
                        [diffDays, employee_id]
                    );
                }
            } else if (type === 'ប្តូរព័ត៌មានធនាគារ' || type === 'changeBankInfoRequest' || type === 'Change Bank Info') {
                await db.query(
                    'UPDATE employees SET bank_name = ?, bank_account_name = ?, bank_account_number = ? WHERE id = ?',
                    [new_bank_name, new_bank_account_name, new_bank_account_number, employee_id]
                );
            } else if (type === 'លាឈប់' || type === 'resignationRequest' || type === 'Resignation') {
                await db.query(
                    'UPDATE employees SET status = "លាឈប់" WHERE id = ?',
                    [employee_id]
                );
            }
        }

        const [rows] = await db.query('SELECT * FROM leave_requests WHERE id = ?', [id]);

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionUpdateLeaveStatus',
            `Updated leave request ID ${id} to status: ${status}`,
            'categoryLeave'
        );

        res.json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE leave request
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM leave_requests WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }
        res.json({ message: 'Request deleted' });

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionDeleteLeave',
            `Deleted leave request ID ${id}`,
            'categoryLeave'
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
