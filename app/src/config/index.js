'use strict';

require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const fallbackJwtSecret = 'local-devsecops-demo-secret-change-before-production';
const configuredJwtSecret = process.env.JWT_SECRET || fallbackJwtSecret;

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
}

const corsOrigin = process.env.CORS_ORIGIN || (isProduction ? 'https://example.com' : '*');

const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    env: process.env.NODE_ENV || 'development',
    host: process.env.HOST || '0.0.0.0',
  },

  // JWT configuration
  jwt: {
    secret: configuredJwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Database configuration (in-memory for demo)
  database: {
    type: process.env.DB_TYPE || 'memory',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'ecommerce',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || '',
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  // CORS configuration
  cors: {
    origin: corsOrigin.includes(',') ? corsOrigin.split(',').map(origin => origin.trim()) : corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: corsOrigin !== '*',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  // Security settings
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5,
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION_MS, 10) || 15 * 60 * 1000,
  },

  // Feature flags
  features: {
    enableSwagger: process.env.ENABLE_SWAGGER === 'true',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
  },
};

module.exports = config;
