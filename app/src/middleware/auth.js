'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * JWT Authentication Middleware
 * Validates Bearer tokens on protected routes.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Authorization header is required',
      code: 'AUTH_HEADER_MISSING',
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      error: 'Invalid authorization format. Use: Bearer <token>',
      code: 'AUTH_FORMAT_INVALID',
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    logger.debug('Token verified', { userId: decoded.sub, email: decoded.email });
    next();
  } catch (err) {
    logger.warn('Token verification failed', { error: err.message });

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired. Please log in again.',
        code: 'AUTH_TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'AUTH_TOKEN_INVALID',
    });
  }
};

/**
 * Role-based authorization middleware factory.
 * @param {string[]} roles - Allowed roles
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  if (!roles.includes(req.user.role)) {
    logger.warn('Authorization failed', {
      userId: req.user.sub,
      requiredRoles: roles,
      userRole: req.user.role,
    });
    return res.status(403).json({
      success: false,
      error: 'You do not have permission to perform this action',
      code: 'AUTH_FORBIDDEN',
    });
  }

  next();
};

/**
 * Optional authentication — does not reject unauthenticated requests,
 * but attaches user info if token is valid.
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next();
  }

  try {
    const decoded = jwt.verify(parts[1], config.jwt.secret);
    req.user = decoded;
  } catch {
    // Token is invalid but not required, continue without user
  }

  next();
};

module.exports = { authenticate, authorize, optionalAuth };
