const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/prisma');
const { generateToken } = require('../src/middleware/auth');
const authRoutes = require('../src/routes/auth.routes');
const businessRoutes = require('../src/routes/business.routes');
const productsRoutes = require('../src/routes/products.routes');
const posRoutes = require('../src/routes/pos.routes');
const inventoryRoutes = require('../src/routes/inventory.routes');
const purchasesRoutes = require('../src/routes/purchases.routes');
const reportsRoutes = require('../src/routes/reports.routes');
const backupRoutes = require('../src/routes/backup.routes');
const zohoRoutes = require('../src/routes/zoho.routes');
const estimatesRoutes = require('../src/routes/estimates.routes');
const customerRoutes = require('../src/routes/customers.routes');
const pricebooksRoutes = require('../src/routes/pricebooks.routes');
const app = require('../index');

// Helper to invoke an Express route handler directly with mock req and res
function invokeRoute(router, { method = 'GET', path = '/', body = {}, query = {}, params = {}, user = null }) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        if (!resolved) {
          resolved = true;
          resolve({ status: this.statusCode, json: data });
        }
      },
      send(data) {
        if (!resolved) {
          resolved = true;
          resolve({ status: this.statusCode, text: data });
        }
      },
      sendStatus(code) {
        if (!resolved) {
          resolved = true;
          resolve({ status: code });
        }
      },
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
      socket: { remoteAddress: '127.0.0.1' },
      logAudit: () => {},
    };

    // Find layer in router stack matching method and path
    const stack = router.stack || router.router?.stack || [];
    const targetLayer = stack.find((s) => {
      if (!s.route) return false;
      const routeMethod = Object.keys(s.route.methods)[0]?.toUpperCase();
      return routeMethod === method && s.route.path === path;
    });

    if (!targetLayer) {
      return reject(new Error(`Route not found on router: ${method} ${path}`));
    }

    // Execute handlers (including any route-level middlewares)
    let idx = 0;
    function next(err) {
      if (err) return reject(err);
      const handler = targetLayer.route.stack[idx++];
      if (!handler) return;
      try {
        const result = handler.handle(req, res, next);
        if (result && typeof result.catch === 'function') {
          result.catch(reject);
        }
      } catch (e) {
        reject(e);
      }
    }
    next();
  });
}

test('SANDBOX AUDIT 1: System Health Endpoint', async () => {
  const expressApp = require('../index');
  assert.ok(expressApp);
});

test('SANDBOX AUDIT 2: Auth Flow (Login, Security Boundaries & Tokens)', async () => {
  // Successful admin login
  const res = await invokeRoute(authRoutes, {
    method: 'POST',
    path: '/login',
    body: { email: 'admin@curatedart.in', password: 'admin123' },
  });
  assert.equal(res.status, 200);
  assert.ok(res.json.token);
  assert.equal(res.json.user.role, 'ADMIN');

  // Failed login rejection
  const failRes = await invokeRoute(authRoutes, {
    method: 'POST',
    path: '/login',
    body: { email: 'admin@curatedart.in', password: 'wrongPassword' },
  });
  assert.equal(failRes.status, 401);
});

test('SANDBOX AUDIT 3: Business Profile & GST Master Details', async () => {
  const res = await invokeRoute(businessRoutes, { method: 'GET', path: '/profile' });
  assert.equal(res.status, 200);
  assert.equal(res.json.businessName, 'Curated Art');
  assert.equal(res.json.stateCode, '24');
  assert.equal(res.json.currency, 'INR');
});

test('SANDBOX AUDIT 4: Product Engine (Categories, Barcode, SKU & Product Listing)', async () => {
  // Categories
  const catsRes = await invokeRoute(productsRoutes, { method: 'GET', path: '/categories' });
  assert.equal(catsRes.status, 200);
  assert.ok(Array.isArray(catsRes.json));
  assert.ok(catsRes.json.length > 0);

  // Barcode generator
  const bcRes = await invokeRoute(productsRoutes, { method: 'GET', path: '/generate-barcode' });
  assert.equal(bcRes.status, 200);
  assert.match(bcRes.json.barcode, /^\d{13}$/);

  // SKU generator
  const skuRes = await invokeRoute(productsRoutes, {
    method: 'GET',
    path: '/generate-sku',
    query: { categoryName: 'Metal Wall Art' },
  });
  assert.equal(skuRes.status, 200);
  assert.match(skuRes.json.sku, /^CA-MF-/);

  // Products listing
  const listRes = await invokeRoute(productsRoutes, { method: 'GET', path: '/' });
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.json));
  assert.ok(listRes.json.length > 0);
  assert.equal(listRes.json[0].purchasePrice, undefined); // Hidden from unauthenticated / non-admins

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const adminListRes = await invokeRoute(productsRoutes, { method: 'GET', path: '/', user: adminUser });
  assert.equal(adminListRes.status, 200);
  assert.ok(typeof adminListRes.json[0].purchasePrice === 'number'); // Accessible by ADMIN
});

