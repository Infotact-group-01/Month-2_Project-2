'use strict';

const request = require('supertest');
const app = require('../src/app');

describe('Authentication Routes', () => {
  let accessToken;
  const testUser = {
    email: 'test.user@example.com',
    password: 'TestPass@123',
    firstName: 'Test',
    lastName: 'User',
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('should reject duplicate email registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('EMAIL_TAKEN');
    });

    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'new@example.com', password: 'weak' });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'not-an-email' });

      expect(res.statusCode).toBe(400);
    });

    it('should not expose password in response', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'another@example.com' });

      expect(res.body.data?.user?.password).toBeUndefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      accessToken = res.body.data.accessToken;
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword@123' });

      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'TestPass@123' });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('AUTH_HEADER_MISSING');
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.statusCode).toBe(401);
    });
  });
});
