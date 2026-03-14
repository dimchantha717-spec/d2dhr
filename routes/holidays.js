const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET all public holidays
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM public_holidays ORDER BY date ASC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST new holiday
router.post('/', async (req, res) => {
    try {
        const { id, date, name } = req.body;
        await db.query(
            'INSERT INTO public_holidays (id, date, name) VALUES (?, ?, ?)',
            [id, date, name]
        );
        const [rows] = await db.query('SELECT * FROM public_holidays WHERE id = ?', [id]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE holiday
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM public_holidays WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Holiday not found' });
        }
        res.json({ message: 'Holiday deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