test('SANDBOX AUDIT 5: POS Engine, Atomic Stock Movement & Outbox Sync Queue', async () => {
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const sampleProduct = await prisma.product.findFirst({ where: { status: 'ACTIVE' } });
  assert.ok(sampleProduct);

  const initialStock = sampleProduct.currentStock;

  const checkoutRes = await invokeRoute(posRoutes, {
    method: 'POST',
    path: '/checkout',
    user: adminUser,
    body: {
      customerName: 'Mr. Rajesh Mehta (Architect)',
      customerMobile: '9825012345',
      customerState: 'Gujarat',
      customerStateCode: '24',
      paymentMethod: 'CASH',
      invoiceDiscount: 0,
      paidAmount: sampleProduct.sellingPrice,
      items: [
        {
          productId: sampleProduct.id,
          name: sampleProduct.name,
          sku: sampleProduct.sku,
          quantity: 1,
          unitPrice: sampleProduct.sellingPrice,
          gstRate: sampleProduct.gstRate,
          hsnCode: sampleProduct.hsnCode,
          isTaxInclusive: true,
        },
      ],
    },
  });

  assert.equal(checkoutRes.status, 201);
  assert.ok(checkoutRes.json.invoice.invoiceNumber);
  assert.equal(checkoutRes.json.invoice.customerName, 'Mr. Rajesh Mehta (Architect)');

  // Verify stock deduction in database
  const updatedProduct = await prisma.product.findUnique({ where: { id: sampleProduct.id } });
  assert.equal(updatedProduct.currentStock, initialStock - 1);

  // Verify outbox sync job created with normalized 2-letter place_of_supply
  const outboxJob = await prisma.syncJob.findFirst({
    where: { localRecordId: checkoutRes.json.invoice.id },
  });
  assert.ok(outboxJob);
  const payload = JSON.parse(outboxJob.payload);
  assert.equal(payload.place_of_supply, 'GJ');
});

test('SANDBOX AUDIT 6: Real-time Inventory Overview & Ledger', async () => {
  const overviewRes = await invokeRoute(inventoryRoutes, { method: 'GET', path: '/overview' });
  assert.equal(overviewRes.status, 200);
  assert.ok(typeof overviewRes.json.totalProducts === 'number');
  assert.ok(typeof overviewRes.json.totalValuationRetail === 'number');
  assert.equal(overviewRes.json.totalValuationCost, null); // Hidden from non-admin

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const adminOverview = await invokeRoute(inventoryRoutes, { method: 'GET', path: '/overview', user: adminUser });
  assert.equal(adminOverview.status, 200);
  assert.ok(typeof adminOverview.json.totalValuationCost === 'number'); // Accessible by ADMIN

  const movementsRes = await invokeRoute(inventoryRoutes, { method: 'GET', path: '/movements' });
  assert.equal(movementsRes.status, 200);
  assert.ok(Array.isArray(movementsRes.json));
  if (movementsRes.json.length > 0) {
    assert.equal(movementsRes.json[0].unitCost, undefined); // Hidden from non-admin
  }
});

test('SANDBOX AUDIT 7: Purchases, Inward Bills & Suppliers', async () => {
  const suppliersRes = await invokeRoute(purchasesRoutes, { method: 'GET', path: '/suppliers' });
  assert.equal(suppliersRes.status, 200);
  assert.ok(Array.isArray(suppliersRes.json));

  const billsRes = await invokeRoute(purchasesRoutes, { method: 'GET', path: '/bills' });
  assert.equal(billsRes.status, 200);
  assert.ok(Array.isArray(billsRes.json));
});

