const env = require('../config/env');

// ─── Authentication Middleware ───────────────────────────────────────────────
// Verifies that a valid Bearer token is present in the Authorization header.
// In a production system, this would verify a JWT using env.JWT_SECRET.
// Returns 401 Unauthorized if no token is provided or the token is invalid.
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'fail',
      error: 'Unauthorized. A valid Bearer token is required.',
    });
  }

  const token = authHeader.split(' ')[1];

  // Simplified token validation for demonstration.
  // In production, use jsonwebtoken.verify(token, env.JWT_SECRET).
  if (token === 'valid-admin-token') {
    req.user = { role: 'admin' };
  } else if (token === 'valid-user-token') {
    req.user = { role: 'user' };
  } else {
    return res.status(401).json({
      status: 'fail',
      error: 'Unauthorized. Token is invalid or expired.',
    });
  }

  next();
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
