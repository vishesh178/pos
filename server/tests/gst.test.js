const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateItemGst, calculateInvoiceTotals } = require('../src/utils/gst');

test('Intra-state transaction splits 18% GST into 9% CGST and 9% SGST', () => {
  const item = {
    unitPrice: 5000,
    quantity: 1,
    gstRate: 18,
    isTaxInclusive: false,
  };

  const result = calculateItemGst(item, false); // false = intra-state

  assert.equal(result.taxableAmount, 5000);
  assert.equal(result.taxAmount, 900);
  assert.equal(result.cgstAmount, 450);
  assert.equal(result.sgstAmount, 450);
  assert.equal(result.igstAmount, 0);
  assert.equal(result.totalAmount, 5900);
});

test('Inter-state transaction applies 18% IGST with zero CGST and SGST', () => {
  const item = {
    unitPrice: 5000,
    quantity: 1,
    gstRate: 18,
    isTaxInclusive: false,
  };

  const result = calculateItemGst(item, true); // true = inter-state

  assert.equal(result.taxableAmount, 5000);
  assert.equal(result.taxAmount, 900);
  assert.equal(result.cgstAmount, 0);
  assert.equal(result.sgstAmount, 0);
  assert.equal(result.igstAmount, 900);
  assert.equal(result.totalAmount, 5900);
});

test('Tax-inclusive price reverses properly into taxable and tax portions', () => {
  const item = {
    unitPrice: 1180,
    quantity: 1,
    gstRate: 18,
    isTaxInclusive: true,
  };

  const result = calculateItemGst(item, false);

  assert.equal(result.taxableAmount, 1000);
  assert.equal(result.taxAmount, 180);
  assert.equal(result.cgstAmount, 90);
  assert.equal(result.sgstAmount, 90);
  assert.equal(result.totalAmount, 1180);
});

test('Invoice totals calculate round-off to nearest rupee correctly', () => {
  const items = [
    {
      unitPrice: 499.99,
      quantity: 1,
      gstRate: 18,
      isTaxInclusive: false,
    },
  ];

  const invoice = calculateInvoiceTotals(items, {
    businessStateCode: '24',
    customerStateCode: '24',
  });

  assert.equal(invoice.isInterState, false);
  assert.equal(typeof invoice.roundOff, 'number');
  assert.equal(invoice.grandTotal, Math.round(invoice.taxableTotal + invoice.taxTotal));
});

