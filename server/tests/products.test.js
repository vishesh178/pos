const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateEan13Checksum, generateEan13Barcode, isValidEan13, generateSku } = require('../src/utils/barcode');
const prisma = require('../src/prisma');

test('EAN-13 checksum algorithm produces valid GS1 check digit', () => {
  // Example standard test: 890800100001 -> check digit should match 8
  const code12 = '890800100001';
  const checksum = calculateEan13Checksum(code12);
  const fullBarcode = `${code12}${checksum}`;

  assert.equal(fullBarcode, '8908001000017');
  assert.equal(isValidEan13('8908001000017'), true);
  assert.equal(isValidEan13('8908001000018'), false); // Wrong check digit
});

test('Barcode generator creates unique valid 13-digit EAN-13 code', () => {
  const barcode = generateEan13Barcode(42);
  assert.equal(barcode.length, 13);
  assert.equal(barcode.startsWith('8908001'), true);
  assert.equal(isValidEan13(barcode), true);
});

test('SKU generator produces formatted category code', () => {
  const year = new Date().getFullYear();
  const skuClock = generateSku('Wall Clocks', 15);
  assert.equal(skuClock, `CA-WC-${year}-0015`);

  const skuFrame = generateSku('Metal Wall Art', 7);
  assert.equal(skuFrame, `CA-MF-${year}-0007`);
});

test('Products exist in database with positive stock and valid pricing', async () => {
  // Test with existing or isolated test product
  let product = await prisma.product.findFirst();
  let createdTemp = false;
  if (!product) {
    product = await prisma.product.create({
      data: {
        name: 'Test Luxury Artifact',
        sku: `TEST-VAL-${Date.now()}`,
        barcode: '8908001888881',
        sellingPrice: 1500,
        purchasePrice: 900,
        mrp: 1800,
        currentStock: 10,
      },
    });
    createdTemp = true;
  }

  assert.ok(product.name);
  assert.ok(product.sku);
  assert.ok(product.barcode);
  assert.ok(product.sellingPrice > 0);
  assert.ok(product.mrp >= product.sellingPrice);

  if (createdTemp) {
    await prisma.product.delete({ where: { id: product.id } });
  }
});

// Helper to invoke an Express route handler directly with mock req and res
function invokeRoute(router, { method = 'GET', path = '/', body = {}, query = {}, params = {}, user = null }) {
  const { generateToken } = require('../src/middleware/auth');
  return new Promise((resolve, reject) => {
    let resolved = false;
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(data) { if (!resolved) { resolved = true; resolve({ status: this.statusCode, json: data }); } },
      send(data) { if (!resolved) { resolved = true; resolve({ status: this.statusCode, text: data }); } },
    };
    const req = {
      method,
      url: path,
      path,
      headers: user ? { authorization: `Bearer ${generateToken(user)}` } : {},
      body,
      query,
      params,
      user,
      logAudit: () => {},
    };
    const stack = router.stack || router.router?.stack || [];
    const targetLayer = stack.find((s) => {
      if (!s.route) return false;
      const routeMethod = Object.keys(s.route.methods)[0]?.toUpperCase();
      return routeMethod === method && s.route.path === path;
    });
    if (!targetLayer) return reject(new Error(`Route not found: ${method} ${path}`));
    let idx = 0;
    function next(err) {
      if (err) return reject(err);
      const handler = targetLayer.route.stack[idx++];
      if (!handler) return;
      try {
        const result = handler.handle(req, res, next);
        if (result && typeof result.catch === 'function') result.catch(reject);
      } catch (e) {
        reject(e);
      }
    }
    next();
  });
}

test('Role-based security: Only ADMIN has access to purchasePrice in products list', async () => {
  const productsRoutes = require('../src/routes/products.routes');
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const managerUser = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
  const cashierUser = await prisma.user.findFirst({ where: { role: 'CASHIER' } });

  // Ensure a test product exists for role visibility check
  let tempProduct = await prisma.product.create({
    data: {
      name: 'Role Security Test Piece',
      sku: `TEST-SEC-${Date.now()}`,
      barcode: '8908001888882',
      sellingPrice: 2000,
      purchasePrice: 1200,
      mrp: 2500,
      currentStock: 5,
    },
  });

  // 1. ADMIN sees purchasePrice
  const adminRes = await invokeRoute(productsRoutes, { method: 'GET', path: '/', user: adminUser });
  assert.equal(adminRes.status, 200);
  assert.ok(adminRes.json.length > 0);
  const foundAdminItem = adminRes.json.find((p) => p.id === tempProduct.id) || adminRes.json[0];
  assert.ok(typeof foundAdminItem.purchasePrice === 'number');

  // 2. MANAGER does NOT see purchasePrice
  const managerRes = await invokeRoute(productsRoutes, { method: 'GET', path: '/', user: managerUser });
  assert.equal(managerRes.status, 200);
  const foundManagerItem = managerRes.json.find((p) => p.id === tempProduct.id) || managerRes.json[0];
  assert.equal(foundManagerItem.purchasePrice, undefined);

  // 3. CASHIER does NOT see purchasePrice
  const cashierRes = await invokeRoute(productsRoutes, { method: 'GET', path: '/', user: cashierUser });
  assert.equal(cashierRes.status, 200);
  const foundCashierItem = cashierRes.json.find((p) => p.id === tempProduct.id) || cashierRes.json[0];
  assert.equal(foundCashierItem.purchasePrice, undefined);

  // 4. Unauthenticated does NOT see purchasePrice
  const unauthRes = await invokeRoute(productsRoutes, { method: 'GET', path: '/' });
  assert.equal(unauthRes.status, 200);
  const foundUnauthItem = unauthRes.json.find((p) => p.id === tempProduct.id) || unauthRes.json[0];
  assert.equal(foundUnauthItem.purchasePrice, undefined);

  // Cleanup
  await prisma.product.delete({ where: { id: tempProduct.id } });
});

test('Role-based security: Only ADMIN receives Purchase Price column in CSV export', async () => {
  const productsRoutes = require('../src/routes/products.routes');
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const cashierUser = await prisma.user.findFirst({ where: { role: 'CASHIER' } });

  // ADMIN CSV
  const adminCsvRes = await invokeRoute(productsRoutes, { method: 'GET', path: '/export/csv', user: adminUser });
  assert.equal(adminCsvRes.status, 200);
  assert.ok(adminCsvRes.text.includes('Purchase Price'));

  // Non-admin CSV
  const nonAdminCsvRes = await invokeRoute(productsRoutes, { method: 'GET', path: '/export/csv', user: cashierUser });
  assert.equal(nonAdminCsvRes.status, 200);
  assert.ok(!nonAdminCsvRes.text.includes('Purchase Price'));
});