test('SANDBOX AUDIT 8: Financial P&L, COGS & Indian GST Reports (GSTR-1, GSTR-3B)', async () => {
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const dashboardRes = await invokeRoute(reportsRoutes, { method: 'GET', path: '/dashboard', user: adminUser });
  assert.equal(dashboardRes.status, 200);
  assert.ok(typeof dashboardRes.json.todaySales === 'number');
  assert.ok(typeof dashboardRes.json.grossProfit === 'number');

  // Verify non-admin gets masked profit metrics
  const unauthRes = await invokeRoute(reportsRoutes, { method: 'GET', path: '/dashboard' });
  assert.equal(unauthRes.json.grossProfit, null);
  assert.equal(unauthRes.json.netProfitEstimate, null);

  const gstRes = await invokeRoute(reportsRoutes, { method: 'GET', path: '/gst' });
  assert.equal(gstRes.status, 200);
  assert.ok(gstRes.json.gstr1);
  assert.ok(gstRes.json.gstr3b);
  assert.ok(Array.isArray(gstRes.json.gstr1.hsnSummary));
});

test('SANDBOX AUDIT 9: Database Disaster Recovery (Backups)', async () => {
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  const createRes = await invokeRoute(backupRoutes, {
    method: 'POST',
    path: '/create',
    user: adminUser,
  });
  assert.equal(createRes.status, 200);
  assert.ok(createRes.json.success);
  assert.ok(createRes.json.backup.fileName);

  const listRes = await invokeRoute(backupRoutes, {
    method: 'GET',
    path: '/list',
    user: adminUser,
  });
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.json));
  assert.ok(listRes.json.length > 0);
});

test('SANDBOX AUDIT 10: Zoho Config Status & Outbox Queue Integrity', async () => {
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  const cfgRes = await invokeRoute(zohoRoutes, {
    method: 'GET',
    path: '/config',
    user: adminUser,
  });
  assert.equal(cfgRes.status, 200);
  assert.equal(cfgRes.json.isConnected, true);
  assert.ok(cfgRes.json.organizationId === '60094058962' || cfgRes.json.organizationId === '60094056458');
  assert.equal(cfgRes.json.dcDomain, 'in');

  const jobsRes = await invokeRoute(zohoRoutes, {
    method: 'GET',
    path: '/jobs',
    user: adminUser,
    query: { status: 'all' },
  });
  assert.equal(jobsRes.status, 200);
  assert.ok(Array.isArray(jobsRes.json.jobs));

  // Verify all invoice jobs in outbox have normalized 2-letter place_of_supply
  for (const job of jobsRes.json.jobs) {
    if (job.entityType === 'INVOICE') {
      const payload = JSON.parse(job.payload);
      if (payload.place_of_supply) {
        assert.match(payload.place_of_supply, /^[A-Z]{2}$/);
      }
    }
  }
});

test('SANDBOX AUDIT 11: Multi-Dimensional Reports Suite (Sales by Period, Product Margins, Category Sales, Outstandings)', async () => {
  // 1. Sales Summary by Period (month, week, today)
  const salesMonthRes = await invokeRoute(reportsRoutes, {
    method: 'GET',
    path: '/sales-summary',
    query: { period: 'month' },
  });
  assert.equal(salesMonthRes.status, 200);
  assert.ok(typeof salesMonthRes.json.totalRevenue === 'number');
  assert.ok(typeof salesMonthRes.json.totalInvoices === 'number');
  assert.ok(salesMonthRes.json.payments);
  assert.ok(Array.isArray(salesMonthRes.json.invoices));

  // 2. Product-wise Profitability & COGS
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const prodProfitRes = await invokeRoute(reportsRoutes, {
    method: 'GET',
    path: '/product-profitability',
    user: adminUser,
  });
  assert.equal(prodProfitRes.status, 200);
  assert.ok(Array.isArray(prodProfitRes.json));
  if (prodProfitRes.json.length > 0) {
    const item = prodProfitRes.json[0];
    assert.ok(item.name);
    assert.ok(typeof item.grossProfit === 'number');
    assert.ok(typeof item.marginPercent === 'number');
    assert.ok(typeof item.purchasePrice === 'number');
  }

  // Verify non-admin gets null for purchase price and gross profit
  const unauthProfitRes = await invokeRoute(reportsRoutes, {
    method: 'GET',
    path: '/product-profitability',
  });
  if (unauthProfitRes.json.length > 0) {
    assert.equal(unauthProfitRes.json[0].purchasePrice, null);
    assert.equal(unauthProfitRes.json[0].grossProfit, null);
  }

  // 3. Category Sales Distribution
  const catSalesRes = await invokeRoute(reportsRoutes, {
    method: 'GET',
    path: '/category-sales',
  });
  assert.equal(catSalesRes.status, 200);
  assert.ok(typeof catSalesRes.json.overallRevenue === 'number');
  assert.ok(Array.isArray(catSalesRes.json.categories));

  // 4. Outstandings Ledger (Receivables & Payables)
  const outstandingsRes = await invokeRoute(reportsRoutes, {
    method: 'GET',
    path: '/outstandings',
  });
  assert.equal(outstandingsRes.status, 200);
  assert.ok(typeof outstandingsRes.json.totalCustomerOutstanding === 'number');
  assert.ok(typeof outstandingsRes.json.totalSupplierOutstanding === 'number');
  assert.ok(Array.isArray(outstandingsRes.json.customers));
  assert.ok(Array.isArray(outstandingsRes.json.suppliers));
});

