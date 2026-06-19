// tests/auth.middleware.test.js
const jwt = require('jsonwebtoken');
const config = require('../app/src/config');
const logger = require('../app/src/utils/logger');

jest.mock('jsonwebtoken');
jest.mock('../app/src/config', () => ({ jwt: { secret: 'test-secret' } }));
jest.mock('../app/src/utils/logger', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
}));

const { authenticate, authorize, optionalAuth } = require('../app/src/middleware/auth');

describe('authenticate middleware', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const next = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
    next.mockReset();
  });

  test('rejects when Authorization header missing', () => {
    const req = { headers: {} };
    const res = mockRes();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authorization header is required',
      code: 'AUTH_HEADER_MISSING',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects when header format invalid', () => {
    const req = { headers: { authorization: 'BadFormat' } };
    const res = mockRes();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid authorization format. Use: Bearer <token>',
      code: 'AUTH_FORMAT_INVALID',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects expired token', () => {
    const req = { headers: { authorization: 'Bearer expired-token' } };
    const res = mockRes();
    const err = new Error('Token expired');
    err.name = 'TokenExpiredError';
    jwt.verify.mockImplementation(() => { throw err; });
    authenticate(req, res, next);
    expect(jwt.verify).toHaveBeenCalledWith('expired-token', 'test-secret');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Token has expired. Please log in again.',
      code: 'AUTH_TOKEN_EXPIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects invalid token', () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } };
    const res = mockRes();
    const err = new Error('Invalid');
    err.name = 'JsonWebTokenError';
    jwt.verify.mockImplementation(() => { throw err; });
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid token',
      code: 'AUTH_TOKEN_INVALID',
    });
  });

  test('passes valid token', () => {
    const decoded = { sub: 'user1', email: 'user@example.com', role: 'user' };
    jwt.verify.mockReturnValue(decoded);
    const req = { headers: { authorization: 'Bearer valid-token' } };
    const res = {};
    authenticate(req, res, next);
    expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    expect(req.user).toEqual(decoded);
    expect(logger.debug).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

describe('authorize middleware', () => {
  const req = { user: { sub: 'user1', role: 'admin' } };
  const res = {
    status: jest.fn().mockReturnValue({ json: jest.fn() }),
    json: jest.fn(),
  };
  const next = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
    next.mockReset();
  });

  test('allows when role matches', () => {
    const middleware = authorize('admin', 'user');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects when role does not match', () => {
    const middleware = authorize('user');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.status().json).toHaveBeenCalledWith({
      success: false,
      error: 'You do not have permission to perform this action',
      code: 'AUTH_FORBIDDEN',
    });
  });
});

describe('optionalAuth middleware', () => {
  const next = jest.fn();
  afterEach(() => {
    jest.clearAllMocks();
    next.mockReset();
  });

  test('passes through when no header', () => {
    const req = {};
    const res = {};
    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  test('attaches user when valid token', () => {
    const decoded = { sub: 'user1', role: 'user' };
    jwt.verify.mockReturnValue(decoded);
    const req = { headers: { authorization: 'Bearer good-token' } };
    const res = {};
    optionalAuth(req, res, next);
    expect(req.user).toEqual(decoded);
    expect(next).toHaveBeenCalled();
  });

  test('ignores invalid token', () => {
    jwt.verify.mockImplementation(() => { throw new Error('bad'); });
    const req = { headers: { authorization: 'Bearer bad-token' } };
    const res = {};
    optionalAuth(req, res, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
