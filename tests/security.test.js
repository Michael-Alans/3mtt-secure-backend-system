const request = require('supertest');
const app = require('../src/app');

describe('Security Layer Assertions', () => {
  test('Should return structured 400 if validation fails', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'invalid-email', password: 'short' });
    
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('details');
  });
});