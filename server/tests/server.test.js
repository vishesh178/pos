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

