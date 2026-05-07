const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { snakeToCamel } = require('../utils/mapKeys');
const { authenticateToken } = require('../utils/authMiddleware');
const { sendNotification } = require('../services/telegramService');

// GET all warnings
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM warnings ORDER BY created_at DESC');
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET warnings by Employee ID
router.get('/employee/:employee_id', authenticateToken, async (req, res) => {
    try {
        const { employee_id } = req.params;
        const [rows] = await db.query('SELECT * FROM warnings WHERE employee_id = ? ORDER BY created_at DESC', [employee_id]);
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST new warning
router.post('/', authenticateToken, async (req, res) => {
    try {
        if (!['super_admin', 'admin', 'hr', 'system_manager'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Permission denied. Unauthorized role.' });
        }
        const { id, reason, severity } = req.body;
        const employeeId = req.body.employeeId || req.body.employee_id;
        const issuedBy = req.user.name || 'Admin';
        const wid = id || Math.random().toString(36).substr(2, 9);
        const date = new Date().toISOString().split('T')[0];

        await db.query(
            'INSERT INTO warnings (id, employee_id, issued_by, date, reason, severity, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [wid, employeeId, issuedBy, date, reason, severity, 'រង់ចាំ']
        );

        // Fetch employee name for notification
        const [empRows] = await db.query('SELECT name FROM employees WHERE id = ?', [employeeId]);
        const empName = empRows[0]?.name || 'Employee';

        // 1. Send Telegram Notification
        const severityEmoji = severity === 'ធ្ងន់ធ្ងរ' ? '🔴' : severity === 'មធ្យម' ? '🟡' : '⚪';
        const telegramMsg = `⚠️ *Staff Warning Issued*\n━━━━━━━━━━━━━━\n👤 To: *${empName}*\n⚖️ Severity: ${severityEmoji} *${severity}*\n📝 Reason: ${reason}\n👤 Issued By: *${issuedBy}*\n━━━━━━━━━━━━━━`;
        sendNotification(telegramMsg);

        // 2. Create In-App Notification for the Employee
        const nid = Math.random().toString(36).substr(2, 9);
        await db.query(
            'INSERT INTO notifications (id, title, message, target_type, target_value, priority, pushed_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nid, 'Staff Warning Received', `You have received a ${severity} warning from ${issuedBy}. Reason: ${reason}`, 'individual', employeeId, severity === 'ធ្ងន់ធ្ងរ' ? 'high' : 'normal', issuedBy]
        );

        const [rows] = await db.query('SELECT * FROM warnings WHERE id = ?', [wid]);
        res.status(201).json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update warning status
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const [result] = await db.query(
            'UPDATE warnings SET status = ? WHERE id = ?',
            [status, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Warning not found' });
        }
        const [rows] = await db.query('SELECT * FROM warnings WHERE id = ?', [id]);
        res.json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE warning
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        if (!['super_admin', 'admin', 'hr', 'system_manager'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Permission denied. Unauthorized role.' });
        }
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM warnings WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Warning not found' });
        }
        res.json({ message: 'Warning deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
