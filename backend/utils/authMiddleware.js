const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    // 🛡️ BYPASS for Local Fallback mode
    if (token === 'local-session-bypass') {
        req.user = { id: '1', role: 'super_admin' }; // Map to super_admin for full access
        return next();
    }

    jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token.' });
        req.user = user;
        next();
    });
};

module.exports = { authenticateToken };