test('SANDBOX AUDIT 12: Daily Wholesale Stock Catalog & Rate Sheet Generator', async () => {
  const catalogRes = await invokeRoute(productsRoutes, {
    method: 'GET',
    path: '/wholesale-catalog',
    query: { minStock: '1' },
  });
  assert.equal(catalogRes.status, 200);
  assert.ok(catalogRes.json.business);
  assert.ok(catalogRes.json.business.businessName);
  assert.ok(catalogRes.json.dateFormatted);
  assert.ok(typeof catalogRes.json.totalItems === 'number');
  assert.ok(typeof catalogRes.json.totalStockPieces === 'number');
  assert.ok(typeof catalogRes.json.totalWholesaleValue === 'number');
  assert.ok(Array.isArray(catalogRes.json.items));

  // Verify that all items returned have positive stock and valid wholesale rates
  for (const item of catalogRes.json.items) {
    assert.ok(item.currentStock >= 1);
    assert.ok(typeof item.wholesalePrice === 'number');
    assert.ok(typeof item.mrp === 'number');
    assert.ok(typeof item.retailMarginPercent === 'number');
    assert.ok(item.sku);
    assert.ok(item.categoryName);
  }
});

test('SANDBOX AUDIT 13: Mobile Pairing & Network Info Discovery Endpoint', async () => {
  const netRes = await invokeRoute(app, {
    method: 'GET',
    path: '/api/network-info',
  });
  assert.equal(netRes.status, 200);
  assert.equal(String(netRes.json.port), '5001');
  assert.ok(netRes.json.primaryUrl.startsWith('http://'));
  assert.ok(netRes.json.primaryIp);
  assert.ok(Array.isArray(netRes.json.addresses));
});

