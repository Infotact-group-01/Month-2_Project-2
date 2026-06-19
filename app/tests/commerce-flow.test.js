'use strict';

const jwt = require('jsonwebtoken');
const request = require('supertest');

const app = require('../src/app');
const config = require('../src/config');
const store = require('../src/models/store');

const makeAdminToken = () => jwt.sign(
  {
    sub: 'admin-test-user',
    email: 'admin@example.com',
    role: 'admin',
  },
  config.jwt.secret,
  { expiresIn: '1h' }
);

const registerCustomer = async () => {
  const email = `customer.${Date.now()}@example.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password: 'Customer@123',
      firstName: 'Commerce',
      lastName: 'Tester',
    });

  return res.body.data.accessToken;
};

const shippingAddress = {
  street: '123 Pipeline Avenue',
  city: 'Secure City',
  state: 'CA',
  postalCode: '94105',
  country: 'US',
};

describe('Commerce Workflows', () => {
  let adminToken;
  let customerToken;
  let productId;

  beforeAll(async () => {
    adminToken = makeAdminToken();
    customerToken = await registerCustomer();
    productId = Array.from(store.products.values())[0].id;
  });

  describe('Admin product management', () => {
    let createdProductId;

    it('creates, updates, and deletes a product with an admin token', async () => {
      const createRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Secure Checkout Scanner',
          description: 'A test product used for secured commerce workflow coverage.',
          price: 59.99,
          category: 'Security',
          stock: 10,
          sku: `SEC-${Date.now()}`,
          tags: ['security', 'scanner'],
        });

      expect(createRes.statusCode).toBe(201);
      createdProductId = createRes.body.data.product.id;

      const updateRes = await request(app)
        .put(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 49.99, stock: 8 });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.body.data.product.price).toBe(49.99);

      const deleteRes = await request(app)
        .delete(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.statusCode).toBe(200);
    });

    it('rejects protected product writes without authorization', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          name: 'Unauthorized Product',
          description: 'This request should not be allowed.',
          price: 19.99,
          category: 'Security',
          stock: 1,
          sku: `UNAUTH-${Date.now()}`,
        });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Cart management', () => {
    it('adds, updates, removes, and clears cart items', async () => {
      const emptyCartRes = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(emptyCartRes.statusCode).toBe(200);
      expect(emptyCartRes.body.data.cart.items).toHaveLength(0);

      const addRes = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 2 });
      expect(addRes.statusCode).toBe(200);

      const itemId = addRes.body.data.cart.items[0].id;
      const patchRes = await request(app)
        .patch(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 1 });
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.body.data.cart.items[0].quantity).toBe(1);

      const deleteRes = await request(app)
        .delete(`/api/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(deleteRes.statusCode).toBe(200);

      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 1 });

      const clearRes = await request(app)
        .delete('/api/cart')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(clearRes.statusCode).toBe(200);
    });

    it('rejects missing products and unauthenticated cart access', async () => {
      const missingProductRes = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 });
      expect(missingProductRes.statusCode).toBe(404);

      const unauthenticatedRes = await request(app).get('/api/cart');
      expect(unauthenticatedRes.statusCode).toBe(401);
    });
  });

  describe('Order management', () => {
    let orderId;

    it('creates, reads, updates, and protects order state transitions', async () => {
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 1 });

      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shippingAddress, paymentMethod: 'card' });
      expect(createRes.statusCode).toBe(201);
      orderId = createRes.body.data.order.id;

      const listRes = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(listRes.statusCode).toBe(200);
      expect(listRes.body.data.orders.length).toBeGreaterThan(0);

      const detailRes = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(detailRes.statusCode).toBe(200);

      const statusRes = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'shipped', note: 'Coverage shipment update' });
      expect(statusRes.statusCode).toBe(200);

      const cancelShippedRes = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(cancelShippedRes.statusCode).toBe(400);
    });

    it('cancels a customer order before shipment', async () => {
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 1 });

      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shippingAddress, paymentMethod: 'paypal' });

      const cancelRes = await request(app)
        .post(`/api/orders/${createRes.body.data.order.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(cancelRes.statusCode).toBe(200);
      expect(cancelRes.body.data.order.status).toBe('cancelled');
    });

    it('rejects invalid order requests', async () => {
      const invalidIdRes = await request(app)
        .get('/api/orders/not-a-uuid')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(invalidIdRes.statusCode).toBe(400);

      const emptyCartOrderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shippingAddress, paymentMethod: 'bank_transfer' });
      expect(emptyCartOrderRes.statusCode).toBe(400);
    });
  });
});
