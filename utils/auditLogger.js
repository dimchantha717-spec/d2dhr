const db = require('../config/db');

/**
 * Log an action to the audit_logs table
 * @param {string} userId - ID of the user performing the action
 * @param {string} userRole - Role of the user performing the action
 * @param {string} action - Action key (e.g., 'actionCreateEmployee')
 * @param {string} details - Detailed description or JSON string of changes
 * @param {string} category - Category (e.g., 'categoryEmployee', 'categoryAsset')
 */
async function logAction(userId, userRole, action, details, category) {
    try {
        const id = Math.random().toString(36).substr(2, 9);
        await db.query(
            'INSERT INTO audit_logs (id, user_id, user_role, action, details, category) VALUES (?, ?, ?, ?, ?, ?)',
            [id, userId, userRole, action, details, category]
        );
    } catch (err) {
        console.error('Audit Log Error:', err);
    }
}

module.exports = { logAction };
