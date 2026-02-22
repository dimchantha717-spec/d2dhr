const express = require('express');
const router = express.Router();
const db = require('../config/db');

const { snakeToCamel } = require('../utils/mapKeys');

// GET all reviews
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, e.name as employee_name, e.position, e.department, e.avatar
            FROM performance_reviews p
            JOIN employees e ON p.employee_id = e.id
            ORDER BY p.review_date DESC
        `);
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET reviews by employee ID
router.get('/employee/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(`
            SELECT p.*, e.name as reviewer_name
            FROM performance_reviews p
            LEFT JOIN employees e ON p.reviewer_id = e.id
            WHERE p.employee_id = ?
            ORDER BY p.review_date DESC
        `, [id]);
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST create review
router.post('/', async (req, res) => {
    try {
        const { employeeId, reviewerId, reviewDate, rating, comments, goals, status } = req.body;
        const id = Date.now().toString();

        await db.query(
            `INSERT INTO performance_reviews (id, employee_id, reviewer_id, review_date, rating, comments, goals, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                employeeId,
                reviewerId || 'system',
                reviewDate || new Date(),
                rating || 0,
                comments || '',
                goals || '',
                status || 'completed'
            ]
        );

        const [rows] = await db.query('SELECT * FROM performance_reviews WHERE id = ?', [id]);
        res.status(201).json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error('Create Review Error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// PUT update review
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comments, goals, status } = req.body;

        const [result] = await db.query(
            `UPDATE performance_reviews
             SET rating = ?, comments = ?, goals = ?, status = ?
             WHERE id = ?`,
            [rating, comments, goals, status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        const [rows] = await db.query('SELECT * FROM performance_reviews WHERE id = ?', [id]);
        res.json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error('Update Review Error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// DELETE review
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM performance_reviews WHERE id = ?', [id]);
        res.json({ message: 'Review deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
