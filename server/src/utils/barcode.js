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
 * Department 2-letter mapping for Curated Art showroom catalog
 */
const DEPT_2_LETTER_MAP = {
  'SHOWPIC': 'SP', 'SHOWPIECE': 'SP', 'SHOWPIECES': 'SP', 'SCULPTURE': 'SP', 'STATUE': 'SP', 'IDOL': 'SP',
  'WALL CLOCK': 'WC', 'WALL CLOCKS': 'WC', 'CLOCK': 'WC',
  'WALL PIC': 'WP', 'WALL PICTURE': 'WP', 'WALL ART': 'WP', 'CANVAS': 'WP', 'PAINTING': 'WP', 'FRAME': 'WP',
  'FLOWER POT': 'FP', 'POT': 'FP', 'PLANTER': 'FP', 'VASE': 'FP',
  'FLOWER': 'FL', 'GRASS': 'FL', 'BONSAI': 'FL',
  'PLANT': 'PL', 'BAMBOO': 'PL', 'TREE': 'PL',
  'STONE': 'ST', 'PEBBLE': 'ST', 'CHIP': 'ST',
  'PHOTOFRAME': 'PF', 'PHOTO FRAME': 'PF',
  'NIGHTLAMP': 'NL', 'NIGHT LAMP': 'NL', 'LAMP': 'NL',
  'SWIMMING': 'SW', 'SWIM': 'SW',
  'RACKET': 'RC',
  'SCOOTER': 'SC',
  'SKETCHING': 'SK',
  'SCKETING': 'SK', 'SKATING': 'SK',
  'CRYSTAL FISH': 'CF',
  'THORMOS': 'TH', 'THERMOS': 'TH',
  'METAL STAND': 'MS',
  'SERVICES': 'SR', 'FITTING': 'SR', 'TRANSPORT': 'SR',
  'PACKING': 'PK', 'BOX': 'PK', 'TAPE': 'PK'
};

/**
 * Generate Smart SKU following the [Dept 2 Letters]-[BK Number/Code]-[Tier] format
 * e.g., SP-BK2088-A1680, WC-BK64-A2350, FP-FP60-A450, ST-AQUONY
 */
function generateSmartSku(productName = '', categoryName = '', fallbackId = '') {
  const name = String(productName || '').trim();
  const cat = String(categoryName || '').trim().toUpperCase();

  // 1. Detect 2-Letter Department Code
  let dept = 'GN';
  for (const [k, v] of Object.entries(DEPT_2_LETTER_MAP)) {
    if (cat.includes(k) || name.toUpperCase().startsWith(k)) {
      dept = v;
      break;
    }
  }
  if (dept === 'GN') {
    if (/^SHP\b/i.test(name)) dept = 'SP';
    else if (/^WC\b/i.test(name)) dept = 'WC';
    else if (/^WP\b/i.test(name)) dept = 'WP';
    else if (/^FP\b/i.test(name)) dept = 'FP';
    else if (/^FL\b/i.test(name)) dept = 'FL';
    else if (/^PL\b/i.test(name)) dept = 'PL';
    else if (/^PF\b/i.test(name)) dept = 'PF';
    else if (/^NL\b/i.test(name)) dept = 'NL';
    else if (/^SW\b/i.test(name)) dept = 'SW';
    else if (/^RC\b/i.test(name)) dept = 'RC';
    else if (/^SC\b/i.test(name)) dept = 'SC';
  }

  // 2. Extract Tier (e.g. A1680, A450, A95)
  const tierMatch = name.match(/\bA(\d{2,5})\b/i);
  const tier = tierMatch ? 'A' + tierMatch[1] : '';

  // 3. Extract BK Number or Model Code
  let code = '';
  const bkMatch = name.match(/BK\s*-\s*([A-Za-z0-9\-]+)/i);
  const compoundBk = name.match(/\b(BK[A-Za-z]{1,4}-\d+[A-Za-z]?)\b/i) || 
                     name.match(/\b(BK\d+[A-Za-z]?)\b/i) || 
                     name.match(/\b(BKSP\d+[A-Za-z]?)\b/i);

  if (bkMatch) {
    code = 'BK' + bkMatch[1].replace(/[^A-Za-z0-9]/g, '');
  } else if (compoundBk) {
    code = compoundBk[1].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  } else {
    // Strip tier and leading department prefix from name to avoid matching them as model
    let cleanName = name;
    if (tier) {
      cleanName = cleanName.replace(new RegExp('\\b' + tier + '\\b', 'i'), ' ');
    }
    cleanName = cleanName.replace(new RegExp('^' + dept + '\\b', 'i'), ' ');

    const modelMatch = cleanName.match(/\b([A-Za-z]{1,4}[- ]?\d+[A-Za-z]?)\b/) ||
                       cleanName.match(/\b(\d{4,6})\b/) ||
                       cleanName.match(/\b([A-Z]-\d+)\b/);
    if (modelMatch) {
      code = modelMatch[1].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    } else {
      const words = cleanName.replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        code = (words[0].substring(0, 3) + words[1].substring(0, 3)).toUpperCase();
      } else if (words.length === 1 && words[0]) {
        code = words[0].substring(0, 6).toUpperCase();
      } else {
        code = 'ITM' + (fallbackId || '001');
      }
    }
  }

  return tier ? `${dept}-${code}-${tier}` : `${dept}-${code}`;
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

const VALID_DEPTS = new Set([
  'SP', 'WC', 'WP', 'FP', 'FL', 'PL', 'ST', 'PF', 'NL', 'SW', 'RC', 'SC', 'SK', 'CF', 'TH', 'MS', 'SR', 'PK', 'GN'
]);

function isSmartSku(sku) {
  if (!sku || typeof sku !== 'string') return false;
  const parts = sku.trim().split('-');
  if (parts.length < 2) return false;
  return VALID_DEPTS.has(parts[0].toUpperCase());
}

module.exports = {
  calculateEan13Checksum,
  generateEan13Barcode,
  isValidEan13,
  generateSku,
  generateSmartSku,
  isSmartSku,
  DEPT_2_LETTER_MAP,
};

