/**
 * Calculate the GS1 standard checksum digit for a 12-digit EAN-13 base
 */
function calculateEan13Checksum(code12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Generate a valid 13-digit EAN-13 barcode
 * 890 (India) + 8001 (Curated Art) + 5-digit sequence + 1 checksum digit
 */
function generateEan13Barcode(counterNumber = 1) {
  const countryPrefix = '890';
  const companyPrefix = '8001';
  const itemCode = String(counterNumber).padStart(5, '0');
  const code12 = `${countryPrefix}${companyPrefix}${itemCode}`;
  const checksum = calculateEan13Checksum(code12);
  return `${code12}${checksum}`;
}

/**
 * Validate whether a string is a valid EAN-13 barcode
 */
function isValidEan13(barcode) {
  if (!barcode || typeof barcode !== 'string') return false;
  const clean = barcode.trim().replace(/'/g, '');
  if (!/^\d{13}$/.test(clean)) return false;
  const code12 = clean.slice(0, 12);
  const expectedChecksum = calculateEan13Checksum(code12);
  return parseInt(clean[12], 10) === expectedChecksum;
}

/**
 * Generate SKU based on category name and counter
 * e.g., CA-MF-2026-0008
 */
function generateSku(categoryName = 'General', counter = 1) {
  const prefixMap = {
    'Metal Wall Art': 'MF',
    'Wall Clocks': 'WC',
    'Ceramic Planters': 'PL',
    'Showpieces & Sculptures': 'SP',
    'Framed Canvas Art': 'WF',
    'Artificial Flowers': 'AF',
    'Decorative Pots & Urns': 'DP',
  };

  const prefix = prefixMap[categoryName] || 'GN';
  const year = new Date().getFullYear();
  const seq = String(counter).padStart(4, '0');
  return `CA-${prefix}-${year}-${seq}`;
}

module.exports = {
  calculateEan13Checksum,
  generateEan13Barcode,
  isValidEan13,
  generateSku,
};

