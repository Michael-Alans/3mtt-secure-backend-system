const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// ─── 1. HELMET: HTTP Security Headers ───────────────────────────────────────
// Helmet sets various HTTP headers to protect the app from well-known web
// vulnerabilities such as XSS, clickjacking, and MIME-type sniffing.
const helmetMiddleware = helmet({
  // Content-Security-Policy: Restricts which resources (scripts, styles, etc.)
  // the browser is allowed to load. By limiting sources to 'self', we prevent
  // injection of malicious external scripts (XSS mitigation).
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],   // Only allow resources from our own origin
      scriptSrc: ["'self'"],    // Block inline scripts and external script sources
      styleSrc: ["'self'"],     // Block external stylesheets
      imgSrc: ["'self'"],       // Only allow images from our origin
      frameAncestors: ["'none'"], // Prevent this site from being embedded in iframes (clickjacking)
    },
  },
  // HSTS: Forces browsers to only use HTTPS for future requests to this domain.
  // This prevents protocol downgrade attacks and cookie hijacking.
  hsts: {
    maxAge: 31536000,           // Enforce HTTPS for 1 year
    includeSubDomains: true,    // Apply to all subdomains
    preload: true,              // Allow inclusion in browser HSTS preload lists
  },
  // Frameguard: Prevents the page from being loaded in an iframe.
  // This is a defense against clickjacking attacks.
  frameguard: { action: 'deny' },
  // Hide X-Powered-By: Removes the header that reveals Express as the server
  // framework, making it harder for attackers to target known Express exploits.
  hidePoweredBy: true,
});

// ─── 2. CORS: Cross-Origin Resource Sharing ─────────────────────────────────
// CORS controls which external domains can access our API. Using an explicit
// allowlist (instead of wildcard '*') prevents unauthorized domains from
// making requests to our backend, mitigating CSRF-like attacks.
const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests or tools like Postman/Supertest (no origin header)
    if (!origin) return callback(null, true);
    // Check if the requesting origin is in our environment-configured allowlist
    if (env.ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS Policy'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],           // Only allow specific HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'],    // Only allow specific headers
  credentials: true,                                    // Allow cookies/auth headers
});

// ─── 3. RATE LIMITING: Brute-Force & DDoS Prevention ────────────────────────
// Rate limiting restricts the number of requests a client can make within a
// time window. This protects against brute-force login attacks, credential
// stuffing, and basic denial-of-service attacks.

// Global limiter: Applied to all /api/ routes to prevent general abuse.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15-minute window
  max: 100,                   // Max 100 requests per window per IP
  standardHeaders: true,      // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,       // Disable X-RateLimit-* headers
  message: { status: 429, error: 'Too many requests, please try again later.' },
});

// Strict auth limiter: Applied to sensitive endpoints (/login, /register)
// with a much lower threshold to prevent brute-force password attacks.
const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15-minute window
  max: 5,                     // Only 5 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 429, error: 'Too many authentication attempts. Account locked temporarily.' },
});

module.exports = {
  helmetMiddleware,
  corsMiddleware,
  globalLimiter,
  strictAuthLimiter,
};