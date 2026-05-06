const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { snakeToCamel } = require('../utils/mapKeys');
const { logAction } = require('../utils/auditLogger');
const { authenticateToken } = require('../utils/authMiddleware');
const { ensurePhysicalFile } = require('../utils/fileHandler');

// GET all attendance records
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM attendance_records ORDER BY created_at DESC');
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET attendance by Employee ID
router.get('/employee/:employee_id', authenticateToken, async (req, res) => {
    try {
        const { employee_id } = req.params;
        const [rows] = await db.query('SELECT * FROM attendance_records WHERE employee_id = ? ORDER BY date DESC', [employee_id]);
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST check-in/record attendance
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { id, employeeId, date, checkIn, checkIn2, status, lat, lng, photo, isHolidayWork, otHours } = req.body;

        const recordId = id || Date.now().toString();

        // Ensure photo is stored physically on disk
        const host = req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const physicalPhoto = await ensurePhysicalFile(photo, 'attendance', host, protocol);

        let validCheckIn = checkIn;
        if (date && checkIn && !checkIn.includes('T') && checkIn.length < 15) {
            validCheckIn = `${date} ${checkIn}:00`;
        }

        let validCheckIn2 = checkIn2;
        if (date && checkIn2 && !checkIn2.includes('T') && checkIn2.length < 15) {
            validCheckIn2 = `${date} ${checkIn2}:00`;
        }

        // Check if a record already exists for this employee and date
        const [existing] = await db.query('SELECT * FROM attendance_records WHERE employee_id = ? AND date = ?', [employeeId, date]);
        
        if (existing.length > 0) {
            const record = existing[0];
            let updateField = '';
            let updateValue = validCheckIn || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

            // Determine which field to update based on what's already filled
            if (!record.check_out) {
                updateField = 'check_out';
            } else if (!record.check_in2) {
                updateField = 'check_in2';
            } else if (!record.check_out2) {
                updateField = 'check_out2';
            } else {
                return res.status(400).json({ error: 'All attendance slots for today are already filled.' });
            }

            await db.query(`UPDATE attendance_records SET ${updateField} = ?, latitude = ?, longitude = ?, photo = ? WHERE id = ?`, 
                [updateValue, lat, lng, physicalPhoto, record.id]);
            
            return res.json({ message: 'Attendance updated successfully', id: record.id, type: 'update' });
        }

        await db.query(
            'INSERT INTO attendance_records (id, employee_id, date, check_in, check_in2, status, latitude, longitude, photo, is_holiday_work, ot_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [recordId, employeeId, date, validCheckIn, validCheckIn2 || null, status, lat, lng, physicalPhoto, isHolidayWork || false, otHours || 0]
        );

        const [rows] = await db.query('SELECT * FROM attendance_records WHERE id = ?', [recordId]);

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionAttendanceCheckIn',
            `Check-in recorded for Employee ${employeeId} on ${date}`,
            'categoryAttendance'
        );

        res.status(201).json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update attendance (e.g. check-out)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { checkOut, checkIn2, checkOut2, status, date, isHolidayWork, otHours } = req.body;

        let queryParts = [];
        let params = [];

        if (checkOut !== undefined) {
            let validCheckOut = checkOut;
            if (date && checkOut && !checkOut.includes('T') && checkOut.length < 15) {
                validCheckOut = `${date} ${checkOut}:00`;
            }
            queryParts.push('check_out = ?');
            params.push(validCheckOut);
        }

        if (checkIn2 !== undefined) {
            let validCheckIn2 = checkIn2;
            if (date && checkIn2 && !checkIn2.includes('T') && checkIn2.length < 15) {
                validCheckIn2 = `${date} ${checkIn2}:00`;
            }
            queryParts.push('check_in2 = ?');
            params.push(validCheckIn2);
        }

        if (checkOut2 !== undefined) {
            let validCheckOut2 = checkOut2;
            if (date && checkOut2 && !checkOut2.includes('T') && checkOut2.length < 15) {
                validCheckOut2 = `${date} ${checkOut2}:00`;
            }
            queryParts.push('check_out2 = ?');
            params.push(validCheckOut2);
        }

        if (status !== undefined) {
            queryParts.push('status = ?');
            params.push(status);
        }

        if (isHolidayWork !== undefined) {
            queryParts.push('is_holiday_work = ?');
            params.push(isHolidayWork);
        }

        if (otHours !== undefined) {
            queryParts.push('ot_hours = ?');
            params.push(otHours);
        }

        if (queryParts.length === 0) {
            return res.json({ message: 'No changes' });
        }

        params.push(id);
        const [result] = await db.query(
            `UPDATE attendance_records SET ${queryParts.join(', ')} WHERE id = ?`,
            params
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }

        const [rows] = await db.query('SELECT * FROM attendance_records WHERE id = ?', [id]);

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionAttendanceUpdate',
            `Updated attendance record ID ${id} (Status: ${status})`,
            'categoryAttendance'
        );

        res.json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE attendance record
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const isManager = ['super_admin', 'system_manager', 'hr', 'admin'].includes(req.user.role);
        if (!isManager) return res.status(403).json({ error: 'Permission denied. Management only.' });

        const { id } = req.params;
        const [result] = await db.query('DELETE FROM attendance_records WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }
        res.json({ message: 'Record deleted' });

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionAttendanceDelete',
            `Deleted attendance record ID ${id}`,
            'categoryAttendance'
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Maintenance route to fix duplicates on production
router.get('/maintenance/fix-duplicates', authenticateToken, async (req, res) => {
    if (!['super_admin', 'system_manager'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const [groups] = await db.query(`
            SELECT employee_id, date, COUNT(*) as count 
            FROM attendance_records 
            GROUP BY employee_id, date 
            HAVING count > 1
        `);

        let fixedCount = 0;
        for (const group of groups) {
            const { employee_id, date } = group;
            const [records] = await db.query(
                'SELECT * FROM attendance_records WHERE employee_id = ? AND date = ?',
                [employee_id, date]
            );

            let slots = {
                check_in: null,
                check_out: null,
                check_in2: null,
                check_out2: null,
                photo: null,
                status: 'មកទាន់ពេល'
            };

            const timeToMin = (t) => {
                if (!t || t === '--:--') return null;
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            for (const r of records) {
                // Merge Check-In (IN)
                if (r.check_in && r.check_in !== '--:--') {
                    const mins = timeToMin(r.check_in);
                    if (mins < 660) slots.check_in = r.check_in; // Before 11:00
                    else if (mins >= 660 && mins < 900) slots.check_in2 = r.check_in; // 11:00 - 15:00
                }
                
                // Merge Check-In 2 (If it exists in record)
                if (r.check_in2 && r.check_in2 !== '--:--') slots.check_in2 = r.check_in2;

                // Merge Check-Out (OUT)
                if (r.check_out && r.check_out !== '--:--') {
                    const mins = timeToMin(r.check_out);
                    if (mins < 840) slots.check_out = r.check_out; // Before 14:00
                    else slots.check_out2 = r.check_out; // After 14:00
                }
                
                // Merge Check-Out 2 (If it exists in record)
                if (r.check_out2 && r.check_out2 !== '--:--') slots.check_out2 = r.check_out2;

                if (r.photo && !slots.photo) slots.photo = r.photo;
                if (r.status === 'មកទាន់ពេល') slots.status = 'មកទាន់ពេល';
            }

            const primaryId = records[0].id;
            await db.query(
                'UPDATE attendance_records SET check_in = ?, check_out = ?, check_in2 = ?, check_out2 = ?, status = ?, photo = ? WHERE id = ?',
                [slots.check_in, slots.check_out, slots.check_in2, slots.check_out2, slots.status, slots.photo, primaryId]
            );

            const otherIds = records.slice(1).map(r => r.id);
            if (otherIds.length > 0) {
                await db.query('DELETE FROM attendance_records WHERE id IN (?)', [otherIds]);
            }
            
            fixedCount++;
        }

        res.json({ message: 'Cleanup completed successfully', fixedGroups: fixedCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Maintenance failed' });
    }
});

module.exports = router;
