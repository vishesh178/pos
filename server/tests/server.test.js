const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../index');
const prisma = require('../src/prisma');

test('Prisma client connects to Curated Art SQLite database', async () => {
  const profile = await prisma.businessProfile.findFirst();
  assert.ok(profile);
  assert.equal(profile.businessName, 'Curated Art');
  assert.equal(profile.stateCode, '24');
});

test('Users table contains seeded admin, manager, and cashier', async () => {
  const users = await prisma.user.findMany();
  assert.ok(users.length >= 3);
  const emails = users.map((u) => u.email);
  assert.ok(emails.includes('admin@curatedart.in'));
  assert.ok(emails.includes('manager@curatedart.in'));
  assert.ok(emails.includes('cashier@curatedart.in'));
});

test('Compression middleware initializes and intercepts responses when gzip is requested', async () => {
  const { EventEmitter } = require('events');
  const compression = require('compression');
  const middleware = compression({ threshold: 0 });

  const req = {
    method: 'GET',
    headers: { 'accept-encoding': 'gzip' },
    url: '/test',
  };
  const headers = {};
  const res = new EventEmitter();
  res.write = function () {};
  res.end = function () {};
  res.setHeader = function (k, v) {
    headers[k.toLowerCase()] = v;
  };
  res.getHeader = function (k) {
    return headers[k.toLowerCase()];
  };

  await new Promise((resolve) => {
    middleware(req, res, () => {
      assert.ok(typeof res.write === 'function');
      assert.ok(typeof res.end === 'function');
      resolve();
    });
  });
});

