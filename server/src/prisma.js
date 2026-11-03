const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Compute absolute path to SQLite file
const dbAbsolutePath = path.resolve(__dirname, '../database/curated_art.db');
process.env.DATABASE_URL = `file:${dbAbsolutePath}`;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbAbsolutePath}`,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
