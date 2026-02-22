const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { logAction } = require('../utils/auditLogger');
const { authenticateToken } = require('../utils/authMiddleware');

// GET all settings
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM system_settings');
        // Convert rows to a key-value object if easier for frontend, or return as array
        // Returning array for now
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST/PUT setting
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { key, value } = req.body;
        // Check if exists
        const [checkRows] = await db.query('SELECT * FROM system_settings WHERE `key` = ?', [key]);

        if (checkRows.length > 0) {
            // Update
            await db.query('UPDATE system_settings SET value = ? WHERE `key` = ?', [value, key]);
        } else {
            // Insert
            await db.query('INSERT INTO system_settings (`key`, value) VALUES (?, ?)', [key, value]);
        }

        const [finalRows] = await db.query('SELECT * FROM system_settings WHERE `key` = ?', [key]);
        const setting = finalRows[0];

        // Audit Log
        const logVal = typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value;
        await logAction(
            req.user.id,
            req.user.role,
            'actionUpdateSetting',
            `Updated setting: ${key} to value: ${logVal}`,
            'categorySetting'
        );

        res.json(setting);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
