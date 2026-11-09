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

// Configure high-performance, crash-safe SQLite PRAGMAs
async function initSqlitePragmas() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 10000;');
    await prisma.$queryRawUnsafe('PRAGMA cache_size = -64000;');
    await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
  } catch (err) {
    // Non-fatal if running in test or during raw migration
  }
}
initSqlitePragmas();

module.exports = prisma;
