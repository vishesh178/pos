const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/prisma');

test('Tiered Pricebooks - Seeding & Default Integrity', async () => {
  const pricebooks = await prisma.pricebook.findMany({
    orderBy: { discountPercentage: 'asc' },
  });

  assert.ok(pricebooks.length >= 4, 'At least 4 pricebooks should exist');

  const retail = pricebooks.find((p) => p.code === 'RETAIL');
  assert.ok(retail, 'Retail tier must exist');
  assert.equal(retail.discountPercentage, 0);
  assert.equal(retail.isDefault, true);

  const designer = pricebooks.find((p) => p.code === 'DESIGNER');
  assert.ok(designer, 'Designer tier must exist');
  assert.equal(designer.discountPercentage, 20);

  const wholesale = pricebooks.find((p) => p.code === 'WHOLESALE');
  assert.ok(wholesale, 'Wholesale tier must exist');
  assert.equal(wholesale.discountPercentage, 35);

  const vip = pricebooks.find((p) => p.code === 'VIP');
  assert.ok(vip, 'VIP tier must exist');
  assert.equal(vip.discountPercentage, 10);
});

test('Tiered Pricebooks - Math & Discount Rate Calculations', () => {
  const sampleItems = [
    { name: 'Grand Roman Clock', mrp: 3499, quantity: 1 },
    { name: 'Brass Framed Mirror', mrp: 5000, quantity: 2 },
  ];

  // 1. Retail (0% discount)
  const retailTotal = sampleItems.reduce((acc, it) => acc + it.mrp * it.quantity, 0);
  assert.equal(retailTotal, 13499);

  // 2. Designer (20% discount)
  const designerDiscount = 20;
  const designerItems = sampleItems.map((it) => ({
    ...it,
    rate: Math.round(it.mrp * (1 - designerDiscount / 100)),
  }));
  // 3499 * 0.8 = 2799.2 -> 2799
  // 5000 * 0.8 = 4000
  assert.equal(designerItems[0].rate, 2799);
  assert.equal(designerItems[1].rate, 4000);
  const designerTotal = designerItems.reduce((acc, it) => acc + it.rate * it.quantity, 0);
  assert.equal(designerTotal, 2799 * 1 + 4000 * 2); // 10799
  assert.equal(retailTotal - designerTotal, 2700); // 2700 savings

  // 3. Wholesale (35% discount)
  const wholesaleDiscount = 35;
  const wholesaleItems = sampleItems.map((it) => ({
    ...it,
    rate: Math.round(it.mrp * (1 - wholesaleDiscount / 100)),
  }));
  // 3499 * 0.65 = 2274.35 -> 2274
  // 5000 * 0.65 = 3250
  assert.equal(wholesaleItems[0].rate, 2274);
  assert.equal(wholesaleItems[1].rate, 3250);
  const wholesaleTotal = wholesaleItems.reduce((acc, it) => acc + it.rate * it.quantity, 0);
  assert.equal(wholesaleTotal, 2274 * 1 + 3250 * 2); // 8774
  assert.equal(retailTotal - wholesaleTotal, 4725); // 4725 savings
});

test('Tiered Pricebooks - Customer Association', async () => {
  const designerPb = await prisma.pricebook.findUnique({ where: { code: 'DESIGNER' } });
  assert.ok(designerPb);

  // Create an interior designer customer
  const customer = await prisma.customer.create({
    data: {
      name: 'Studio Archetype (Test Designer)',
      mobile: '+91 99000 11223',
      customerType: 'INTERIOR_DESIGNER',
      pricebookId: designerPb.id,
      state: 'Gujarat',
      stateCode: '24',
    },
    include: { pricebook: true },
  });

  assert.equal(customer.pricebookId, designerPb.id);
  assert.equal(customer.pricebook?.code, 'DESIGNER');
  assert.equal(customer.pricebook?.discountPercentage, 20);

  // Clean up
  await prisma.customer.delete({ where: { id: customer.id } });
});

test('Tiered Pricebooks - Invoice Generation with Pricebook Reference', async () => {
  const designerPb = await prisma.pricebook.findUnique({ where: { code: 'DESIGNER' } });

  // Create isolated test product to prevent race condition with concurrent tests
  const product = await prisma.product.create({
    data: {
      name: 'Test Pricebook Artifact Isolated',
      sku: `TEST-PB-ISO-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      barcode: `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      sellingPrice: 3499,
      purchasePrice: 2000,
      mrp: 3499,
      currentStock: 10,
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `TEST-PB-${Date.now()}`,
      customerName: 'Test Pricebook Client',
      pricebookId: designerPb.id,
      pricebookName: designerPb.name,
      subtotal: 2799,
      grandTotal: 3303,
      paidAmount: 3303,
      balanceAmount: 0,
      paymentStatus: 'PAID',
      items: {
        create: [
          {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            hsnCode: product.hsnCode,
            quantity: 1,
            unitPrice: 2799,
            mrp: product.sellingPrice,
            taxRate: 18,
            taxableAmount: 2799,
            cgstAmount: 251.91,
            sgstAmount: 251.91,
            totalAmount: 3302.82,
          },
        ],
      },
    },
    include: { pricebook: true, items: true },
  });

  assert.equal(invoice.pricebookId, designerPb.id);
  assert.equal(invoice.pricebookName, designerPb.name);
  assert.equal(invoice.pricebook?.discountPercentage, 20);

  // Clean up
  await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
  await prisma.invoice.delete({ where: { id: invoice.id } });
  await prisma.product.delete({ where: { id: product.id } });
});
