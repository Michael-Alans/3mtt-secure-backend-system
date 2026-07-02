const express = require('express');
const { z } = require('zod');
const { helmetMiddleware, corsMiddleware, globalLimiter, strictAuthLimiter } = require('./middleware/security');
const { validateJson } = require('./middleware/validate');
const { authenticate, authorizeAdmin } = require('./middleware/auth');
const { register, login } = require('./controllers/authController');
const { getItems, createItem, deleteItem } = require('./controllers/itemController');

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

const itemSchema = z.object({
  title: z.string().min(1, 'title is required').max(200, 'title must be at most 200 characters'),
  description: z.string().max(2000, 'description must be at most 2000 characters').optional(),
});

// ─── Public Routes ───────────────────────────────────────────────────────────
// POST /api/register — Strict rate limiting + Zod validation + bcrypt hashing
app.post('/api/register', strictAuthLimiter, validateJson(registerSchema), register);

// POST /api/login — Strict rate limiting + Zod validation + bcrypt compare + JWT sign
app.post('/api/login', strictAuthLimiter, validateJson(loginSchema), login);

// ─── Protected Routes ────────────────────────────────────────────────────────
// GET /api/items — Authenticated + Paginated (with Redis cache in controller)
app.get('/api/items', authenticate, getItems);

// POST /api/items — Authenticated + Validated + Cache invalidation
app.post('/api/items', authenticate, validateJson(itemSchema), createItem);

// DELETE /api/items/:id — Authenticated + Cache invalidation
app.delete('/api/items/:id', authenticate, deleteItem);

// GET /api/admin — Requires valid token (401) AND admin role (403)
app.get('/api/admin', authenticate, authorizeAdmin, (req, res) => {
  res.status(200).json({ status: 'success', data: { message: 'Admin dashboard data.' } });
});

module.exports = app;