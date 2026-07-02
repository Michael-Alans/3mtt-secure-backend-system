// Set environment variables for tests BEFORE requiring the app
process.env.JWT_SECRET = 'test_secret_key_123456';
process.env.ALLOWED_ORIGINS = 'http://localhost';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/User');
const Item = require('../src/models/Item');
const env = require('../src/config/env');

// ─── Mock Redis to avoid needing a real Redis server during tests ────────────
jest.mock('../src/config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  keys: jest.fn().mockResolvedValue([]),
  del: jest.fn().mockResolvedValue(0),
  on: jest.fn(),
}));

// Increase timeout for MongoDB binary download
jest.setTimeout(600000);

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    await User.deleteMany({});
    await Item.deleteMany({});
  }
});

// ─── Helper: register and get token ─────────────────────────────────────────
const registerUser = async (overrides = {}) => {
  const userData = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'securepassword123',
    ...overrides,
  };
  const res = await request(app)
    .post('/api/register')
    .send(userData);
  return res;
};

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

  // ── Auth Flow (Register → Login → Use Token) ───────────────────────────
  describe('Authentication Flow', () => {
    test('POST /api/register — Should return 201 and a JWT token', async () => {
      const res = await registerUser();

      expect(res.statusCode).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user).toHaveProperty('email', 'test@example.com');
    });

    test('POST /api/register — Should return 409 for duplicate email', async () => {
      await registerUser();
      const res = await registerUser();

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    test('POST /api/login — Should return 200 and a JWT token with valid credentials', async () => {
      await registerUser();

      const res = await request(app)
        .post('/api/login')
        .send({ email: 'test@example.com', password: 'securepassword123' });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('token');
    });

    test('POST /api/login — Should return 401 with wrong password', async () => {
      await registerUser();

      const res = await request(app)
        .post('/api/login')
        .send({ email: 'test@example.com', password: 'wrongpassword123' });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toContain('Invalid');
    });

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

    test('GET /api/admin — Should return 200 with a valid admin JWT', async () => {
      // Create admin user directly in DB
      const user = await User.create({ name: 'Admin', email: 'admin@example.com', password: 'adminpass1234', role: 'admin' });
      const token = jwt.sign({ id: user._id, role: 'admin' }, env.JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .get('/api/admin')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  // ── Authorization / RBAC (403) ──────────────────────────────────────────
  describe('Role-Based Access Control', () => {
    test('GET /api/admin — Should return 403 when a non-admin user accesses admin route', async () => {
      const registerRes = await registerUser();
      const token = registerRes.body.data.token;

      const res = await request(app)
        .get('/api/admin')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.status).toBe('fail');
      expect(res.body.error).toContain('Forbidden');
    });
  });

  // ── Pagination (GET /api/items) ─────────────────────────────────────────
  describe('Pagination', () => {
    test('GET /api/items — Should return paginated results with metadata', async () => {
      // Register and get token
      const registerRes = await registerUser();
      const token = registerRes.body.data.token;
      const userId = registerRes.body.data.user.id;

      // Create 15 items
      for (let i = 0; i < 15; i++) {
        await Item.create({ title: `Item ${i}`, description: `Desc ${i}`, createdBy: userId });
      }

      const res = await request(app)
        .get('/api/items?page=1&limit=5')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveLength(5);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(5);
      expect(res.body.total).toBe(15);
      expect(res.body.totalPages).toBe(3);
    });

    test('GET /api/items — Should return page 2 correctly', async () => {
      const registerRes = await registerUser();
      const token = registerRes.body.data.token;
      const userId = registerRes.body.data.user.id;

      for (let i = 0; i < 15; i++) {
        await Item.create({ title: `Item ${i}`, createdBy: userId });
      }

      const res = await request(app)
        .get('/api/items?page=2&limit=5')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.page).toBe(2);
      expect(res.body.data).toHaveLength(5);
    });

    test('GET /api/items — Should default to page=1, limit=10', async () => {
      const registerRes = await registerUser();
      const token = registerRes.body.data.token;

      const res = await request(app)
        .get('/api/items')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
    });
  });

  // ── Item CRUD ───────────────────────────────────────────────────────────
  describe('Item CRUD', () => {
    test('POST /api/items — Should create an item and return 201', async () => {
      const registerRes = await registerUser();
      const token = registerRes.body.data.token;

      const res = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Item', description: 'A test item' });

      expect(res.statusCode).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('title', 'New Item');
    });

    test('DELETE /api/items/:id — Should delete an item and return 200', async () => {
      const registerRes = await registerUser();
      const token = registerRes.body.data.token;
      const userId = registerRes.body.data.user.id;

      const item = await Item.create({ title: 'To Delete', createdBy: userId });

      const res = await request(app)
        .delete(`/api/items/${item._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('deleted');
    });

    test('DELETE /api/items/:id — Should return 404 for non-existent item', async () => {
      const registerRes = await registerUser();
      const token = registerRes.body.data.token;
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .delete(`/api/items/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
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