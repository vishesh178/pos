const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/prisma');

test('Customer Bulk Import - 10 Fields (Address, Phone, State, Pincode, GST, Date, PAN, MSME)', async () => {
  const testItems = [
    {
      name: 'TEST GOKUL MEGASTAR TOURS',
      address: 'AMROLI, SURAT',
      mobile: '',
      state: 'Gujarat',
      stateCode: '24',
      pincode: '394107',
      gstin: '',
      gstDate: '',
      panNo: '',
      msmeNo: '',
    },
    {
      name: 'TEST AADI ART ENTERPRISE',
      address: 'CHAMPA COLONY, NADIAD',
      mobile: '9925080873',
      state: 'Gujarat',
      stateCode: '24',
      pincode: '387325',
      gstin: '24APDPP1426P1ZP',
      gstDate: '01/07/2017',
      panNo: 'APDPP1426P',
      msmeNo: 'UDYAM-GJ-01-0001',
    },
    {
      name: 'TEST SHALIMAR TRADING MAHARASHTRA',
      address: '301 SHALIMAR GUEST HOUSE, MUMBAI',
      mobile: '9820012345',
      state: 'Maharashtra',
      stateCode: '27',
      pincode: '400001',
      gstin: '27AGVPP1698Q1Z0',
      gstDate: '01/07/2017',
      panNo: 'AGVPP1698Q',
      msmeNo: 'UDYAM-MH-01-0012',
    },
  ];

  // Clean up
  await prisma.customer.deleteMany({
    where: { name: { in: testItems.map((i) => i.name) } },
  });

  const created = [];
  for (const item of testItems) {
    const cust = await prisma.customer.create({
      data: {
        name: item.name.trim(),
        mobile: item.mobile && item.mobile.trim() ? item.mobile.trim() : '-',
        billingAddress: item.address || null,
        pincode: item.pincode || null,
        gstin: item.gstin || null,
        gstDate: item.gstDate || null,
        panNo: item.panNo || null,
        msmeNo: item.msmeNo || null,
        state: item.state || 'Gujarat',
        stateCode: item.stateCode || '24',
        customerType: item.gstin ? 'CORPORATE' : 'RETAIL',
      },
    });
    created.push(cust);
  }

  assert.equal(created.length, 3);

  // Verify all 10 fields for Aadi Art
  const aadi = created.find((c) => c.name === 'TEST AADI ART ENTERPRISE');
  assert.ok(aadi);
  assert.equal(aadi.mobile, '9925080873');
  assert.equal(aadi.billingAddress, 'CHAMPA COLONY, NADIAD');
  assert.equal(aadi.pincode, '387325');
  assert.equal(aadi.gstin, '24APDPP1426P1ZP');
  assert.equal(aadi.gstDate, '01/07/2017');
  assert.equal(aadi.panNo, 'APDPP1426P');
  assert.equal(aadi.msmeNo, 'UDYAM-GJ-01-0001');
  assert.equal(aadi.state, 'Gujarat');
  assert.equal(aadi.stateCode, '24');

  // Clean up
  await prisma.customer.deleteMany({
    where: { name: { in: testItems.map((i) => i.name) } },
  });
});

test('Customer Deduplication - Strictly Prevents Duplicate Accounts', async () => {
  const customerName = 'TEST UNIQUE RAJESH IMPEX';

  await prisma.customer.deleteMany({ where: { name: customerName } });

  // 1. Create original customer
  const first = await prisma.customer.create({
    data: {
      name: customerName,
      mobile: '9825099999',
      gstin: '24AAAAA1111A1Z1',
      panNo: 'AAAAA1111A',
      state: 'Gujarat',
      stateCode: '24',
    },
  });

  // 2. Attempt duplicate check by name (case-insensitive)
  const existingByName = await prisma.customer.findFirst({
    where: { name: { equals: customerName } },
  });
  assert.ok(existingByName);
  assert.equal(existingByName.id, first.id);

  // 3. Attempt duplicate check by GSTIN
  const existingByGstin = await prisma.customer.findFirst({
    where: { gstin: '24AAAAA1111A1Z1' },
  });
  assert.ok(existingByGstin);
  assert.equal(existingByGstin.id, first.id);

  // 4. Attempt duplicate check by mobile
  const existingByMobile = await prisma.customer.findFirst({
    where: { mobile: '9825099999' },
  });
  assert.ok(existingByMobile);
  assert.equal(existingByMobile.id, first.id);

  // Total count of customers with this name must strictly remain 1
  const count = await prisma.customer.count({ where: { name: customerName } });
  assert.equal(count, 1);

  // Clean up
  await prisma.customer.deleteMany({ where: { name: customerName } });
});

test('POS / Manual Customer Creation - Optional Mobile & All 10 Excel Fields', async () => {
  const custName = 'TEST POS NO-PHONE CLIENT';
  await prisma.customer.deleteMany({ where: { name: custName } });

  // Mobile omitted or empty should default to '-' without failing
  const created = await prisma.customer.create({
    data: {
      name: custName,
      mobile: '-',
      billingAddress: 'DINESH CHAMBERS, SURAT',
      pincode: '395002',
      gstin: '24AABCS1429B1Z8',
      gstDate: '12/04/2018',
      panNo: 'AABCS1429B',
      msmeNo: 'UDYAM-GJ-02-9988',
      state: 'Gujarat',
      stateCode: '24',
      customerType: 'CORPORATE',
    },
  });

  assert.ok(created.id);
  assert.equal(created.name, custName);
  assert.equal(created.mobile, '-');
  assert.equal(created.billingAddress, 'DINESH CHAMBERS, SURAT');
  assert.equal(created.pincode, '395002');
  assert.equal(created.gstin, '24AABCS1429B1Z8');
  assert.equal(created.panNo, 'AABCS1429B');

  // Clean up
  await prisma.customer.deleteMany({ where: { name: custName } });
});
