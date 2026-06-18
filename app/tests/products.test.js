'use strict';

const request = require('supertest');
const app = require('../src/server');
const store = require('../src/models/store');

describe('Products Routes', () => {
  describe('GET /api/products', () => {
    it('should return paginated products list', async () => {
      const res = await request(app).get('/api/products');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.products)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should filter by category', async () => {
      const res = await request(app).get('/api/products?category=Electronics');
      expect(res.statusCode).toBe(200);
      res.body.data.products.forEach(p => {
        expect(p.category.toLowerCase()).toBe('electronics');
      });
    });

    it('should filter by search term', async () => {
      const res = await request(app).get('/api/products?search=headphones');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.products.length).toBeGreaterThan(0);
    });

    it('should filter by price range', async () => {
      const res = await request(app).get('/api/products?minPrice=100&maxPrice=500');
      expect(res.statusCode).toBe(200);
      res.body.data.products.forEach(p => {
        expect(p.price).toBeGreaterThanOrEqual(100);
        expect(p.price).toBeLessThanOrEqual(500);
      });
    });

    it('should return pagination metadata', async () => {
      const res = await request(app).get('/api/products?page=1&limit=2');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.page).toBe(1);
    });
  });

  describe('GET /api/products/categories', () => {
    it('should return list of categories', async () => {
      const res = await request(app).get('/api/products/categories');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data.categories)).toBe(true);
      expect(res.body.data.categories.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return a product by valid ID', async () => {
      const allRes = await request(app).get('/api/products');
      const productId = allRes.body.data.products[0].id;

      const res = await request(app).get(`/api/products/${productId}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.product.id).toBe(productId);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app).get('/api/products/not-a-uuid');
      expect(res.statusCode).toBe(400);
    });

    it('should return 404 for non-existent product', async () => {
      const res = await request(app).get('/api/products/00000000-0000-0000-0000-000000000000');
      expect(res.statusCode).toBe(404);
      expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
    });
  });
});
