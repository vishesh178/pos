const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt, encryptBuffer, decryptBuffer } = require('../src/utils/crypto');
const { generateToken } = require('../src/middleware/auth');
const jwt = require('jsonwebtoken');

test('Crypto utility encrypts and decrypts with AES-256-GCM', () => {
  const secret = 'erp_secret_12345_token_xyz';
  const encrypted = encrypt(secret);
  assert.notEqual(encrypted, secret);
  assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

  const decrypted = decrypt(encrypted);
  assert.equal(decrypted, secret);
});

test('Crypto utility encrypts and decrypts binary SQLite buffers', () => {
  const dummyDbBuffer = Buffer.from('SQLite format 3\0\x10\x00\x01\x01\x00@  \x00\x00\x00\x01', 'utf8');
  const encryptedBuffer = encryptBuffer(dummyDbBuffer);
  assert.ok(encryptedBuffer);
  assert.ok(encryptedBuffer.length > dummyDbBuffer.length);
  assert.notDeepEqual(encryptedBuffer, dummyDbBuffer);

  const decryptedBuffer = decryptBuffer(encryptedBuffer);
  assert.deepEqual(decryptedBuffer, dummyDbBuffer);
});

test('JWT authentication generates verifiable token with user payload', () => {
  const dummyUser = {
    id: 'user-test-01',
    name: 'Test Cashier',
    email: 'cashier@curatedart.in',
    role: 'BILLING',
  };

  const token = generateToken(dummyUser);
  assert.ok(token);

  const decoded = jwt.decode(token);
  assert.equal(decoded.id, dummyUser.id);
  assert.equal(decoded.email, dummyUser.email);
  assert.equal(decoded.role, dummyUser.role);
});

test('Password hashing produces valid bcrypt match', () => {
  const password = 'curatedPassword2026';
  const hash = bcrypt.hashSync(password, 10);
  assert.ok(bcrypt.compareSync(password, hash));
  assert.ok(!bcrypt.compareSync('wrongPassword', hash));
});

