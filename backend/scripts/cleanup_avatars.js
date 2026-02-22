const db = require('../config/db');

async function cleanupAvatars() {
    try {
        console.log('--- Cleaning up picsum.photos URLs from database ---');

        // 1. Update employees table
        const [result1] = await db.query(`
            UPDATE employees 
            SET avatar = '' 
            WHERE avatar LIKE '%picsum.photos%'
        `);
        console.log(`✅ Cleaned up ${result1.affectedRows} employee avatars.`);

        // 2. Performance reviews often store a snapshot or are joined
        // If they store it in a column:
        try {
            const [result2] = await db.query(`
                UPDATE performance_reviews 
                SET avatar = '' 
                WHERE avatar LIKE '%picsum.photos%'
            `);
            console.log(`✅ Cleaned up ${result2.affectedRows} performance review avatars.`);
        } catch (e) {
            // Table or column might not exist depending on schema
            console.log('Skipping performance_reviews cleanup (might not have avatar column).');
        }

        console.log('--- Cleanup Complete ---');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to cleanup avatars:', err);
        process.exit(1);
    }
}

cleanupAvatars();
