'use strict';

const request = require('supertest');
const app = require('../src/app');

describe('Health Check Endpoints', () => {
  it('GET /health → 200 with healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('ecommerce-api');
    expect(res.body.version).toBeDefined();
  });

  it('GET /api/health → 200 with healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('GET /api → 200 with API info', async () => {
    const res = await request(app).get('/api');
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBeDefined();
    expect(res.body.endpoints).toBeDefined();
  });

  it('GET /nonexistent-route → 404', async () => {
    const res = await request(app).get('/api/nonexistent-route-xyz');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('Security Headers', () => {
  it('should include X-Content-Type-Options header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should include X-Frame-Options header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});
