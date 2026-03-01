const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { snakeToCamel } = require('../utils/mapKeys');
const { logAction } = require('../utils/auditLogger');
const { authenticateToken } = require('../utils/authMiddleware');

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

        let validCheckIn = checkIn;
        if (date && checkIn && !checkIn.includes('T') && checkIn.length < 15) {
            validCheckIn = `${date} ${checkIn}:00`;
        }

        let validCheckIn2 = checkIn2;
        if (date && checkIn2 && !checkIn2.includes('T') && checkIn2.length < 15) {
            validCheckIn2 = `${date} ${checkIn2}:00`;
        }

        await db.query(
            'INSERT INTO attendance_records (id, employee_id, date, check_in, check_in2, status, latitude, longitude, photo, is_holiday_work, ot_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [recordId, employeeId, date, validCheckIn, validCheckIn2 || null, status, lat, lng, photo, isHolidayWork || false, otHours || 0]
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

module.exports = router;
