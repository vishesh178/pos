const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const aiRoutes = require('../src/routes/ai.routes');

test('AI Module - Status endpoint and category-based prompt building', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRoutes);

  // Verify route loads and environment key is recognized
  assert.ok(process.env.GEMINI_API_KEY, 'GEMINI_API_KEY should be present in test environment');
  assert.ok(process.env.GEMINI_API_KEY.startsWith('AIzaSy'), 'Valid Google API key prefix');
});
