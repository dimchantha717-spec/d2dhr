const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { snakeToCamel } = require('../utils/mapKeys');
const { sendNotification } = require('../services/telegramService');
const { ensurePhysicalFile } = require('../utils/fileHandler');

// GET all outdoor activities
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM outdoor_sale_activities ORDER BY created_at DESC');
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET activities by Employee ID
router.get('/employee/:employee_id', async (req, res) => {
    try {
        const { employee_id } = req.params;
        const [rows] = await db.query('SELECT * FROM outdoor_sale_activities WHERE employee_id = ? ORDER BY created_at DESC', [employee_id]);
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST new outdoor activity
router.post('/', async (req, res) => {
    try {
        const { id, employeeId, customerName, date, checkInTime, latitude, longitude, photo, notes, status } = req.body;

        const recordId = id || Math.random().toString(36).substr(2, 9);

        // Ensure photo is stored physically on disk
        const host = req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const physicalPhoto = await ensurePhysicalFile(photo, 'outdoor', host, protocol);

        let validCheckIn = checkInTime;
        if (date && checkInTime && !checkInTime.includes('T') && checkInTime.length < 15) {
            validCheckIn = `${date} ${checkInTime}:00`;
        }

        await db.query(
            'INSERT INTO outdoor_sale_activities (id, employee_id, customer_name, date, check_in_time, latitude, longitude, photo, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [recordId, employeeId, customerName, date, validCheckIn, latitude, longitude, physicalPhoto, notes, status]
        );

        const [rows] = await db.query('SELECT * FROM outdoor_sale_activities WHERE id = ?', [recordId]);
        const activity = rows[0];

        // Telegram Alert
        const [empRows] = await db.query('SELECT name FROM employees WHERE id = ?', [employeeId]);
        const empName = empRows[0]?.name || 'Unknown';
        
        const mapLink = (latitude && longitude) ? `\n📍 [View Location](https://maps.google.com/?q=${latitude},${longitude})` : '';
        const telegramMessage = `📍 *Outdoor Sale: New Activity*\n━━━━━━━━━━━━━━\n👤 Employee: *${empName}*\n🏢 Customer: *${customerName}*\n📅 Date: ${date}\n⏰ Check-in: ${checkInTime}\n📝 Notes: ${notes || '-'}\n━━━━━━━━━━━━━━${mapLink}`;
        
        sendNotification(telegramMessage);

        res.status(201).json(snakeToCamel(activity));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update activity (Complete/Check-out)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { checkOutTime, status, notes, date } = req.body;

        let validCheckOut = checkOutTime;
        if (date && checkOutTime && !checkOutTime.includes('T') && checkOutTime.length < 15) {
            validCheckOut = `${date} ${checkOutTime}:00`;
        }

        const [result] = await db.query(
            'UPDATE outdoor_sale_activities SET check_out_time = ?, status = ?, notes = ? WHERE id = ?',
            [validCheckOut || null, status || null, notes || null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Activity not found' });
        }
        const [rows] = await db.query('SELECT * FROM outdoor_sale_activities WHERE id = ?', [id]);
        const activity = rows[0];

        // Telegram Alert for Completion
        if (status === 'Completed') {
            const [empRows] = await db.query('SELECT name FROM employees WHERE id = ?', [activity.employee_id]);
            const empName = empRows[0]?.name || 'Unknown';
            const telegramMessage = `✅ *Outdoor Sale: Completed*\n━━━━━━━━━━━━━━\n👤 Employee: *${empName}*\n🏢 Customer: *${activity.customer_name}*\n⏰ Check-out: ${checkOutTime || 'Now'}\n📝 Summary: ${notes || '-'}\n━━━━━━━━━━━━━━`;
            sendNotification(telegramMessage);
        }

        res.json(snakeToCamel(activity));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE activity
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM outdoor_sale_activities WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Activity not found' });
        }
        res.json({ message: 'Activity deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

