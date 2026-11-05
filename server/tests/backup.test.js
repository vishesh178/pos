const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { generateToken } = require('../src/middleware/auth');
const prisma = require('../src/prisma');
const { performDailyAutoBackup } = require('../src/services/backupScheduler');
const { encryptBuffer, decryptBuffer } = require('../src/utils/crypto');

test('Backup system - Vault status and safe operations', async () => {
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  assert.ok(adminUser, 'Admin user must exist for backup tests');

  const token = generateToken(adminUser);
  assert.ok(token);

  // Test buffer encryption & decryption
  const sampleData = Buffer.from('SQLite format 3 - Test Backup Data Content', 'utf8');
  const enc = encryptBuffer(sampleData);
  assert.ok(enc);
  assert.notDeepEqual(enc, sampleData);

  const dec = decryptBuffer(enc);
  assert.deepEqual(dec, sampleData);

  // Test automated backup scheduler helper without crashing
  performDailyAutoBackup();

  const backupsDir = path.resolve(__dirname, '../database/backups');
  assert.ok(fs.existsSync(backupsDir));

  // Check that backups dir contains files
  const files = fs.readdirSync(backupsDir);
  assert.ok(files.length > 0);
});
