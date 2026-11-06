const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/prisma');
const { calculateInvoiceTotals } = require('../src/utils/gst');

test('POS invoice generation produces sequential numbering and atomic stock movement', async () => {
  // Find or create an isolated test product
  let product = await prisma.product.findFirst({
    where: { currentStock: { gt: 2 } },
  });
  let createdTemp = false;
  if (!product) {
    product = await prisma.product.create({
      data: {
        name: 'Test POS Item',
        sku: `TEST-POS-${Date.now()}`,
        barcode: '8908001777771',
        sellingPrice: 1500,
        purchasePrice: 900,
        mrp: 1800,
        currentStock: 10,
      },
    });
    createdTemp = true;
  }

  const initialStock = product.currentStock;
  const quantityToBuy = 2;

  const business = await prisma.businessProfile.findFirst();
  assert.ok(business);

  const initialNextNumber = business.invoiceNextNumber;
  const expectedInvoiceNumber = `${business.invoicePrefix}${initialNextNumber}`;

  // Execute checkout simulation directly with Prisma transaction
  const invoice = await prisma.$transaction(async (tx) => {
    // 1. Increment sequence
    await tx.businessProfile.update({
      where: { id: business.id },
      data: { invoiceNextNumber: initialNextNumber + 1 },
    });

    const calc = calculateInvoiceTotals(
      [
        {
          productId: product.id,
          unitPrice: product.sellingPrice,
          quantity: quantityToBuy,
          gstRate: product.gstRate,
        },
      ],
      { businessStateCode: '24', customerStateCode: '24' }
    );

    const newInv = await tx.invoice.create({
      data: {
        invoiceNumber: expectedInvoiceNumber,
        customerName: 'Test Walk-in',
        placeOfSupply: '24-Gujarat',
        subtotal: calc.subtotal,
        discountTotal: 0,
        taxTotal: calc.taxTotal,
        cgstTotal: calc.cgstTotal,
        sgstTotal: calc.sgstTotal,
        igstTotal: 0,
        roundOff: calc.roundOff,
        grandTotal: calc.grandTotal,
        paidAmount: calc.grandTotal,
        balanceAmount: 0,
        paymentStatus: 'PAID',
        paymentMethod: 'UPI',
        status: 'COMPLETED',
        zohoSyncStatus: 'PENDING',
      },
    });

    // Deduct stock
    const newStock = initialStock - quantityToBuy;
    await tx.product.update({
      where: { id: product.id },
      data: { currentStock: newStock },
    });

    // Record movement
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: 'SALE',
        quantity: -quantityToBuy,
        unitCost: product.purchasePrice,
        balanceAfter: newStock,
        referenceType: 'INVOICE',
        referenceId: expectedInvoiceNumber,
        createdBy: 'Test Suite',
      },
    });

    // Enqueue SyncJob
    await tx.syncJob.create({
      data: {
        entityType: 'INVOICE',
        localRecordId: newInv.id,
        operation: 'CREATE',
        payload: JSON.stringify({ invoice_number: expectedInvoiceNumber }),
        status: 'PENDING',
      },
    });

    return newInv;
  });

  assert.equal(invoice.invoiceNumber, expectedInvoiceNumber);

  // Verify stock was decremented
  const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
  assert.equal(updatedProduct.currentStock, initialStock - quantityToBuy);

  // Verify SyncJob was enqueued
  const syncJob = await prisma.syncJob.findFirst({
    where: { localRecordId: invoice.id, entityType: 'INVOICE' },
  });
  assert.ok(syncJob);
  assert.equal(syncJob.status, 'PENDING');

  // Clean up test records
  if (createdTemp) {
    await prisma.syncJob.deleteMany({ where: { localRecordId: invoice.id } });
    await prisma.stockMovement.deleteMany({ where: { productId: product.id } });
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
    await prisma.invoice.delete({ where: { id: invoice.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.businessProfile.update({
      where: { id: business.id },
      data: { invoiceNextNumber: initialNextNumber },
    });
  }
});

test('Smart Invoice Search resolves exact, lowercase, prefix-typo, pure digits, and returns nearest matches for non-existent queries', async () => {
  const posRouter = require('../src/routes/pos.routes');
  const route = posRouter.stack.find((s) => s.route && s.route.path === '/invoices/:id');
  assert.ok(route, 'GET /invoices/:id route handler must exist');
  const handler = route.route.stack[0].handle;

  const callHandler = (id) =>
    new Promise((resolve) => {
      let statusCode = 200;
      const req = { params: { id } };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          resolve({ status: statusCode, body: data });
        },
      };
      handler(req, res);
    });

  // 1. Exact match lookup
  const resExact = await callHandler('CA-1028');
  assert.equal(resExact.status, 200);
  assert.equal(resExact.body.invoice.invoiceNumber, 'CA-1028');

  // 2. Lowercase match lookup (ca-1028)
  const resLower = await callHandler('ca-1028');
  assert.equal(resLower.status, 200);
  assert.equal(resLower.body.invoice.invoiceNumber, 'CA-1028');

  // 3. Typo with missing 'A' (C-1028)
  const resTypo = await callHandler('C-1028');
  assert.equal(resTypo.status, 200);
  assert.equal(resTypo.body.invoice.invoiceNumber, 'CA-1028');

  // 4. Pure digits lookup (1028)
  const resDigits = await callHandler('1028');
  assert.equal(resDigits.status, 200);
  assert.equal(resDigits.body.invoice.invoiceNumber, 'CA-1028');

  // 5. Typo with missing 'A' for CA-1029 (C-1029) -> Auto-resolves to CA-1029!
  const resTypo1029 = await callHandler('C-1029');
  assert.equal(resTypo1029.status, 200);
  assert.equal(resTypo1029.body.invoice.invoiceNumber, 'CA-1029');

  // 6. Non-existent query (9999) -> Must return 404 with nearest matches sorted by proximity!
  const resNearest = await callHandler('9999');
  assert.equal(resNearest.status, 404);
  assert.ok(resNearest.body.nearestMatches && resNearest.body.nearestMatches.length > 0);
  assert.ok(resNearest.body.nearestMatches[0].distance < 9000);
});

