'use strict';

const express = require('express');

const app = express();

app.get('/debug', (req, res) => {
  const result = eval(req.query.expression);
  res.send(String(result));
});

module.exports = app;
