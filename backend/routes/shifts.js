const express = require('express');
const router = express.Router();
const db = require('../config/db');

const { snakeToCamel } = require('../utils/mapKeys');

// GET all shifts
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM shifts');
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET shift by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM shifts WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Shift not found' });
        }
        res.json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST new shift
router.post('/', async (req, res) => {
    try {
        const { id, name, startTime, endTime, breakTimeDuration } = req.body;
        const sid = id || Math.random().toString(36).substr(2, 9);
        await db.query(
            'INSERT INTO shifts (id, name, start_time, end_time, break_time_duration) VALUES (?, ?, ?, ?, ?)',
            [sid, name, startTime, endTime, breakTimeDuration]
        );
        const [rows] = await db.query('SELECT * FROM shifts WHERE id = ?', [sid]);
        res.status(201).json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update shift
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, startTime, endTime, breakTimeDuration } = req.body;
        const [result] = await db.query(
            'UPDATE shifts SET name = ?, start_time = ?, end_time = ?, break_time_duration = ? WHERE id = ?',
            [name, startTime, endTime, breakTimeDuration, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Shift not found' });
        }
        const [rows] = await db.query('SELECT * FROM shifts WHERE id = ?', [id]);
        res.json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE shift
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM shifts WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Shift not found' });
        }
        res.json({ message: 'Shift deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
