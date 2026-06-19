'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});
app.use('/api/', globalLimiter);

app.use(cors(config.cors));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(compression());
app.use(morgan('combined', { stream: logger.stream }));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'ecommerce-api',
    version: '1.0.0',
    environment: config.server.env,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'ecommerce-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

app.get('/api', (req, res) => {
  res.status(200).json({
    name: 'E-Commerce DevSecOps API',
    version: '1.0.0',
    description: 'Enterprise e-commerce backend secured with DevSecOps pipeline',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      cart: '/api/cart',
      orders: '/api/orders',
      health: '/api/health',
    },
    documentation: 'https://github.com/your-org/ecommerce-devsecops',
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