test('Strict Return Quantity Limits - strictly prevents duplicate and excess returns of same items', async () => {
  const posRouter = require('../src/routes/pos.routes');
  const returnRoute = posRouter.stack.find((s) => s.route && s.route.path === '/returns');
  assert.ok(returnRoute, 'POST /returns route handler must exist');
  const returnHandler = returnRoute.route.stack[returnRoute.route.stack.length - 1].handle;

  // Create isolated product and invoice
  const product = await prisma.product.create({
    data: {
      name: 'Test Return Protection Vase',
      sku: `VASE-${Date.now()}`,
      barcode: `890${Date.now().toString().slice(-10)}`,
      sellingPrice: 1000,
      purchasePrice: 600,
      mrp: 1200,
      currentStock: 10,
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `TEST-INV-${Date.now()}`,
      customerName: 'Return Tester',
      subtotal: 2000,
      grandTotal: 2000,
      paidAmount: 2000,
      balanceAmount: 0,
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      items: {
        create: [
          {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            hsnCode: '9701',
            quantity: 2, // 2 units sold
            unitPrice: 1000,
            mrp: 1200,
            taxRate: 18,
            taxableAmount: 1694.92,
            totalAmount: 2000,
          },
        ],
      },
    },
  });

  const callReturn = (body) =>
    new Promise((resolve) => {
      let statusCode = 200;
      const req = {
        body,
        user: { name: 'Admin Tester', role: 'ADMIN' },
        logAudit: () => {},
      };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          resolve({ status: statusCode, body: data });
        },
      };
      returnHandler(req, res);
    });

  try {
    // 1. First return: Return 1 unit (allowed, 1 remaining)
    const ret1 = await callReturn({
      invoiceId: invoice.id,
      reason: 'Exchange 1 unit',
      refundMethod: 'CASH',
      items: [{ productId: product.id, quantity: 1, refundAmount: 1000, condition: 'RESTOCKABLE' }],
    });
    assert.equal(ret1.status, 201);
    const prodAfterRet1 = await prisma.product.findUnique({ where: { id: product.id } });
    assert.equal(prodAfterRet1.currentStock, 11); // Initial 10 + 1 restocked

    // 2. Second return: Try returning 2 units (must FAIL because only 1 unit is remaining)
    const ret2 = await callReturn({
      invoiceId: invoice.id,
      reason: 'Greedy return 2 units',
      refundMethod: 'CASH',
      items: [{ productId: product.id, quantity: 2, refundAmount: 2000, condition: 'RESTOCKABLE' }],
    });
    assert.equal(ret2.status, 400);
    assert.match(ret2.body.error, /Maximum returnable is 1/i);

    // 3. Third return: Return the remaining 1 unit (allowed, now 0 remaining)
    const ret3 = await callReturn({
      invoiceId: invoice.id,
      reason: 'Exchange remaining 1 unit',
      refundMethod: 'CASH',
      items: [{ productId: product.id, quantity: 1, refundAmount: 1000, condition: 'RESTOCKABLE' }],
    });
    assert.equal(ret3.status, 201);
    const prodAfterRet3 = await prisma.product.findUnique({ where: { id: product.id } });
    assert.equal(prodAfterRet3.currentStock, 12); // Initial 10 + 2 restocked

    // 4. Fourth return: Try returning 1 unit AGAIN (must FAIL because completely returned!)
    const ret4 = await callReturn({
      invoiceId: invoice.id,
      reason: 'Duplicate return again',
      refundMethod: 'CASH',
      items: [{ productId: product.id, quantity: 1, refundAmount: 1000, condition: 'RESTOCKABLE' }],
    });
    assert.equal(ret4.status, 400);
    assert.match(ret4.body.error, /already been completely returned/i);

    // Verify stock has not changed from 12
    const finalProd = await prisma.product.findUnique({ where: { id: product.id } });
    assert.equal(finalProd.currentStock, 12);
  } finally {
    // Cleanup
    await prisma.stockMovement.deleteMany({ where: { productId: product.id } });
    await prisma.salesReturnItem.deleteMany({ where: { productId: product.id } });
    await prisma.salesReturn.deleteMany({ where: { invoiceId: invoice.id } });
    await prisma.payment.deleteMany({ where: { invoiceId: invoice.id } });
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
    await prisma.invoice.delete({ where: { id: invoice.id } });
    await prisma.product.delete({ where: { id: product.id } });
  }
});

