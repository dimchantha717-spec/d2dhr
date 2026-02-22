const db = require('../config/db');

async function updateSuperAdmin() {
    try {
        console.log('🔄 Updating Super Admin details...');

        // Update name and position for ID '1'
        const [result] = await db.query(
            `UPDATE employees 
             SET name = ?, position = ?, bank_account_name = ?
             WHERE id = '1'`,
            ['Poum Moniroth', 'CEO', 'POUM MONIROTH']
        );

        if (result.affectedRows > 0) {
            console.log('✅ Super Admin updated successfully:');
            console.log('   Name: Poum Moniroth');
            console.log('   Position: CEO');
        } else {
            console.log('⚠️ Super Admin (ID 1) not found!');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to update Super Admin:', err);
        process.exit(1);
    }
}

updateSuperAdmin();