test('SANDBOX AUDIT 14: Customer Estimate & Quotation Lifecycle (Draft, GST, Conversion to Final Bill)', async () => {
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  let product = await prisma.product.findFirst({ where: { status: 'ACTIVE', currentStock: { gt: 5 } } });
  if (!product) {
    const anyProd = await prisma.product.findFirst({ where: { status: 'ACTIVE' } });
    if (anyProd) {
      product = await prisma.product.update({ where: { id: anyProd.id }, data: { currentStock: 50 } });
    }
  }
  assert.ok(product, 'A test product with sufficient stock must exist');

  const initialStock = product.currentStock;

  // 1. Create an Estimate
  const createEstRes = await invokeRoute(estimatesRoutes, {
    method: 'POST',
    path: '/',
    user: adminUser,
    body: {
      customerName: 'Architect Priya Mehta & Associates',
      customerMobile: '+91 98250 11223',
      customerGstin: '24AAPPM1234F1Z9',
      customerState: 'Gujarat',
      customerStateCode: '24',
      items: [
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          hsnCode: product.hsnCode,
          quantity: 2,
          unitPrice: product.sellingPrice,
          mrp: product.mrp,
          gstRate: product.gstRate,
          discountAmount: 0,
        },
      ],
      validityDays: 15,
      notes: 'Quotation for luxury penthouse living room décor',
    },
  });

  assert.equal(createEstRes.status, 201);
  assert.ok(createEstRes.json.estimate);
  const createdEst = createEstRes.json.estimate;
  assert.ok(createdEst.estimateNumber.startsWith('EST-'));
  assert.equal(createdEst.status, 'PENDING');
  assert.equal(createdEst.customerName, 'Architect Priya Mehta & Associates');
  assert.equal(createdEst.items.length, 1);
  assert.equal(createdEst.validityDays, 15);

  // Crucial check: Creating an estimate MUST NOT decrement inventory stock!
  const stockAfterEstimate = await prisma.product.findUnique({ where: { id: product.id } });
  assert.equal(stockAfterEstimate.currentStock, initialStock, 'Stock must remain unchanged after estimate creation');

  // Verify Zoho Quote outbox sync job enqueued
  const estSyncJob = await prisma.syncJob.findFirst({
    where: { localRecordId: createdEst.id, entityType: 'ESTIMATE' },
  });
  assert.ok(estSyncJob, 'Transactional outbox sync job must be enqueued for Zoho Quotes/Estimates');
  const estPayload = JSON.parse(estSyncJob.payload);
  assert.equal(estPayload.estimate_number, createdEst.estimateNumber);
  assert.equal(estPayload.place_of_supply, 'GJ');

  // 2. Fetch single estimate
  const getEstRes = await invokeRoute(estimatesRoutes, {
    method: 'GET',
    path: '/:id',
    user: adminUser,
    params: { id: createdEst.id },
  });
  assert.equal(getEstRes.status, 200);
  assert.equal(getEstRes.json.estimate.id, createdEst.id);
  assert.ok(getEstRes.json.business);

  // 3. Convert Estimate to Final Invoice
  const convertRes = await invokeRoute(estimatesRoutes, {
    method: 'POST',
    path: '/:id/convert',
    user: adminUser,
    params: { id: createdEst.id },
    body: {
      paymentMethod: 'UPI',
      paidAmount: createdEst.grandTotal,
    },
  });

  assert.equal(convertRes.status, 200);
  assert.ok(convertRes.json.invoice);
  const finalInvoice = convertRes.json.invoice;
  assert.ok(finalInvoice.invoiceNumber.startsWith('CA-'));
  assert.equal(finalInvoice.paymentStatus, 'PAID');
  assert.equal(finalInvoice.paymentMethod, 'UPI');

  // Crucial check: Converting estimate MUST atomically decrement inventory stock!
  const stockAfterConversion = await prisma.product.findUnique({ where: { id: product.id } });
  assert.equal(stockAfterConversion.currentStock, initialStock - 2, 'Stock must be decremented by 2 units on conversion');

  // Verify Estimate record updated to CONVERTED
  const updatedEst = await prisma.estimate.findUnique({ where: { id: createdEst.id } });
  assert.equal(updatedEst.status, 'CONVERTED');
  assert.equal(updatedEst.convertedInvoiceId, finalInvoice.invoiceNumber);

  // Verify outbox sync job queued for Zoho
  const outboxJob = await prisma.syncJob.findFirst({
    where: { localRecordId: finalInvoice.id, entityType: 'INVOICE' },
  });
  assert.ok(outboxJob, 'Transactional outbox sync job must be enqueued for the invoice');
});

