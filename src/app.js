const express = require('express');
const { z } = require('zod');
const { helmetMiddleware, corsMiddleware, globalLimiter, strictAuthLimiter } = require('./middleware/security');
const { validateJson } = require('./middleware/validate');
const { authenticate, authorizeAdmin } = require('./middleware/auth');

const app = express();

// ─── Global Middleware ───────────────────────────────────────────────────────
app.use(express.json());
app.use(helmetMiddleware);   // Security headers (CSP, HSTS, frameguard, etc.)
app.use(corsMiddleware);     // Restrict cross-origin access to allowed domains
app.use('/api/', globalLimiter); // Rate limit all API endpoints (100 req/15 min)

// ─── Validation Schemas ─────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('email is invalid'),
  password: z.string().min(8, 'password must be at least 8 characters'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'name must be at least 2 characters'),
  email: z.string().email('email is invalid'),
  password: z.string().min(8, 'password must be at least 8 characters'),
});

// ─── Public Routes ───────────────────────────────────────────────────────────
// POST /api/login — Strict rate limiting + Zod validation
app.post('/api/login', strictAuthLimiter, validateJson(loginSchema), (req, res) => {
  res.status(200).json({ status: 'success', message: 'Authenticated.' });
});

// POST /api/register — Strict rate limiting + Zod validation
app.post('/api/register', strictAuthLimiter, validateJson(registerSchema), (req, res) => {
  res.status(201).json({ status: 'success', message: 'User registered.' });
});

// ─── Protected Routes ────────────────────────────────────────────────────────
// GET /api/admin — Requires valid token (401) AND admin role (403)
app.get('/api/admin', authenticate, authorizeAdmin, (req, res) => {
  res.status(200).json({ status: 'success', data: { message: 'Admin dashboard data.' } });
});

module.exports = app;