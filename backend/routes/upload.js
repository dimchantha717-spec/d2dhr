const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'avatar-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp|svg|bmp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed (jpeg, jpg, png, gif, webp, svg, bmp)!'));
    }
});

const { authenticateToken } = require('../utils/authMiddleware');

// Single File Upload Route
router.post('/', authenticateToken, (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer Error:', err);
            return res.status(400).json({ error: `Upload error: ${err.message}` });
        } else if (err) {
            console.error('General Upload Error:', err);
            return res.status(400).json({ error: err.message });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const protocol = req.protocol;
            const host = req.get('host');
            const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

            console.log('✅ File uploaded successfully:', req.file.filename);

            res.json({
                message: 'File uploaded successfully',
                url: fileUrl,
                filename: req.file.filename
            });
        } catch (err) {
            console.error('Processing error:', err);
            res.status(500).json({ error: 'Internal server error processing the file' });
        }
    });
});

module.exports = router;
