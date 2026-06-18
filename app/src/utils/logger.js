'use strict';

const winston = require('winston');
const config = require('../config');

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const logger = winston.createLogger({
  level: config.logging.level,
  format: config.logging.format === 'json'
    ? combine(timestamp(), errors({ stack: true }), json())
    : combine(colorize(), simple()),
  defaultMeta: {
    service: 'ecommerce-api',
    version: '1.0.0',
  },
  transports: [
    new winston.transports.Console(),
  ],
});

// Stream for Morgan HTTP logger
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
