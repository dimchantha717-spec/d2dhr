const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { snakeToCamel } = require('../utils/mapKeys');
const { logAction } = require('../utils/auditLogger');
const { authenticateToken } = require('../utils/authMiddleware');

// Get payroll records for a specific month
router.get('/', async (req, res) => {
    try {
        const { month } = req.query; // YYYY-MM
        let query = 'SELECT p.*, e.name, e.department, e.position FROM payroll_records p JOIN employees e ON p.employee_id = e.id';
        const params = [];

        if (month) {
            query += ' WHERE p.month = ?';
            params.push(month);
        }

        query += ' ORDER BY p.generated_at DESC';

        const [rows] = await pool.query(query, params);
        res.json(snakeToCamel(rows));
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Save payroll record (create or update)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            id, employee_id, month, salary, bonus, deduction, ot_earnings,
            tax_amount, nssf_employee, nssf_employer, seniority_payment, exchange_rate,
            net_salary, status, paid_at, confirmed_at
        } = req.body;

        // Check if exists
        const [rows] = await pool.query('SELECT * FROM payroll_records WHERE id = ?', [id]);

        console.log('Backend: Saving payroll record:', { id, employee_id, month, net_salary, status });

        if (rows.length > 0) {
            // Update
            await pool.query(
                'UPDATE payroll_records SET salary=?, bonus=?, deduction=?, ot_earnings=?, tax_amount=?, nssf_employee=?, nssf_employer=?, seniority_payment=?, exchange_rate=?, net_salary=?, status=?, paid_at=?, confirmed_at=? WHERE id=?',
                [
                    salary, bonus, deduction, ot_earnings || 0,
                    tax_amount || 0, nssf_employee || 0, nssf_employer || 0, seniority_payment || 0, exchange_rate || 4100,
                    net_salary, status, paid_at || null, confirmed_at || null, id
                ]
            );
            console.log('Backend: Updated payroll record ID:', id);
        } else {
            // Insert
            await pool.query(
                'INSERT INTO payroll_records (id, employee_id, month, salary, bonus, deduction, ot_earnings, tax_amount, nssf_employee, nssf_employer, seniority_payment, exchange_rate, net_salary, status, paid_at, confirmed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    id, employee_id, month, salary, bonus, deduction, ot_earnings || 0,
                    tax_amount || 0, nssf_employee || 0, nssf_employer || 0, seniority_payment || 0, exchange_rate || 4100,
                    net_salary, status, paid_at || null, confirmed_at || null
                ]
            );
            console.log('Backend: Created new payroll record ID:', id);
        }

        const [resultRows] = await pool.query('SELECT * FROM payroll_records WHERE id = ?', [id]);

        // Audit Log
        const logMsg = rows.length > 0
            ? `Updated payroll for employee ${employee_id} (Month: ${month}, Net: $${net_salary}, Status: ${status})`
            : `Generated payroll for employee ${employee_id} (Month: ${month}, Net: $${net_salary}, Status: ${status})`;

        await logAction(
            req.user.id,
            req.user.role,
            rows.length > 0 ? 'actionUpdatePayroll' : 'actionGeneratePayroll',
            logMsg,
            'categoryPayroll'
        );

        res.json(snakeToCamel(resultRows[0]));
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Reset all payroll statuses for a specific month to 'Pending'
router.post('/reset', authenticateToken, async (req, res) => {
    try {
        const { month } = req.body;
        if (!month) return res.status(400).json({ error: 'Month is required' });

        await pool.query(
            'DELETE FROM payroll_records WHERE month = ?',
            [month]
        );

        res.json({ message: `Payroll for ${month} has been cleared for recalculation.` });

        // Audit Log
        await logAction(
            req.user.id,
            req.user.role,
            'actionResetPayroll',
            `Reset/Cleared payroll records for month: ${month}`,
            'categoryPayroll'
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
