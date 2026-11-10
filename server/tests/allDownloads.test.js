const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/prisma');
const { generateToken } = require('../src/middleware/auth');
const exportRouter = require('../src/routes/export.routes');
const productsRouter = require('../src/routes/products.routes');
const estimatesRouter = require('../src/routes/estimates.routes');
const backupRouter = require('../src/routes/backup.routes');

function executeRoute(router, method, urlPath, token, query = {}, body = null) {
  return new Promise((resolve, reject) => {
    const headers = {};
    const chunks = [];
    let statusCode = 200;

    const req = {
      method,
      url: urlPath,
      headers: {
        authorization: `Bearer ${token}`,
      },
      query,
      body,
    };

    const res = {
      statusCode,
      status(code) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      setHeader(k, v) {
        headers[k.toLowerCase()] = v;
      },
      getHeader(k) {
        return headers[k.toLowerCase()];
      },
      json(data) {
        resolve({ statusCode, headers, body: data });
      },
      send(data) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        resolve({ statusCode, headers, buffer: buf, body: data });
      },
      download(filePath, filename) {
        const fs = require('fs');
        const buf = fs.existsSync(filePath) ? fs.readFileSync(filePath) : Buffer.from('mock');
        headers['content-disposition'] = `attachment; filename="${filename || 'backup.sqlite'}"`;
        resolve({ statusCode, headers, buffer: buf, body: buf });
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const buf = Buffer.concat(chunks);
        resolve({ statusCode, headers, buffer: buf, body: buf });
      },
    };

    router.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({ statusCode: 404, headers: {}, error: 'Route not matched' });
    });
  });
}

test('Download Verification - All System Export Endpoints', async () => {
  let adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        name: 'Viren Shah (Admin)',
        email: 'viren@curatedart.in',
        passwordHash: 'dummyhash',
        role: 'ADMIN',
        isActive: true,
      },
    });
  }
  const token = generateToken(adminUser);

  // 1. Export All Data (XLSX)
  const allRes = await executeRoute(exportRouter, 'GET', '/all', token);
  assert.strictEqual(allRes.statusCode, 200);
  assert.ok(allRes.headers['content-type']?.includes('spreadsheetml'));
  assert.ok(allRes.headers['content-disposition']?.includes('filename='));
  assert.ok(allRes.buffer.length > 500);
  assert.strictEqual(allRes.buffer.subarray(0, 2).toString(), 'PK'); // Zip/XLSX header

  // 2. Export Customers (XLSX & CSV)
  const custXlsx = await executeRoute(exportRouter, 'GET', '/customers', token, { format: 'xlsx' });
  assert.strictEqual(custXlsx.statusCode, 200);
  assert.strictEqual(custXlsx.buffer.subarray(0, 2).toString(), 'PK');

  const custCsv = await executeRoute(exportRouter, 'GET', '/customers', token, { format: 'csv' });
  assert.strictEqual(custCsv.statusCode, 200);
  assert.ok(custCsv.headers['content-type']?.includes('text/csv'));
  assert.ok(custCsv.buffer.length > 50);

  // 3. Export Products (XLSX & CSV)
  const prodXlsx = await executeRoute(exportRouter, 'GET', '/products', token, { format: 'xlsx' });
  assert.strictEqual(prodXlsx.statusCode, 200);
  assert.strictEqual(prodXlsx.buffer.subarray(0, 2).toString(), 'PK');

  const prodCsv = await executeRoute(exportRouter, 'GET', '/products', token, { format: 'csv' });
  assert.strictEqual(prodCsv.statusCode, 200);
  assert.ok(prodCsv.headers['content-type']?.includes('text/csv'));

  // 4. Export Invoices (XLSX & CSV)
  const invXlsx = await executeRoute(exportRouter, 'GET', '/invoices', token, { format: 'xlsx' });
  assert.strictEqual(invXlsx.statusCode, 200);
  assert.strictEqual(invXlsx.buffer.subarray(0, 2).toString(), 'PK');

  const invCsv = await executeRoute(exportRouter, 'GET', '/invoices', token, { format: 'csv' });
  assert.strictEqual(invCsv.statusCode, 200);
  assert.ok(invCsv.headers['content-type']?.includes('text/csv'));

  // 5. Export Purchases (XLSX & CSV)
  const purXlsx = await executeRoute(exportRouter, 'GET', '/purchases', token, { format: 'xlsx' });
  assert.strictEqual(purXlsx.statusCode, 200);
  assert.strictEqual(purXlsx.buffer.subarray(0, 2).toString(), 'PK');

  // 6. Export Inventory Movement (XLSX & CSV)
  const invMovXlsx = await executeRoute(exportRouter, 'GET', '/inventory', token, { format: 'xlsx' });
  assert.strictEqual(invMovXlsx.statusCode, 200);
  assert.strictEqual(invMovXlsx.buffer.subarray(0, 2).toString(), 'PK');

  // 7. Export Expenses (XLSX & CSV)
  const expXlsx = await executeRoute(exportRouter, 'GET', '/expenses', token, { format: 'xlsx' });
  assert.strictEqual(expXlsx.statusCode, 200);
  assert.strictEqual(expXlsx.buffer.subarray(0, 2).toString(), 'PK');

  // 8. Export General Accounts (XLSX & CSV)
  const genXlsx = await executeRoute(exportRouter, 'GET', '/general-accounts', token, { format: 'xlsx' });
  assert.strictEqual(genXlsx.statusCode, 200);
  assert.strictEqual(genXlsx.buffer.subarray(0, 2).toString(), 'PK');

  // 9. Catalog PDF (GET)
  const catPdf = await executeRoute(productsRouter, 'GET', '/catalog-pdf', token, { gridCols: '1', priceType: 'mrp' });
  assert.strictEqual(catPdf.statusCode, 200);
  assert.strictEqual(catPdf.headers['content-type'], 'application/pdf');
  assert.strictEqual(catPdf.buffer.subarray(0, 4).toString(), '%PDF');

  // 10. Database Backup Download
  const backupRes = await executeRoute(backupRouter, 'GET', '/download', token);
  assert.strictEqual(backupRes.statusCode, 200);
  assert.ok(backupRes.buffer.length > 5000);

  // 11. Estimate PDF Download
  let est = await prisma.estimate.findFirst();
  if (est) {
    const estPdfRes = await executeRoute(estimatesRouter, 'GET', `/${est.id}/export/pdf`, token);
    assert.strictEqual(estPdfRes.statusCode, 200);
    assert.strictEqual(estPdfRes.headers['content-type'], 'application/pdf');
    assert.strictEqual(estPdfRes.buffer.subarray(0, 4).toString(), '%PDF');
  }
});
