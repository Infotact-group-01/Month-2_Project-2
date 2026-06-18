'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const config = require('../config');
const store = require('../models/store');
const logger = require('../utils/logger');

const router = express.Router();

// ─── Rate Limiters ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    error: 'Too many login attempts. Please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    error: 'Too many registration attempts. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

// ─── Helpers ───────────────────────────────────────────────────────────────────
const generateTokens = (user) => {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  const refreshToken = jwt.sign(
    { sub: user.id, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  return { accessToken, refreshToken };
};

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  createdAt: user.createdAt,
});

// ─── POST /api/auth/register ───────────────────────────────────────────────────
router.post(
  '/register',
  registerLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character'),
    body('firstName').trim().isLength({ min: 1, max: 50 }).withMessage('First name is required'),
    body('lastName').trim().isLength({ min: 1, max: 50 }).withMessage('Last name is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR',
        });
      }

      const { email, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = Array.from(store.users.values())
        .find(u => u.email === email.toLowerCase());

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email already exists',
          code: 'EMAIL_TAKEN',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);

      // Create user
      const user = {
        id: uuidv4(),
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        role: 'customer',
        loginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.users.set(user.id, user);

      const { accessToken, refreshToken } = generateTokens(user);

      logger.info('User registered', { userId: user.id, email: user.email });

      return res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: {
          user: sanitizeUser(user),
          accessToken,
          refreshToken,
          expiresIn: config.jwt.expiresIn,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR',
        });
      }

      const { email, password } = req.body;

      const user = Array.from(store.users.values())
        .find(u => u.email === email.toLowerCase());

      // Always compare to prevent timing attacks
      if (!user) {
        await bcrypt.compare(password, '$2b$12$invalidhashplaceholder1234567890');
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
          code: 'AUTH_INVALID_CREDENTIALS',
        });
      }

      // Check lockout
      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        const lockRemaining = Math.ceil((new Date(user.lockedUntil) - new Date()) / 1000 / 60);
        return res.status(423).json({
          success: false,
          error: `Account locked. Try again in ${lockRemaining} minute(s).`,
          code: 'ACCOUNT_LOCKED',
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        user.loginAttempts = (user.loginAttempts || 0) + 1;

        if (user.loginAttempts >= config.security.maxLoginAttempts) {
          user.lockedUntil = new Date(Date.now() + config.security.lockoutDuration).toISOString();
          user.loginAttempts = 0;
          store.users.set(user.id, user);
          logger.warn('Account locked due to too many failed attempts', { userId: user.id });
          return res.status(423).json({
            success: false,
            error: 'Account locked due to too many failed attempts. Try again in 15 minutes.',
            code: 'ACCOUNT_LOCKED',
          });
        }

        store.users.set(user.id, user);
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
          code: 'AUTH_INVALID_CREDENTIALS',
          attemptsRemaining: config.security.maxLoginAttempts - user.loginAttempts,
        });
      }

      // Reset login attempts on success
      user.loginAttempts = 0;
      user.lockedUntil = null;
      user.lastLoginAt = new Date().toISOString();
      store.users.set(user.id, user);

      const { accessToken, refreshToken } = generateTokens(user);

      logger.info('User logged in', { userId: user.id, email: user.email });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: sanitizeUser(user),
          accessToken,
          refreshToken,
          expiresIn: config.jwt.expiresIn,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
        code: 'REFRESH_TOKEN_MISSING',
      });
    }

    const decoded = jwt.verify(refreshToken, config.jwt.secret);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    const user = store.users.get(decoded.sub);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const tokens = generateTokens(user);

    return res.status(200).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: config.jwt.expiresIn,
      },
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }
    next(err);
  }
});

// ─── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', require('../middleware/auth').authenticate, (req, res) => {
  const user = store.users.get(req.user.sub);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
      code: 'USER_NOT_FOUND',
    });
  }

  return res.status(200).json({
    success: true,
    data: { user: sanitizeUser(user) },
  });
});

// ─── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', require('../middleware/auth').authenticate, (req, res) => {
  // In production, invalidate the token in a blocklist/Redis store
  logger.info('User logged out', { userId: req.user.sub });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

module.exports = router;
