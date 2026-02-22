const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../utils/authMiddleware');

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [rows] = await pool.query('SELECT * FROM employees WHERE username = ?', [username]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = rows[0];

        console.log(`🔐 Login Attempt: User=${user.username}, Status=${user.status}, Deleted=${!!user.deleted_at}`);

        // 🛡️ SECURITY TRUTH CHECK: Strictly block anything that is NOT explicitly 'សកម្ម' (Active)
        if (user.deleted_at || user.status !== 'សកម្ម') {
            console.log(`🚫 Login BLOCKED for User=${user.username}`);
            let errorMsg = 'Your account is disabled. (គណនីរបស់អ្នកត្រូវបានបិទ)';
            if (user.deleted_at) errorMsg = 'Your account has been deleted. (គណនីរបស់អ្នកត្រូវបានលុប)';
            else if (user.status === 'លាឈប់') errorMsg = 'Your account is disabled due to resignation. (គណនីរបស់អ្នកត្រូវបានបិទដោយសារលាឈប់)';

            return res.status(403).json({ error: errorMsg });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash).catch(() => false);
        const isPlainMatch = user.password_hash === password;

        if (!validPassword && !isPlainMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET || 'secret_key',
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
                avatar: user.avatar,
                status: user.status,
                department: user.department,
                position: user.position,
                email: user.email,
                phone: user.phone,
                joinDate: user.join_date,
                dob: user.dob,
                nationality: user.nationality,
                address: user.address,
                bankName: user.bank_name,
                bankAccountName: user.bank_account_name,
                bankAccountNumber: user.bank_account_number,
                bankQrCode: user.bank_qr_code,
                cvDocument: user.cv_document,
                idCardDocument: user.id_card_document,
                deletedAt: user.deleted_at
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Current User (Me)
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM employees WHERE id = ?', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = rows[0];

        // 🛡️ SECURITY TRUTH CHECK: Strictly block session if not 'សកម្ម' (Active)
        if (user.deleted_at || user.status !== 'សកម្ម') {
            console.log(`🚫 Session BLOCKED for User=${user.id} - Status=${user.status}`);
            return res.status(403).json({ error: 'Account disabled. (គណនីប្រើប្រាស់មមិនមានសិទ្ធិចូលទៀតទេ)' });
        }

        // Map database snake_case to frontend camelCase
        const mappedUser = {
            id: user.id,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
            status: user.status,
            department: user.department,
            position: user.position,
            email: user.email,
            phone: user.phone,
            joinDate: user.join_date,
            dob: user.dob,
            nationality: user.nationality,
            address: user.address,
            bankName: user.bank_name,
            bankAccountName: user.bank_account_name,
            bankAccountNumber: user.bank_account_number,
            bankQrCode: user.bank_qr_code,
            cvDocument: user.cv_document,
            idCardDocument: user.id_card_document,
            deletedAt: user.deleted_at
        };

        res.json(mappedUser);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
