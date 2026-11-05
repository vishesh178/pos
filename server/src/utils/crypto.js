const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Derive 32-byte key from APP_ENCRYPTION_KEY or a machine-consistent fallback
function getEncryptionKey() {
  const secret = process.env.APP_ENCRYPTION_KEY || 'curated_art_default_secure_vault_2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt plaintext string with AES-256-GCM
 * Output format: iv:authTag:encryptedHex
 */
function encrypt(plaintext) {
  if (!plaintext) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt string encrypted with encrypt()
 */
function decrypt(cipherString) {
  if (!cipherString) return null;
  try {
    const parts = cipherString.split(':');
    if (parts.length !== 3) return null;
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return null;
  }
}

/**
 * Encrypt binary buffer with AES-256-GCM
 * Output format: [16 bytes IV][16 bytes AuthTag][Encrypted ciphertext bytes]
 */
function encryptBuffer(buffer) {
  if (!buffer) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt binary buffer encrypted with encryptBuffer()
 */
function decryptBuffer(encryptedBuffer) {
  if (!encryptedBuffer || encryptedBuffer.length < IV_LENGTH + AUTH_TAG_LENGTH) return null;
  try {
    const key = getEncryptionKey();
    const iv = encryptedBuffer.subarray(0, IV_LENGTH);
    const authTag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedData = encryptedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  } catch (err) {
    console.error('Binary decryption failed:', err.message);
    return null;
  }
}

module.exports = {
  encrypt,
  decrypt,
  encryptBuffer,
  decryptBuffer,
};

