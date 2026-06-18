'use strict';

const express = require('express');
const { param, body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const store = require('../models/store');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.use(authenticate);

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

// ─── GET /api/orders ───────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const isAdmin = ['admin', 'manager'].includes(req.user.role);

  let orders = Array.from(store.orders.values());

  if (!isAdmin) {
    orders = orders.filter(o => o.userId === req.user.sub);
  }

  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.status(200).json({
    success: true,
    data: { orders, total: orders.length },
  });
});

// ─── GET /api/orders/:id ───────────────────────────────────────────────────────
router.get('/:id', [param('id').isUUID()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Invalid order ID', code: 'INVALID_ID' });
  }

  const order = store.orders.get(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found', code: 'ORDER_NOT_FOUND' });
  }

  const isAdmin = ['admin', 'manager'].includes(req.user.role);
  if (!isAdmin && order.userId !== req.user.sub) {
    return res.status(403).json({ success: false, error: 'Access denied', code: 'AUTH_FORBIDDEN' });
  }

  return res.status(200).json({ success: true, data: { order } });
});

// ─── POST /api/orders ──────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('shippingAddress').isObject().withMessage('Shipping address is required'),
    body('shippingAddress.street').trim().isLength({ min: 5 }).withMessage('Street address required'),
    body('shippingAddress.city').trim().isLength({ min: 2 }).withMessage('City required'),
    body('shippingAddress.state').trim().isLength({ min: 2 }).withMessage('State required'),
    body('shippingAddress.postalCode').trim().isLength({ min: 4 }).withMessage('Postal code required'),
    body('shippingAddress.country').trim().isLength({ min: 2 }).withMessage('Country required'),
    body('paymentMethod').isIn(['card', 'paypal', 'bank_transfer']).withMessage('Invalid payment method'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }

    const cart = store.carts.get(req.user.sub);
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty', code: 'CART_EMPTY' });
    }

    // Validate stock and lock quantities
    const orderItems = [];
    for (const item of cart.items) {
      const product = store.products.get(item.productId);
      if (!product) {
        return res.status(400).json({
          success: false,
          error: `Product "${item.name}" is no longer available`,
          code: 'PRODUCT_UNAVAILABLE',
        });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
          code: 'INSUFFICIENT_STOCK',
        });
      }
      orderItems.push({
        productId: item.productId,
        name: product.name,
        sku: product.sku,
        price: product.price,
        quantity: item.quantity,
        subtotal: parseFloat((product.price * item.quantity).toFixed(2)),
        imageUrl: product.imageUrl,
      });
    }

    // Deduct stock
    orderItems.forEach(item => {
      const product = store.products.get(item.productId);
      product.stock -= item.quantity;
      product.updatedAt = new Date().toISOString();
      store.products.set(item.productId, product);
    });

    const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0);
    const tax = parseFloat((subtotal * 0.08).toFixed(2));
    const shipping = subtotal >= 100 ? 0 : 9.99;
    const total = parseFloat((subtotal + tax + shipping).toFixed(2));

    const order = {
      id: uuidv4(),
      orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: req.user.sub,
      status: 'confirmed',
      items: orderItems,
      shippingAddress: req.body.shippingAddress,
      paymentMethod: req.body.paymentMethod,
      paymentStatus: 'paid',
      pricing: { subtotal, tax, shipping, total },
      estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      timeline: [
        { status: 'confirmed', timestamp: new Date().toISOString(), note: 'Order placed and confirmed' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.orders.set(order.id, order);

    // Clear cart
    cart.items = [];
    cart.updatedAt = new Date().toISOString();
    store.carts.set(req.user.sub, cart);

    logger.info('Order created', { orderId: order.id, orderNumber: order.orderNumber, userId: req.user.sub, total });

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: { order },
    });
  }
);

// ─── PATCH /api/orders/:id/status ─────────────────────────────────────────────
router.patch(
  '/:id/status',
  authorize('admin', 'manager'),
  [
    param('id').isUUID(),
    body('status').isIn(ORDER_STATUSES).withMessage(`Status must be one of: ${ORDER_STATUSES.join(', ')}`),
    body('note').optional().trim().isLength({ max: 500 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }

    const order = store.orders.get(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found', code: 'ORDER_NOT_FOUND' });
    }

    const { status, note } = req.body;
    order.status = status;
    order.timeline.push({
      status,
      timestamp: new Date().toISOString(),
      note: note || `Status updated to ${status}`,
      updatedBy: req.user.sub,
    });
    order.updatedAt = new Date().toISOString();

    store.orders.set(order.id, order);
    logger.info('Order status updated', { orderId: order.id, status, updatedBy: req.user.sub });

    return res.status(200).json({ success: true, message: 'Order status updated', data: { order } });
  }
);

// ─── POST /api/orders/:id/cancel ──────────────────────────────────────────────
router.post('/:id/cancel', [param('id').isUUID()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Invalid order ID', code: 'INVALID_ID' });
  }

  const order = store.orders.get(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found', code: 'ORDER_NOT_FOUND' });
  }

  const isAdmin = ['admin', 'manager'].includes(req.user.role);
  if (!isAdmin && order.userId !== req.user.sub) {
    return res.status(403).json({ success: false, error: 'Access denied', code: 'AUTH_FORBIDDEN' });
  }

  if (['shipped', 'delivered', 'cancelled', 'refunded'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      error: `Cannot cancel an order with status: ${order.status}`,
      code: 'INVALID_STATE_TRANSITION',
    });
  }

  // Restore stock
  order.items.forEach(item => {
    const product = store.products.get(item.productId);
    if (product) {
      product.stock += item.quantity;
      store.products.set(item.productId, product);
    }
  });

  order.status = 'cancelled';
  order.timeline.push({ status: 'cancelled', timestamp: new Date().toISOString(), note: 'Order cancelled by user' });
  order.updatedAt = new Date().toISOString();
  store.orders.set(order.id, order);

  return res.status(200).json({ success: true, message: 'Order cancelled successfully', data: { order } });
});

module.exports = router;
