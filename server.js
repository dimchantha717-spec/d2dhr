require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const compression = require('compression');

console.log('🚀 App Starting... Env DB_USER:', process.env.DB_USER || 'MISSING');

const app = express();
app.use(compression()); // Enable Gzip compression
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// Run Migrations (Safe Start)
const { runMigrations } = require('./services/migrationService');
runMigrations().catch(err => console.error('🚫 Migration Startup Error:', err));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Cache strategy: Static assets (JS/CSS) get 1 year cache
const cacheOptions = {
    maxAge: '1y',
    immutable: true,
    index: false
};

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Serve Frontend Static Files with Cache Control for hashed assets
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            // Never cache index.html to ensure people get the latest version
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Handle React Routing (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
