const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve files from 'uploads' directory

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

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname, 'public')));

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
