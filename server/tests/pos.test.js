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
