const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  generateCatalogPdf,
  extractDimensions,
  resolvePrice,
  formatRupees,
} = require('../src/utils/catalogPdf');

test('Catalog PDF - Helper Functions', () => {
  // Dimension extraction
  assert.strictEqual(extractDimensions('Deer Statue 15x25 cm White'), '15X25 CM');
  assert.strictEqual(extractDimensions('Wall Clock 12 X 18 IN Brass'), '12 X 18 IN');
  assert.strictEqual(extractDimensions('Vase Without Dims'), '');

  // Price resolution
  const item = { mrp: 4500, sellingPrice: 3800, wholesalePrice: 3000 };
  assert.strictEqual(resolvePrice(item, 'mrp'), 4500);
  assert.strictEqual(resolvePrice(item, 'sellingPrice'), 3800);
  assert.strictEqual(resolvePrice(item, 'wholesalePrice'), 3000);

  // Rupee formatting
  assert.strictEqual(formatRupees(3585), 'Rs.3,585/-');
  assert.strictEqual(formatRupees(150000), 'Rs.1,50,000/-');
});

test('Catalog PDF - Lookbook 1-Per-Slide PDF Generation', async () => {
  const sampleProducts = [
    {
      id: 'p1',
      name: 'Geometric Deer Sculpture 15x25 cm',
      sku: 'BK-2154',
      category: { name: 'Artifacts' },
      mrp: 3585,
      sellingPrice: 3200,
      imageUrl: '/uploads/products/mockup-bk-2154-mw9gbc1s.jpg',
    },
    {
      id: 'p2',
      name: 'Minimalist Wall Clock 12x18 in',
      sku: 'WC-1001',
      category: { name: 'Wall Clock' },
      mrp: 4999,
      sellingPrice: 4500,
      imageUrl: null, // missing photo fallback test
    },
  ];

  const buffer = await generateCatalogPdf(sampleProducts, {
    gridCols: 1,
    priceType: 'mrp',
    minimalist: false,
  });

  assert.ok(Buffer.isBuffer(buffer), 'Result must be a Buffer');
  assert.ok(buffer.length > 5000, 'Buffer should contain PDF data');
  // Check PDF signature %PDF-
  assert.strictEqual(buffer.subarray(0, 4).toString(), '%PDF');
});

test('Catalog PDF - Multi-Column A4 Generation (2 and 3 cols)', async () => {
  const sampleProducts = [
    {
      id: 'p1',
      name: 'Item 1',
      sku: 'SKU-1',
      mrp: 1000,
      imageUrl: null,
    },
    {
      id: 'p2',
      name: 'Item 2',
      sku: 'SKU-2',
      mrp: 2000,
      imageUrl: null,
    },
    {
      id: 'p3',
      name: 'Item 3',
      sku: 'SKU-3',
      mrp: 3000,
      imageUrl: null,
    },
  ];

  const buf2Col = await generateCatalogPdf(sampleProducts, {
    gridCols: 2,
    priceType: 'sellingPrice',
    showBusinessHeader: true,
  });
  assert.ok(buf2Col.length > 2000);
  assert.strictEqual(buf2Col.subarray(0, 4).toString(), '%PDF');

  const buf3Col = await generateCatalogPdf(sampleProducts, {
    gridCols: 3,
    priceType: 'wholesalePrice',
    showBusinessHeader: false,
  });
  assert.ok(buf3Col.length > 2000);
  assert.strictEqual(buf3Col.subarray(0, 4).toString(), '%PDF');
});

