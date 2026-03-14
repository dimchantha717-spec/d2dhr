const db = require('../config/db');

async function tableExists(tableName) {
    try {
        const [rows] = await db.query('SHOW TABLES LIKE ?', [tableName]);
        return rows.length > 0;
    } catch (err) {
        console.error(`Error checking if table ${tableName} exists:`, err);
        return false;
    }
}

async function columnExists(tableName, columnName) {
    try {
        const [rows] = await db.query('SHOW COLUMNS FROM ?? LIKE ?', [tableName, columnName]);
        return rows.length > 0;
    } catch (err) {
        // If table doesn't exist, column doesn't exist
        return false;
    }
}

async function addColumn(tableName, columnName, definition) {
    if (!(await columnExists(tableName, columnName))) {
        try {
            // Using ?? for both table and column names for safety
            await db.query(`ALTER TABLE ?? ADD COLUMN ?? ${definition}`, [tableName, columnName]);
            console.log(`✅ Column ${columnName} added to ${tableName}`);
        } catch (err) {
            console.error(`❌ Failed to add column ${columnName} to ${tableName}:`, err.message);
        }
    }
}

async function modifyColumn(tableName, columnName, definition) {
    try {
        await db.query(`ALTER TABLE ?? MODIFY COLUMN ?? ${definition}`, [tableName, columnName]);
        console.log(`✅ Column ${columnName} modified in ${tableName}`);
    } catch (err) {
        console.error(`❌ Failed to modify column ${columnName} in ${tableName}:`, err.message);
    }
}

module.exports = {
    tableExists,
    columnExists,
    addColumn,
    modifyColumn
};