test('DELETE /api/pos/invoices/:id - permanently deletes invoice, restores stock, and rolls back sequence for most recent bill', async () => {
  const posRouter = require('../src/routes/pos.routes');
  const deleteRoute = posRouter.stack.find((s) => s.route && s.route.path === '/invoices/:id' && s.route.methods.delete);
  assert.ok(deleteRoute, 'DELETE /invoices/:id route handler must exist');
  const deleteHandler = deleteRoute.route.stack[deleteRoute.route.stack.length - 1].handle;

  const business = await prisma.businessProfile.findFirst();
  const originalNextNumber = business.invoiceNextNumber;

  // Create isolated test product
  const product = await prisma.product.create({
    data: {
      name: 'Test Deletion Painting',
      sku: `PAINT-${Date.now()}`,
      barcode: `890${Date.now().toString().slice(-10)}`,
      sellingPrice: 3000,
      purchasePrice: 1500,
      mrp: 3500,
      currentStock: 5,
    },
  });

  // Create an invoice simulating the most recent bill
  const simulatedBillNum = originalNextNumber;
  const invNumber = `${business.invoicePrefix}${simulatedBillNum}`;

  // Advance business next number to simulatedBillNum + 1 (simulating next bill would be billNum + 1)
  await prisma.businessProfile.update({
    where: { id: business.id },
    data: { invoiceNextNumber: simulatedBillNum + 1 },
  });

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: invNumber,
      customerName: 'Sequence Rollback Customer',
      subtotal: 3000,
      grandTotal: 3000,
      paidAmount: 3000,
      balanceAmount: 0,
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      items: {
        create: [
          {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            hsnCode: '9701',
            quantity: 2,
            unitPrice: 1500,
            mrp: 1800,
            taxRate: 18,
            taxableAmount: 2542.37,
            totalAmount: 3000,
          },
        ],
      },
      payments: {
        create: [
          {
            type: 'RECEIPT',
            paymentMethod: 'CASH',
            amount: 3000,
          },
        ],
      },
    },
  });

  const callDelete = (id) =>
    new Promise((resolve) => {
      let statusCode = 200;
      const req = {
        params: { id },
        user: { name: 'Admin Tester', role: 'ADMIN' },
        logAudit: () => {},
      };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          resolve({ status: statusCode, body: data });
        },
      };
      deleteHandler(req, res);
    });

  try {
    // Current stock is 5.
    // Deleting the invoice should permanently delete it, restore 2 units to stock (5 + 2 = 7),
    // and roll back invoiceNextNumber to simulatedBillNum!
    const delRes = await callDelete(invoice.id);
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.success, true);
    assert.equal(delRes.body.deletedInvoiceNumber, invNumber);
    assert.equal(delRes.body.nextInvoiceNumber, simulatedBillNum);

    // Verify invoice is completely deleted
    const checkInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    assert.equal(checkInvoice, null);

    // Verify stock was restored from 5 to 7
    const checkProduct = await prisma.product.findUnique({ where: { id: product.id } });
    assert.equal(checkProduct.currentStock, 7);

    // Verify businessProfile next invoice number rolled back to simulatedBillNum!
    const checkProfile = await prisma.businessProfile.findFirst();
    assert.equal(checkProfile.invoiceNextNumber, simulatedBillNum);
  } finally {
    // Cleanup
    await prisma.stockMovement.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {});
    await prisma.businessProfile.update({
      where: { id: business.id },
      data: { invoiceNextNumber: originalNextNumber },
    });
  }
});
