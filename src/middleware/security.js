const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// 1. Explicit Helmet Configuration
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      frameAncestors: ["'none'"], // Strict framing protection
    },
  },
  hsts: {
    maxAge: 31536000, // 1 Year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
});

// 2. Explicit Env-Driven CORS
const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow server-to-server or tools like Postman/Supertest if no origin header is present
    if (!origin) return callback(null, true); 
    if (env.ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS Policy'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});

// 3. Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100,
  message: { status: 429, error: 'Too many requests, please try again later.' },
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 5, // Strict brute-force prevention
  message: { status: 429, error: 'Too many authentication attempts. Account locked temporarily.' },
});

module.exports = {
  helmetMiddleware,
  corsMiddleware,
  globalLimiter,
  strictAuthLimiter,
};