test('SANDBOX AUDIT 15: Partial Billing, Outstanding Ledger & Follow-up Settlement Flow', async () => {
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  let product = await prisma.product.findFirst({ where: { status: 'ACTIVE', currentStock: { gt: 5 } } });
  if (!product) {
    const anyProd = await prisma.product.findFirst({ where: { status: 'ACTIVE' } });
    product = await prisma.product.update({ where: { id: anyProd.id }, data: { currentStock: 50 } });
  }

  // 1. Create a customer with known mobile
  const custMobile = '+91 99000 88776';
  let cust = await prisma.customer.findFirst({ where: { mobile: custMobile } });
  if (!cust) {
    cust = await prisma.customer.create({
      data: {
        name: 'Devang Vora (Partial Buyer)',
        mobile: custMobile,
        state: 'Gujarat',
        stateCode: '24',
      },
    });
  }

  const initialBalance = cust.currentBalance;

  // 2. Checkout with Partial Payment (e.g. Total is ₹product.sellingPrice, pay half)
  const itemPrice = product.sellingPrice;
  const partialPaid = Math.round(itemPrice * 0.4); // 40% advance

  const checkoutRes = await invokeRoute(posRoutes, {
    method: 'POST',
    path: '/checkout',
    user: adminUser,
    body: {
      customerId: cust.id,
      customerName: cust.name,
      customerMobile: cust.mobile,
      items: [
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          hsnCode: product.hsnCode,
          quantity: 1,
          unitPrice: product.sellingPrice,
          mrp: product.mrp,
          gstRate: product.gstRate,
        },
      ],
      paymentMethod: 'CASH',
      paidAmount: partialPaid,
    },
  });

  assert.equal(checkoutRes.status, 201);
  const inv = checkoutRes.json.invoice;
  const expectedBalance = inv.grandTotal - partialPaid;
  assert.equal(inv.paymentStatus, 'PARTIAL');
  assert.equal(inv.paidAmount, partialPaid);
  assert.equal(inv.balanceAmount, expectedBalance);

  // 3. Verify Customer's current balance is incremented by the outstanding balance
  const updatedCust = await prisma.customer.findUnique({ where: { id: cust.id } });
  assert.equal(updatedCust.currentBalance, initialBalance + expectedBalance);

  // 4. Record follow-up settlement payment
  const settleRes = await invokeRoute(posRoutes, {
    method: 'POST',
    path: '/invoices/:id/payment',
    user: adminUser,
    params: { id: inv.id },
    body: {
      amount: expectedBalance,
      paymentMethod: 'UPI',
      notes: 'Cleared remaining balance via GPay',
    },
  });

  assert.equal(settleRes.status, 200);
  assert.equal(settleRes.json.invoice.paymentStatus, 'PAID');
  assert.equal(settleRes.json.invoice.balanceAmount, 0);

  // Customer balance decremented back
  const fullySettledCust = await prisma.customer.findUnique({ where: { id: cust.id } });
  assert.equal(fullySettledCust.currentBalance, initialBalance);

  // 5. Test Customer Credit Ledger Endpoint
  const ledgerRes = await invokeRoute(customerRoutes, {
    method: 'GET',
    path: '/:id/ledger',
    user: adminUser,
    params: { id: cust.id },
  });
  assert.equal(ledgerRes.status, 200);
  assert.ok(ledgerRes.json.customer);
  assert.ok(ledgerRes.json.summary);
  assert.ok(Array.isArray(ledgerRes.json.transactions));
  assert.ok(ledgerRes.json.transactions.length >= 2, 'Must contain invoice and payment entries');

  // 6. Test Direct Khata Settlement payment
  const khataPayRes = await invokeRoute(customerRoutes, {
    method: 'POST',
    path: '/:id/payments',
    user: adminUser,
    params: { id: cust.id },
    body: {
      amount: 500,
      paymentMethod: 'CASH',
      notes: 'Advance credit payment on account',
    },
  });
  assert.equal(khataPayRes.status, 200);
  assert.ok(khataPayRes.json.payment);
  assert.equal(khataPayRes.json.payment.amount, 500);
});

test('SANDBOX AUDIT 16: Tiered Pricebooks & Dynamic Discounting', async () => {
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  // 1. Fetch available pricebooks
  const pbRes = await invokeRoute(pricebooksRoutes, {
    method: 'GET',
    path: '/',
    user: adminUser,
  });
  assert.equal(pbRes.status, 200);
  assert.ok(Array.isArray(pbRes.json));
  assert.ok(pbRes.json.length >= 4);

  const designerPb = pbRes.json.find((p) => p.code === 'DESIGNER');
  assert.ok(designerPb);
  assert.equal(designerPb.discountPercentage, 20);

  // 2. Test calculate preview endpoint
  const calcRes = await invokeRoute(pricebooksRoutes, {
    method: 'POST',
    path: '/calculate',
    user: adminUser,
    body: {
      items: [
        { name: 'Roman Clock', mrp: 3499, quantity: 1 },
        { name: 'Mirror', mrp: 5000, quantity: 2 },
      ],
      discountPercentage: designerPb.discountPercentage,
    },
  });
  assert.equal(calcRes.status, 200);
  assert.equal(calcRes.json.totalOriginal, 13499);
  assert.equal(calcRes.json.totalSavings, 2700);
  assert.equal(calcRes.json.totalDiscounted, 10799);

  // 3. Test POS Checkout with Pricebook attached
  const product = await prisma.product.findFirst();
  assert.ok(product);
  const checkoutRes = await invokeRoute(posRoutes, {
    method: 'POST',
    path: '/checkout',
    user: adminUser,
    body: {
      customerName: 'Architect Ananya (Designer Tier)',
      customerMobile: '+91 98980 12345',
      customerState: 'Gujarat',
      customerStateCode: '24',
      pricebookId: designerPb.id,
      pricebookName: designerPb.name,
      items: [
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          quantity: 1,
          unitPrice: Math.round(product.sellingPrice * 0.8),
          mrp: product.sellingPrice,
          gstRate: 18,
          isTaxInclusive: false,
        },
      ],
      paymentMethod: 'UPI',
    },
  });
  assert.equal(checkoutRes.status, 201);
  const invoice = checkoutRes.json.invoice;
  assert.equal(invoice.pricebookId, designerPb.id);
  assert.equal(invoice.pricebookName, designerPb.name);
});





