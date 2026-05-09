const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { snakeToCamel } = require('../utils/mapKeys');
const { logAction } = require('../utils/auditLogger');
const { authenticateToken } = require('../utils/authMiddleware');
const { sendNotification } = require('../services/telegramService');
const { ensurePhysicalFile } = require('../utils/fileHandler');

const parseDate = (t) => {
    if (!t) return new Date(NaN);
    if (t instanceof Date) return t;
    let str = String(t);
    // Convert "YYYY-MM-DD HH:mm:ss" to "YYYY-MM-DDTHH:mm:ss"
    if (str.includes(' ') && !str.includes('T')) {
        str = str.replace(' ', 'T');
    }
    // If it's a date-time string without a timezone, assume Asia/Phnom_Penh (+07:00)
    if (str.length >= 10 && !str.includes('Z') && !/[+-]\d{2}:\d{2}$/.test(str)) {
        // Only append if it has a time part
        if (str.includes('T')) {
            str += '+07:00';
        }
    }
    return new Date(str);
};

const formatToDb = (t) => {
    if (!t) return null;
    const d = parseDate(t);
    if (isNaN(d.getTime())) return String(t);
    
    // Always format using Cambodia time (UTC+7)
    const options = { 
        timeZone: 'Asia/Phnom_Penh', 
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false 
    };
    
    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(d);
    const getPart = (type) => parts.find(p => p.type === type).value;
    
    // Return YYYY-MM-DD HH:mm:ss
    return `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
};

const timeToMin = (t) => {
    const d = parseDate(t);
    if (!isNaN(d.getTime())) {
        const options = { timeZone: 'Asia/Phnom_Penh', hour: '2-digit', minute: '2-digit', hour12: false };
        const timeStr = new Intl.DateTimeFormat('en-GB', options).format(d);
        const [h, m] = timeStr.split(':');
        return parseInt(h) * 60 + parseInt(m);
    }
    const str = String(t);
    const timePart = str.includes(' ') ? str.split(' ')[1] : str;
    const parts = timePart.split(':');
    if (parts.length < 2) return 0;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
};

/**
 * Automatically repairs and merges attendance records for a specific employee and date.
 * Ensures timestamps are correctly slotted into Morning-In, Lunch-Out, Afternoon-In, and Work-End.
 */
async function autoRepairRecord(employeeId, date) {
    try {
        const [records] = await db.query(
            'SELECT * FROM attendance_records WHERE employee_id = ? AND date = ? ORDER BY created_at ASC',
            [employeeId, date]
        );

        if (records.length === 0) return;

        // Fetch employee's shift and break time for smart slotting
        const [empRows] = await db.query('SELECT shift_id, break_time FROM employees WHERE id = ?', [employeeId]);
        if (empRows.length === 0) return;
        
        const [shiftRows] = await db.query('SELECT * FROM shifts WHERE id = ?', [empRows[0].shift_id]);
        const shift = shiftRows.length > 0 ? shiftRows[0] : null;
        
        // Follow the Work Schedule: 
        // 1. Check employee-specific break time
        // 2. Fall back to shift break time
        // 3. If neither exists, breakTime will be null (leading to 2-scan workflow)
        const breakTime = empRows[0].break_time || (shift ? shift.break_time : null);

        const allTimes = [];
        let photos = [];
        let status = 'មកទាន់ពេល';
        let lat = records[0].latitude;
        let lng = records[0].longitude;

        // Collect all scan timestamps
        for (const r of records) {
            // Priority 1: Explicitly recorded times
            if (r.check_in) allTimes.push(r.check_in);
            if (r.check_in2) allTimes.push(r.check_in2);
            if (r.check_out) allTimes.push(r.check_out);
            if (r.check_out2) allTimes.push(r.check_out2);
            
            // Priority 2: Fallback to created_at if no times were recorded (due to bugs)
            // But only if it's the same date as the record date
            if (!r.check_in && !r.check_in2 && !r.check_out && !r.check_out2 && r.created_at) {
                allTimes.push(r.created_at);
            }

            if (r.photo) photos.push(r.photo);
            if (r.status === 'យឺត' || r.status === 'ចេញមុន') status = r.status;
            if (r.latitude && !lat) lat = r.latitude;
            if (r.longitude && !lng) lng = r.longitude;
        }

        const shiftStartMin = shift ? timeToMin(shift.start_time) : 480;

        // Self-Healing: Detect if timestamps are in UTC (7 hours behind)
        // If all scans are suspiciously early (e.g., 1 AM when shift is 8 AM), shift them +7h
        const uniqueTimes = [...new Set(allTimes.map(t => parseDate(t).getTime()))]
            .filter(t => !isNaN(t))
            .sort((a, b) => a - b)
            .map(ts => {
                const d = new Date(ts);
                const m = timeToMin(d);
                // If scan is > 5 hours before shift start, it's likely a UTC leak
                if (m < shiftStartMin - 300) {
                    return new Date(ts + 7 * 60 * 60 * 1000);
                }
                return d;
            });

        const hasLunchBreak = (() => {
            if (!breakTime || typeof breakTime !== 'string') return false;
            const cleaned = breakTime.trim().toLowerCase();
            return cleaned !== 'none' && cleaned !== 'null' && cleaned !== '0' && cleaned.includes('-');
        })();

        const lunchStart = breakTime.includes('-') ? timeToMin(breakTime.split('-')[0]) : 720;
        const lunchEnd = breakTime.includes('-') ? timeToMin(breakTime.split('-')[1]) : 780;

        const slots = { check_in: null, check_out: null, check_in2: null, check_out2: null };

        uniqueTimes.forEach(t => {
            const m = timeToMin(t);
            
            // 1. Logic for Employees WITHOUT Lunch Break (2-scan workflow)
            if (!hasLunchBreak) {
                if (!slots.check_in) slots.check_in = t;
                else slots.check_out = t; // Multiple scans will update the final check-out
                return;
            }

            // 2. Logic for Employees WITH Lunch Break (4-scan workflow)
            if (m < lunchStart + 15) { 
                if (!slots.check_in) slots.check_in = t;
                else slots.check_out = t;
            } else if (m > lunchEnd - 15) { 
                if (!slots.check_in2) slots.check_in2 = t;
                else slots.check_out2 = t;
            } else {
                if (Math.abs(m - lunchStart) < Math.abs(m - lunchEnd)) slots.check_out = t;
                else slots.check_in2 = t;
            }
        });

        const primaryId = records[0].id;
        await db.query(
            'UPDATE attendance_records SET check_in = ?, check_out = ?, check_in2 = ?, check_out2 = ?, status = ?, photo = ?, latitude = ?, longitude = ? WHERE id = ?',
            [formatToDb(slots.check_in), formatToDb(slots.check_out), formatToDb(slots.check_in2), formatToDb(slots.check_out2), status, photos[0] || null, lat, lng, primaryId]
        );

        if (records.length > 1) {
            const otherIds = records.slice(1).map(r => r.id);
            await db.query('DELETE FROM attendance_records WHERE id IN (?)', [otherIds]);
        }
    } catch (err) {
        console.error('Auto-repair failed:', err);
    }
}

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
        if (!validCheckIn) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-GB', { 
                timeZone: 'Asia/Phnom_Penh',
                hour: '2-digit', minute: '2-digit', second: '2-digit', 
                hour12: false 
            });
            validCheckIn = `${date} ${timeStr}`;
        } else if (date && checkIn && !checkIn.includes('T') && checkIn.length < 15) {
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
            let updateValue = validCheckIn || `${date} ${new Date().toLocaleTimeString('en-GB', { 
                timeZone: 'Asia/Phnom_Penh',
                hour: '2-digit', minute: '2-digit', second: '2-digit', 
                hour12: false 
            })}`;

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
            
            // Auto-repair after update to ensure slots are correct
            await autoRepairRecord(employeeId, date);

            const [finalRows] = await db.query('SELECT * FROM attendance_records WHERE employee_id = ? AND date = ?', [employeeId, date]);
            return res.json({ message: 'Attendance updated successfully', id: record.id, type: 'update', ...snakeToCamel(finalRows[0]) });
        }

        const finalStatus = status || 'មកទាន់ពេល';
        await db.query(
            'INSERT INTO attendance_records (id, employee_id, date, check_in, check_in2, status, latitude, longitude, photo, is_holiday_work, ot_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [recordId, employeeId, date, validCheckIn, validCheckIn2 || null, finalStatus, lat, lng, physicalPhoto, isHolidayWork || false, otHours || 0]
        );

        // Auto-repair immediately after scan to fix slots and merge any accidental duplicates
        await autoRepairRecord(employeeId, date);

        // Re-fetch the record AFTER auto-repair to get the slotted times and correct status
        // IMPORTANT: Fetch by employeeId and date because the original recordId might have been merged/deleted
        const [rows] = await db.query('SELECT * FROM attendance_records WHERE employee_id = ? AND date = ?', [employeeId, date]);

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

// Maintenance route to fix duplicates and re-slot records
router.post('/maintenance/:action', authenticateToken, async (req, res) => {
    if (!['super_admin', 'system_manager'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const { action } = req.params;
        const [groups] = await db.query(`
            SELECT employee_id, date, COUNT(*) as count 
            FROM attendance_records 
            GROUP BY employee_id, date 
            HAVING count > 1 OR ? = 're-slot'
        `, [action]);

        let fixedCount = 0;
        let details = [];

        for (const group of groups) {
            const { employee_id, date } = group;
            await autoRepairRecord(employee_id, date);
            fixedCount++;
            details.push({ employee_id, date });
        }

        res.json({ message: 'Maintenance completed successfully', fixedGroups: fixedCount, processed: details.length });

    } catch (err) {
        console.error('Maintenance error:', err);
        res.status(500).json({ error: 'Maintenance failed' });
    }
});



module.exports = { router, autoRepairRecord };
