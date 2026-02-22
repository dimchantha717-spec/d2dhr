const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { snakeToCamel } = require('../utils/mapKeys');
const { logAction } = require('../utils/auditLogger');
const { authenticateToken } = require('../utils/authMiddleware');

// GET all assets
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM assets ORDER BY created_at DESC');
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET asset by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM assets WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        res.json(snakeToCamel(rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST new asset
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { id, code, name, category, brand, model, serialNumber, status, condition, purchaseDate, price, image } = req.body;

        // Check for duplicate code
        if (code) {
            const [existing] = await db.query('SELECT code FROM assets WHERE code = ?', [code]);
            if (existing.length > 0) {
                return res.status(409).json({ error: `Asset with code "${code}" already exists.` });
            }
        }

        const sid = id || Math.random().toString(36).substr(2, 9);
        const sprice = Number(price) || 0;
        const spurchaseDate = purchaseDate || null;

        await db.query(
            'INSERT INTO assets (id, code, name, category, brand, model, serial_number, status, condition, purchase_date, price, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [sid, code, name, category, brand, model, serialNumber, status, condition, spurchaseDate, sprice, image]
        );

        const [rows] = await db.query('SELECT * FROM assets WHERE id = ?', [sid]);
        const asset = rows[0];

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionCreateAsset',
            `Added asset: ${asset.name} (Code: ${asset.code})`,
            'categoryAsset'
        );

        res.status(201).json(snakeToCamel(asset));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update asset
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, status, condition, assigned_to_id } = req.body;

        const [result] = await db.query(
            'UPDATE assets SET name = ?, status = ?, condition = ?, assigned_to_id = ? WHERE id = ?',
            [name, status, condition, assigned_to_id, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        const [rows] = await db.query('SELECT * FROM assets WHERE id = ?', [id]);
        const asset = rows[0];

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionUpdateAsset',
            `Updated asset: ${asset.name} (ID: ${asset.id})`,
            'categoryAsset'
        );

        res.json(snakeToCamel(asset));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE asset
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM assets WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        res.json({ message: 'Asset deleted' });

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionDeleteAsset',
            `Deleted asset ID ${id}`,
            'categoryAsset'
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- Asset Assignments ---

// POST assign asset
router.post('/assign', authenticateToken, async (req, res) => {
    try {
        const { id, asset_id, employee_id, notes } = req.body;

        // Start transaction (ideally)
        // 1. Create assignment record
        await db.query(
            'INSERT INTO asset_assignments (id, asset_id, employee_id, notes) VALUES (?, ?, ?, ?)',
            [id, asset_id, employee_id, notes]
        );

        // 2. Update asset status
        await db.query(
            'UPDATE assets SET status = ?, assigned_to_id = ? WHERE id = ?',
            ['Assigned', employee_id, asset_id]
        );

        res.status(201).json({ message: 'Asset assigned successfully' });

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionAssignAsset',
            `Assigned asset ${asset_id} to employee ${employee_id}`,
            'categoryAsset'
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT return asset
router.put('/return/:assignment_id', authenticateToken, async (req, res) => {
    try {
        const { assignment_id } = req.params;
        const { asset_id } = req.body; // Need asset_id to update asset table

        // 1. Update assignment
        await db.query(
            'UPDATE asset_assignments SET status = ?, returned_date = CURRENT_TIMESTAMP WHERE id = ?',
            ['Returned', assignment_id]
        );

        // 2. Update asset table
        if (asset_id) {
            await db.query(
                'UPDATE assets SET status = ?, assigned_to_id = NULL WHERE id = ?',
                ['Available', asset_id]
            );
        }

        res.json({ message: 'Asset returned successfully' });

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionReturnAsset',
            `Returned asset ${asset_id} (Assignment: ${assignment_id})`,
            'categoryAsset'
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
