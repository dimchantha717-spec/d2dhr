const express = require('express');
const router = express.Router();
const db = require('../config/db');

const { snakeToCamel } = require('../utils/mapKeys');

// GET all logs
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 1000'); // Limit to prevent overload
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST new log (Internal use mainly, but exposed just in case)
router.post('/', async (req, res) => {
    try {
        const { id, userId, userRole, action, details, category } = req.body;
        const aid = id || Math.random().toString(36).substr(2, 9);
        await db.query(
            'INSERT INTO audit_logs (id, user_id, user_role, action, details, category) VALUES (?, ?, ?, ?, ?, ?)',
            [aid, userId, userRole, action, details, category]
        );
        const [rows] = await db.query('SELECT * FROM audit_logs WHERE id = ?', [aid]);
        res.status(201).json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});


module.exports = router;
