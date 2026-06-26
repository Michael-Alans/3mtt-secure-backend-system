const request = require('supertest');
const app = require('../src/app');

describe('Security Layer Assertions', () => {

  // ── Input Validation (400) ──────────────────────────────────────────────
  describe('Zod Validation', () => {
    test('POST /api/login — Should return 400 with field-level errors for invalid input', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ email: 'invalid-email', password: 'short' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('details');
      expect(res.body.status).toBe('fail');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details[0]).toHaveProperty('field');
      expect(res.body.details[0]).toHaveProperty('message');
    });

    test('POST /api/register — Should return 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/register')
        .send({ email: 'test@example.com' }); // missing name and password

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('details');
      expect(res.body.details.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Authentication (401) ────────────────────────────────────────────────
  describe('Authentication', () => {
    test('GET /api/admin — Should return 401 when no token is provided', async () => {
      const res = await request(app).get('/api/admin');

      expect(res.statusCode).toBe(401);
      expect(res.body.status).toBe('fail');
      expect(res.body.error).toContain('Unauthorized');
    });

    test('GET /api/admin — Should return 401 when an invalid token is provided', async () => {
      const res = await request(app)
        .get('/api/admin')
        .set('Authorization', 'Bearer fake-invalid-token');

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toContain('invalid');
    });
  });

  // ── Authorization / RBAC (403) ──────────────────────────────────────────
  describe('Role-Based Access Control', () => {
    test('GET /api/admin — Should return 403 when a non-admin user accesses admin route', async () => {
      const res = await request(app)
        .get('/api/admin')
        .set('Authorization', 'Bearer valid-user-token');

      expect(res.statusCode).toBe(403);
      expect(res.body.status).toBe('fail');
      expect(res.body.error).toContain('Forbidden');
    });

    test('GET /api/admin — Should return 200 when an admin user accesses admin route', async () => {
      const res = await request(app)
        .get('/api/admin')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  // ── Rate Limiting (429) ─────────────────────────────────────────────────
  describe('Rate Limiting', () => {
    test('POST /api/login — Should return 429 after exceeding strict rate limit', async () => {
      // The strict limiter allows 5 requests per window.
      // Send 6 requests rapidly to trigger the 429.
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/login')
          .send({ email: 'test@test.com', password: 'validpassword123' });
      }

      const res = await request(app)
        .post('/api/login')
        .send({ email: 'test@test.com', password: 'validpassword123' });

      expect(res.statusCode).toBe(429);
      expect(res.body).toHaveProperty('error');
    });
  });
});