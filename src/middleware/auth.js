const jwt = require('jsonwebtoken');
const env = require('../config/env');

// ─── Authentication Middleware ───────────────────────────────────────────────
// Verifies the Bearer token using jsonwebtoken.verify() with the JWT_SECRET.
// Attaches the decoded payload { id, role } to req.user.
// Returns 401 Unauthorized if no token is provided or verification fails.
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'fail',
      error: 'Unauthorized. A valid Bearer token is required.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify token signature and expiration using the secret from env
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'fail',
      error: 'Unauthorized. Token is invalid or expired.',
    });
  }
};

// ─── Role-Based Access Control (RBAC) Middleware ─────────────────────────────
// Checks if the authenticated user has the 'admin' role.
// Returns 403 Forbidden if the user does not have sufficient privileges.
// This prevents horizontal and vertical privilege escalation attacks.
const authorizeAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      status: 'fail',
      error: 'Forbidden. Admin privileges are required to access this resource.',
    });
  }
  next();
};

module.exports = { authenticate, authorizeAdmin };
