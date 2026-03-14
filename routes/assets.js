const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { snakeToCamel } = require('../utils/mapKeys');
const { logAction } = require('../utils/auditLogger');
const { authenticateToken } = require('../utils/authMiddleware');
const { ensurePhysicalFile } = require('../utils/fileHandler');
const { sendNotification } = require('../services/telegramService');

db.query('ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT NULL')
    .catch(() => {});
db.query('ALTER TABLE assets ADD COLUMN IF NOT EXISTS changed_by VARCHAR(100) DEFAULT NULL')
    .catch(() => {});

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

        if (code) {
            const [existing] = await db.query('SELECT code FROM assets WHERE code = ?', [code]);
            if (existing.length > 0) {
                return res.status(409).json({ error: `Asset with code "${code}" already exists.` });
            }
        }

        const sid = id || Math.random().toString(36).substr(2, 9);
        const sprice = Number(price) || 0;
        const spurchaseDate = purchaseDate || null;
        const user = req.user.name || req.user.id;

        // Ensure image is stored physically on disk
        const host = req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const physicalImage = await ensurePhysicalFile(image, 'asset', host, protocol);

        await db.query(
            'INSERT INTO assets (id, code, name, category, brand, model, serial_number, status, condition, purchase_date, price, image, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [sid, code, name, category, brand, model, serialNumber, status, condition, spurchaseDate, sprice, physicalImage, user]
        );

        const [rows] = await db.query('SELECT * FROM assets WHERE id = ?', [sid]);
        const asset = rows[0];

        // Telegram Alert
        const telegramMessage = `📦 *New Asset Registered*\n━━━━━━━━━━━━━━\n🏷️ Name: *${name}*\n🔢 Code: #${code}\n📁 Category: ${category}\n👤 Created by: ${user}\n━━━━━━━━━━━━━━`;
        sendNotification(telegramMessage);

        await logAction(req.user.id, req.user.role, 'actionCreateAsset', `Added asset: ${asset.name} (Code: ${asset.code})`, 'categoryAsset');
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
        const user = req.user.name || req.user.id;

        const [result] = await db.query(
            'UPDATE assets SET name = ?, status = ?, condition = ?, assigned_to_id = ?, changed_by = ? WHERE id = ?',
            [name || null, status || null, condition || null, assigned_to_id || null, user, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        const [rows] = await db.query('SELECT * FROM assets WHERE id = ?', [id]);
        const asset = rows[0];

        // Telegram Alert for Status Change
        const telegramMessage = `⚙️ *Asset Status Updated*\n━━━━━━━━━━━━━━\n🏷️ Asset: *${asset.name}* (#${asset.code})\n📊 New Status: *${status}*\n🛠️ Condition: ${condition}\n👤 Changed by: ${user}\n━━━━━━━━━━━━━━`;
        sendNotification(telegramMessage);

        await logAction(req.user.id, req.user.role, 'actionUpdateAsset', `Updated asset: ${asset.name} (ID: ${asset.id})`, 'categoryAsset');
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

        await logAction(req.user.id, req.user.role, 'actionDeleteAsset', `Deleted asset ID ${id}`, 'categoryAsset');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST assign asset
router.post('/assign', authenticateToken, async (req, res) => {
    try {
        const { id, asset_id, employee_id, notes } = req.body;
        const user = req.user.name || req.user.id;

        const aid = id || Math.random().toString(36).substr(2, 9);
        await db.query(
            'INSERT INTO asset_assignments (id, asset_id, employee_id, notes) VALUES (?, ?, ?, ?)',
            [aid, asset_id, employee_id, notes]
        );

        await db.query(
            'UPDATE assets SET status = ?, assigned_to_id = ?, changed_by = ? WHERE id = ?',
            ['Assigned', employee_id, user, asset_id]
        );

        // Fetch names for Telegram
        const [assetRows] = await db.query('SELECT name, code FROM assets WHERE id = ?', [asset_id]);
        const [empRows] = await db.query('SELECT name FROM employees WHERE id = ?', [employee_id]);
        
        const assetName = assetRows[0]?.name || 'Unknown';
        const assetCode = assetRows[0]?.code || 'N/A';
        const empName = empRows[0]?.name || 'Unknown';

        const telegramMessage = `🤝 *Asset Assigned*\n━━━━━━━━━━━━━━\n🏷️ Asset: *${assetName}* (#${assetCode})\n👤 To Employee: *${empName}*\n📝 Notes: ${notes || '-'}\n✍️ Authorized by: ${user}\n━━━━━━━━━━━━━━`;
        sendNotification(telegramMessage);

        res.status(201).json({ message: 'Asset assigned successfully' });
        await logAction(req.user.id, req.user.role, 'actionAssignAsset', `Assigned asset ${asset_id} to employee ${employee_id}`, 'categoryAsset');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT return asset
router.put('/return/:assignment_id', authenticateToken, async (req, res) => {
    try {
        const { assignment_id } = req.params;
        const { asset_id } = req.body;
        const user = req.user.name || req.user.id;

        await db.query(
            'UPDATE asset_assignments SET status = ?, returned_date = CURRENT_TIMESTAMP WHERE id = ?',
            ['Returned', assignment_id]
        );

        if (asset_id) {
            await db.query(
                'UPDATE assets SET status = ?, assigned_to_id = NULL, changed_by = ? WHERE id = ?',
                ['Available', user, asset_id]
            );

            // Telegram Alert
            const [assetRows] = await db.query('SELECT name, code FROM assets WHERE id = ?', [asset_id]);
            const assetName = assetRows[0]?.name || 'Unknown';
            const assetCode = assetRows[0]?.code || 'N/A';
            
            const telegramMessage = `🔙 *Asset Returned*\n━━━━━━━━━━━━━━\n🏷️ Asset: *${assetName}* (#${assetCode})\n📊 Status: Available\n👤 Handled by: ${user}\n━━━━━━━━━━━━━━`;
            sendNotification(telegramMessage);
        }

        res.json({ message: 'Asset returned successfully' });
        await logAction(req.user.id, req.user.role, 'actionReturnAsset', `Returned asset ${asset_id} (Assignment: ${assignment_id})`, 'categoryAsset');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

