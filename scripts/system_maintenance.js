const db = require('../config/db');
const { ensurePhysicalFile } = require('../utils/fileHandler');
const { autoRepairRecord } = require('../routes/attendance'); // We might need to export this or move it to a util

async function runMaintenance() {
    console.log('🚀 Starting System-Wide Maintenance...');

    try {
        // 1. Fix Base64 Images in attendance_records
        console.log('--- Checking attendance_records for base64 images ---');
        const [attRows] = await db.query("SELECT id, photo FROM attendance_records WHERE photo LIKE 'data:image%'");
        console.log(`Found ${attRows.length} records to fix.`);
        
        for (const row of attRows) {
            const physicalUrl = await ensurePhysicalFile(row.photo, 'attendance', 'd2dhr.online', 'https');
            await db.query("UPDATE attendance_records SET photo = ? WHERE id = ?", [physicalUrl, row.id]);
            console.log(`Fixed attendance record ${row.id}`);
        }

        // 2. Fix Base64 in leave_requests
        console.log('--- Checking leave_requests for base64 evidence ---');
        const [leaveRows] = await db.query("SELECT id, evidence_photo, evidence_audio FROM leave_requests WHERE evidence_photo LIKE 'data:%' OR evidence_audio LIKE 'data:%'");
        console.log(`Found ${leaveRows.length} records to fix.`);
        
        for (const row of leaveRows) {
            const physicalPhoto = await ensurePhysicalFile(row.evidence_photo, 'leave-photo', 'd2dhr.online', 'https');
            const physicalAudio = await ensurePhysicalFile(row.evidence_audio, 'leave-audio', 'd2dhr.online', 'https');
            await db.query("UPDATE leave_requests SET evidence_photo = ?, evidence_audio = ? WHERE id = ?", [physicalPhoto, physicalAudio, row.id]);
            console.log(`Fixed leave request ${row.id}`);
        }

        // 3. Fix Base64 in employees
        console.log('--- Checking employees for base64 avatar/docs ---');
        const [empRows] = await db.query("SELECT id, avatar, cv_document, id_card_document, bank_qr_code FROM employees WHERE avatar LIKE 'data:%' OR cv_document LIKE 'data:%' OR id_card_document LIKE 'data:%' OR bank_qr_code LIKE 'data:%'");
        console.log(`Found ${empRows.length} records to fix.`);
        
        for (const row of empRows) {
            const avatar = await ensurePhysicalFile(row.avatar, 'avatar', 'd2dhr.online', 'https');
            const cv = await ensurePhysicalFile(row.cv_document, 'cv', 'd2dhr.online', 'https');
            const idCard = await ensurePhysicalFile(row.id_card_document, 'idcard', 'd2dhr.online', 'https');
            const bankQr = await ensurePhysicalFile(row.bank_qr_code, 'bankqr', 'd2dhr.online', 'https');
            
            await db.query("UPDATE employees SET avatar = ?, cv_document = ?, id_card_document = ?, bank_qr_code = ? WHERE id = ?", 
                [avatar, cv, idCard, bankQr, row.id]);
            console.log(`Fixed employee ${row.id}`);
        }

        // 4. Trigger Auto-Repair for all historical attendance
        // This ensures all records are correctly slotted according to current shift rules
        console.log('--- Re-slotting all historical attendance records ---');
        const [history] = await db.query("SELECT DISTINCT employee_id, date FROM attendance_records ORDER BY date DESC");
        console.log(`Processing ${history.length} unique employee-date combinations...`);
        
        // We need to import autoRepairRecord. Since it's in routes/attendance.js, we might need to modify it to export it.
        // For now, I'll assume we've exported it.
        
        let count = 0;
        for (const record of history) {
            try {
                await autoRepairRecord(record.employee_id, record.date);
                count++;
                if (count % 50 === 0) console.log(`Processed ${count}/${history.length} records...`);
            } catch (err) {
                console.error(`Error repairing ${record.employee_id} on ${record.date}:`, err.message);
            }
        }

        console.log('✅ Maintenance complete!');
    } catch (err) {
        console.error('❌ Maintenance failed:', err);
    } finally {
        process.exit();
    }
}

// In attendance.js, we need to make sure autoRepairRecord is exported.
// Let's modify attendance.js to export it before running this.
runMaintenance(); 
