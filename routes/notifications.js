const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { snakeToCamel } = require('../utils/mapKeys');
const { authenticateToken } = require('../utils/authMiddleware');
const { sendNotification } = require('../services/telegramService');


// GET all notifications
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM notifications ORDER BY date DESC');
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST new notification
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { id, title, message, targetType, targetValue, priority, image } = req.body;
        const pushedBy = req.user.name || 'Admin';
        const nid = id || Math.random().toString(36).substr(2, 9);

        await db.query(
            'INSERT INTO notifications (id, title, message, target_type, target_value, priority, pushed_by, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [nid, title, message, targetType, targetValue, priority || 'normal', pushedBy, image || null]
        );

        // Send Telegram notification
        const safePriority = priority || 'normal';
        const priorityEmoji = safePriority === 'high' ? '🚨' : '📢';
        const telegramMessage = `${priorityEmoji} *New Notification*\n\n*${title}*\n${message}\n\n👤 Posted by: *${pushedBy}*\n🔥 Priority: ${safePriority.toUpperCase()}`;
        sendNotification(telegramMessage);

        const [rows] = await db.query('SELECT * FROM notifications WHERE id = ?', [nid]);
        res.status(201).json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});


// PUT mark as read (if individual) or generally update
router.put('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = ?',
            [id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        const [rows] = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
        res.json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE notification
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM notifications WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json({ message: 'Notification deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
