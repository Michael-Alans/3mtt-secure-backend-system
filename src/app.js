const express = require('express');
const { z } = require('zod');
const { helmetMiddleware, corsMiddleware, globalLimiter, strictAuthLimiter } = require('./middleware/security');
const { validateJson } = require('./middleware/validate');

const app = express();

app.use(express.json());
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use('/api/', globalLimiter); // Apply global limiting to API endpoints

// Schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Routes
app.post('/api/login', strictAuthLimiter, validateJson(loginSchema), (req, res) => {
  res.status(200).json({ status: 'success', message: 'Authenticated.' });
});

module.exports = app;