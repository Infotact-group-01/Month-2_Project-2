'use strict';

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const store = require('../models/store');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All cart routes require authentication
router.use(authenticate);

// Helper: get or create cart for user
const getOrCreateCart = (userId) => {
  if (!store.carts.has(userId)) {
    store.carts.set(userId, {
      id: uuidv4(),
      userId,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return store.carts.get(userId);
};

// Helper: calculate cart totals
const calculateTotals = (items) => {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.08;
  const shipping = subtotal >= 100 ? 0 : 9.99;
  const total = subtotal + tax + shipping;
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    shipping: parseFloat(shipping.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
};

// ─── GET /api/cart ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const cart = getOrCreateCart(req.user.sub);
  return res.status(200).json({
    success: true,
    data: { cart: { ...cart, totals: calculateTotals(cart.items) } },
  });
});

// ─── POST /api/cart/items ──────────────────────────────────────────────────────
router.post(
  '/items',
  [
    body('productId').isUUID().withMessage('Valid product ID required'),
    body('quantity').isInt({ min: 1, max: 99 }).withMessage('Quantity must be between 1 and 99'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }

    const { productId, quantity } = req.body;
    const product = store.products.get(productId);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient stock. Only ${product.stock} units available.`,
        code: 'INSUFFICIENT_STOCK',
      });
    }

    const cart = getOrCreateCart(req.user.sub);
    const existingItem = cart.items.find(i => i.productId === productId);

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (newQty > product.stock) {
        return res.status(400).json({
          success: false,
          error: `Cannot add ${quantity} more. Only ${product.stock - existingItem.quantity} additional units available.`,
          code: 'INSUFFICIENT_STOCK',
        });
      }
      existingItem.quantity = newQty;
      existingItem.updatedAt = new Date().toISOString();
    } else {
      cart.items.push({
        id: uuidv4(),
        productId,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        quantity,
        sku: product.sku,
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    cart.updatedAt = new Date().toISOString();
    store.carts.set(req.user.sub, cart);

    logger.info('Item added to cart', { userId: req.user.sub, productId, quantity });

    return res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: { cart: { ...cart, totals: calculateTotals(cart.items) } },
    });
  }
);

// ─── PATCH /api/cart/items/:itemId ─────────────────────────────────────────────
router.patch(
  '/items/:itemId',
  [
    param('itemId').isUUID(),
    body('quantity').isInt({ min: 0, max: 99 }).withMessage('Quantity must be between 0 and 99'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }

    const cart = getOrCreateCart(req.user.sub);
    const itemIndex = cart.items.findIndex(i => i.id === req.params.itemId);

    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: 'Cart item not found', code: 'ITEM_NOT_FOUND' });
    }

    const { quantity } = req.body;

    if (quantity === 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      const product = store.products.get(cart.items[itemIndex].productId);
      if (product && quantity > product.stock) {
        return res.status(400).json({
          success: false,
          error: `Only ${product.stock} units available`,
          code: 'INSUFFICIENT_STOCK',
        });
      }
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].updatedAt = new Date().toISOString();
    }

    cart.updatedAt = new Date().toISOString();
    store.carts.set(req.user.sub, cart);

    return res.status(200).json({
      success: true,
      message: quantity === 0 ? 'Item removed from cart' : 'Cart updated',
      data: { cart: { ...cart, totals: calculateTotals(cart.items) } },
    });
  }
);

// ─── DELETE /api/cart/items/:itemId ────────────────────────────────────────────
router.delete('/items/:itemId', [param('itemId').isUUID()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Invalid item ID', code: 'INVALID_ID' });
  }

  const cart = getOrCreateCart(req.user.sub);
  const itemIndex = cart.items.findIndex(i => i.id === req.params.itemId);

  if (itemIndex === -1) {
    return res.status(404).json({ success: false, error: 'Cart item not found', code: 'ITEM_NOT_FOUND' });
  }

  cart.items.splice(itemIndex, 1);
  cart.updatedAt = new Date().toISOString();
  store.carts.set(req.user.sub, cart);

  return res.status(200).json({
    success: true,
    message: 'Item removed from cart',
    data: { cart: { ...cart, totals: calculateTotals(cart.items) } },
  });
});

// ─── DELETE /api/cart ──────────────────────────────────────────────────────────
router.delete('/', (req, res) => {
  const cart = getOrCreateCart(req.user.sub);
  cart.items = [];
  cart.updatedAt = new Date().toISOString();
  store.carts.set(req.user.sub, cart);

  return res.status(200).json({ success: true, message: 'Cart cleared successfully' });
});

module.exports = router;
