const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

/**
 * PRODUCTION READY SERVER
 * Optimized for Hostinger & Mobile Browsers
 */

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Security & Data Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 2. Custom Logging for diagnostics
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// 3. API ROUTES
// Mount all backend controllers
app.use('/api/employees', require('./routes/employees'));
app.use('/api/shifts', require('./routes/shifts'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/warnings', require('./routes/warnings'));
app.use('/api/outdoor', require('./routes/outdoor'));
app.use('/api/holidays', require('./routes/holidays'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/telegram', require('./routes/telegram'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/performance', require('./routes/performance'));

// 4. AUTHORITATIVE API GUARD
// Prevents requests to missing /api routes from hitting the SPA fallback (index.html)
// This is critical for preventing "Unexpected token '<'" errors in React.
app.all('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API_NOT_FOUND',
        message: `Endpoint ${req.originalUrl} not found on this server.`
    });
});

// 5. STATIC ASSETS (Vite Build)
// Serve build files from 'public' folder
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d', // Cache static files (JS/CSS/JPG) for 1 day
    setHeaders: (res, filePath) => {
        // Additional headers can be set here if needed
    }
}));

// 6. SPA FALLBACK (React Routing)
// Serve index.html for any direct URL navigation that isn't a file or API
app.get('*', (req, res) => {
    // 💥 CRITICAL FOR SAFARI/MOBILE:
    // Prevent aggressive caching of index.html to ensure users get latest JS/CSS builds
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Frontend build not detected. Please run 'npm run build' and ensure files are in backend/public.");
    }
});

// 7. GLOBAL EXCEPTION HANDLER
app.use((err, req, res, next) => {
    console.error("🔥 Server Panic:", err);
    res.status(err.status || 500).json({
        success: false,
        error: err.name || 'InternalServerError',
        message: err.message || 'The server encountered an unexpected condition.'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 D2D HR System - Production Server
------------------------------------
- PORT: ${PORT}
- NODE_ENV: ${process.env.NODE_ENV}
- PUBLIC_DIR: ${path.join(__dirname, 'public')}
- Status: Ready for all devices
    `);
});
