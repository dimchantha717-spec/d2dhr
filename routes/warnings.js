const express = require('express');
const router = express.Router();
const db = require('../config/db');

const { snakeToCamel } = require('../utils/mapKeys');

// GET all warnings
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM warnings ORDER BY created_at DESC');
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET warnings by Employee ID
router.get('/employee/:employee_id', async (req, res) => {
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
router.post('/', async (req, res) => {
    try {
        const { id, employeeId, issuedBy, date, reason, severity, status } = req.body;
        const wid = id || Math.random().toString(36).substr(2, 9);
        await db.query(
            'INSERT INTO warnings (id, employee_id, issued_by, date, reason, severity, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [wid, employeeId, issuedBy, date, reason, severity, status]
        );
        const [rows] = await db.query('SELECT * FROM warnings WHERE id = ?', [wid]);
        res.status(201).json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update warning status
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
    try {
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
