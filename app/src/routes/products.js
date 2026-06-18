'use strict';

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const store = require('../models/store');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// ─── GET /api/products ─────────────────────────────────────────────────────────
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('category').optional().trim().escape(),
    query('search').optional().trim(),
    query('minPrice').optional().isFloat({ min: 0 }).toFloat(),
    query('maxPrice').optional().isFloat({ min: 0 }).toFloat(),
    query('sortBy').optional().isIn(['price', 'name', 'rating', 'createdAt']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid query parameters', details: errors.array() });
    }

    const {
      page = 1,
      limit = 12,
      category,
      search,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    let products = Array.from(store.products.values());

    // Filter by category
    if (category) {
      products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }

    // Filter by search
    if (search) {
      const term = search.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.tags.some(t => t.toLowerCase().includes(term))
      );
    }

    // Filter by price range
    if (minPrice !== undefined) {
      products = products.filter(p => p.price >= minPrice);
    }
    if (maxPrice !== undefined) {
      products = products.filter(p => p.price <= maxPrice);
    }

    // Sort
    products.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const direction = sortOrder === 'asc' ? 1 : -1;
      if (typeof aVal === 'string') return aVal.localeCompare(bVal) * direction;
      return (aVal - bVal) * direction;
    });

    // Paginate
    const total = products.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginated = products.slice(start, start + limit);

    return res.status(200).json({
      success: true,
      data: {
        products: paginated,
        pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
      },
    });
  }
);

// ─── GET /api/products/categories ─────────────────────────────────────────────
router.get('/categories', (req, res) => {
  const products = Array.from(store.products.values());
  const categories = [...new Set(products.map(p => p.category))].sort();

  return res.status(200).json({
    success: true,
    data: { categories },
  });
});

// ─── GET /api/products/:id ─────────────────────────────────────────────────────
router.get('/:id', [param('id').isUUID()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Invalid product ID format', code: 'INVALID_ID' });
  }

  const product = store.products.get(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
  }

  return res.status(200).json({ success: true, data: { product } });
});

// ─── POST /api/products ────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('admin', 'manager'),
  [
    body('name').trim().isLength({ min: 2, max: 200 }).withMessage('Name must be 2-200 characters'),
    body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('price').isFloat({ min: 0.01 }).withMessage('Price must be a positive number'),
    body('category').trim().isLength({ min: 2 }).withMessage('Category is required'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    body('sku').trim().isLength({ min: 2 }).withMessage('SKU is required'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }

    const { name, description, price, category, stock, sku, imageUrl, tags } = req.body;

    // Check for duplicate SKU
    const existingSku = Array.from(store.products.values()).find(p => p.sku === sku);
    if (existingSku) {
      return res.status(409).json({ success: false, error: 'SKU already exists', code: 'SKU_DUPLICATE' });
    }

    const product = {
      id: uuidv4(),
      name,
      description,
      price: parseFloat(price),
      category,
      stock: parseInt(stock, 10),
      sku,
      imageUrl: imageUrl || null,
      tags: Array.isArray(tags) ? tags : [],
      rating: 0,
      reviewCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.products.set(product.id, product);
    logger.info('Product created', { productId: product.id, name: product.name, userId: req.user.sub });

    return res.status(201).json({ success: true, message: 'Product created successfully', data: { product } });
  }
);

// ─── PUT /api/products/:id ─────────────────────────────────────────────────────
router.put(
  '/:id',
  authenticate,
  authorize('admin', 'manager'),
  [
    param('id').isUUID(),
    body('price').optional().isFloat({ min: 0.01 }),
    body('stock').optional().isInt({ min: 0 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }

    const product = store.products.get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
    }

    const allowedFields = ['name', 'description', 'price', 'category', 'stock', 'imageUrl', 'tags'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });
    product.updatedAt = new Date().toISOString();

    store.products.set(product.id, product);
    logger.info('Product updated', { productId: product.id, userId: req.user.sub });

    return res.status(200).json({ success: true, message: 'Product updated', data: { product } });
  }
);

// ─── DELETE /api/products/:id ──────────────────────────────────────────────────
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  [param('id').isUUID()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid product ID format', code: 'INVALID_ID' });
    }

    const product = store.products.get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
    }

    store.products.delete(req.params.id);
    logger.info('Product deleted', { productId: req.params.id, userId: req.user.sub });

    return res.status(200).json({ success: true, message: 'Product deleted successfully' });
  }
);

module.exports = router;
