const fs = require('fs');
const path = require('path');

const frontendDist = path.join(__dirname, '../../frontend/dist');
const backendPublic = path.join(__dirname, '../public');

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }
        fs.readdirSync(src).forEach(function (childItemName) {
            copyRecursiveSync(path.join(src, childItemName),
                path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

async function buildDeployment() {
    try {
        console.log('🚀 Preparing Deployment...');

        // 1. Check if frontend build exists
        if (!fs.existsSync(frontendDist)) {
            console.error('❌ Frontend build not found! Run "npm run build" in frontend folder first.');
            process.exit(1);
        }

        // 2. Clear backend/public
        console.log('🧹 Clearing backend/public...');
        if (fs.existsSync(backendPublic)) {
            fs.rmSync(backendPublic, { recursive: true, force: true });
        }
        fs.mkdirSync(backendPublic);

        // 3. Copy files
        console.log('📦 Copying frontend build to backend/public...');
        copyRecursiveSync(frontendDist, backendPublic);

        console.log('✅ Deployment package ready in "backend" directory.');
        console.log('   You can now zip the "backend" folder and deploy it to your server.');
        console.log('   Ensure run "npm install" inside backend directory on server.');
        console.log('   Check environment variables in .env file.');

    } catch (err) {
        console.error('❌ Deployment preparation failed:', err);
        process.exit(1);
    }
}

buildDeployment();
