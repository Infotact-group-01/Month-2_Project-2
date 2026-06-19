// tests/errorHandler.test.js
const logger = require('../app/src/utils/logger');

jest.mock('../app/src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

const { errorHandler, notFoundHandler } = require('../app/src/middleware/errorHandler');

// Helper to mock response object
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('handles ValidationError with 400', () => {
    const err = { name: 'ValidationError', details: 'Invalid data', message: 'Bad' };
    const req = { originalUrl: '/test', method: 'POST', ip: '1.2.3.4' };
    const res = mockRes();
    errorHandler(err, req, res, null);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      details: 'Invalid data',
      code: 'VALIDATION_ERROR',
    });
    expect(logger.error).toHaveBeenCalled();
  });

  test('handles JWT errors with 401', () => {
    const err = { name: 'JsonWebTokenError' };
    const req = { originalUrl: '/auth', method: 'GET', ip: '1.2.3.4' };
    const res = mockRes();
    errorHandler(err, req, res, null);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR',
    });
  });

  test('handles SyntaxError with 400', () => {
    const err = new SyntaxError('Unexpected token');
    err.status = 400;
    const req = { originalUrl: '/json', method: 'POST', ip: '1.2.3.4' };
    const res = mockRes();
    errorHandler(err, req, res, null);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    });
  });

  test('handles generic internal error (non‑production)', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const err = new Error('Something went wrong');
    err.status = 500;
    const req = { originalUrl: '/fail', method: 'GET', ip: '1.2.3.4' };
    const res = mockRes();
    errorHandler(err, req, res, null);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Something went wrong',
        code: 'INTERNAL_ERROR',
        stack: err.stack,
      })
    );
    process.env.NODE_ENV = prevEnv;
  });

  test('handles generic internal error (production)', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const err = new Error('Sensitive info');
    err.status = 500;
    const req = { originalUrl: '/fail', method: 'GET', ip: '1.2.3.4' };
    const res = mockRes();
    errorHandler(err, req, res, null);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
      code: 'INTERNAL_ERROR',
    });
    process.env.NODE_ENV = prevEnv;
  });
});

describe('notFoundHandler', () => {
  test('returns 404 with proper message', () => {
    const req = { originalUrl: '/unknown', method: 'GET' };
    const res = mockRes();
    notFoundHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Route GET /unknown not found',
      code: 'ROUTE_NOT_FOUND',
    });
    expect(logger.warn).toHaveBeenCalled();
  });
});
