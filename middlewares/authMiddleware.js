const jwt = require('jsonwebtoken');

// 1. Core Authentication Gatekeeper
exports.verifyToken = (req, res, next) => {
    // Look for header string format: "Bearer <your_token_string>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. Security authentication token required.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Inject user context variables dynamically into the current request stream
        req.user = decoded; 
        
        next(); // Authorization clear, proceed to executing controller path
    } catch (error) {
        return res.status(403).json({ message: 'Authentication failed. Invalid or expired token.' });
    }
};

// 2. Role-Based Access Control Gatekeeper (Dynamic RBAC Check)
exports.restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        // Ensure verifyToken ran first and extracted user details
        if (!req.user) {
            return res.status(501).json({ message: 'System verification sequencing routing error.' });
        }

        // Check if user's role_name matches allowed parameters
        if (!allowedRoles.includes(req.user.role_name)) {
            return res.status(403).json({ message: `Access denied. Action restricted to roles: [${allowedRoles.join(', ')}]` });
        }

        next();
    };
};