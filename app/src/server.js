'use strict';

const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

const { port, host, env } = config.server;

const server = app.listen(port, host, () => {
  logger.info('E-Commerce API running', {
    host,
    port,
    env,
    url: `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`,
  });
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  server.close(() => {
    logger.info('HTTP server closed. Process exiting.');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  process.exit(1);
});

module.exports = server;
