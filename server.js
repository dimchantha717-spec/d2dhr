require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const compression = require('compression');

console.log('🚀 App Starting... Env DB_USER:', process.env.DB_USER || 'MISSING');

const app = express();
app.use(compression()); // Enable Gzip compression for all responses (including JSON API)
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// Run Migrations (Safe Start)
const { runMigrations } = require('./services/migrationService');
runMigrations().catch(err => console.error('🚫 Migration Startup Error:', err));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Security & Performance Headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Vary: Accept-Encoding is important for proxies when compression is used
    res.setHeader('Vary', 'Accept-Encoding');
    next();
});

// Serve Static Files from "public"
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d', // Default for general files
    setHeaders: (res, filePath) => {
        // Versioned assets (JS/CSS from Vite) get 1 year cache
        if (filePath.match(/\.(js|css|woff2|webp|png|jpg|jpeg|svg|ico)$/) && filePath.includes('assets')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // HTML files should NEVER be cached to ensure users get the latest build links
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        }
    }
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d' // Photos/Uploads cache for 1 week
}));

// Health Check for Production Debugging
app.get('/api/health', async (req, res) => {
    try {
        const dbConnection = require('./config/db');
        await dbConnection.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected', version: '1.0.1' });
    } catch (err) {
        res.status(200).json({ status: 'warning', database: 'error', message: err.message });
    }
});

// Routes
const employeesRouter = require('./routes/employees');
const shiftsRouter = require('./routes/shifts');
const attendanceRouter = require('./routes/attendance');
const leavesRouter = require('./routes/leaves');

app.use('/api/employees', employeesRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/leaves', leavesRouter);
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

// API Routes handled above...
// (employeesRouter, shiftsRouter, etc are already mounted)

// Handle React Routing (SPA) - Authoritative fallback
app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            console.error("Failed to send index.html:", err);
            res.status(404).send("Front-end not built or index.html missing in backend/public");
        }
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("🔥 Global Error Handler:", err);
    res.status(500).json({
        error: err.message || "Internal Server Error",
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
