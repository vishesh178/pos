/**
 * Client-Side Indian GST Calculation Engine
 */

export function calculateItemGst(item, isInterState = false) {
  const quantity = Math.max(0.0001, parseFloat(item.quantity) || 1);
  const unitPrice = Math.max(0, parseFloat(item.unitPrice) || 0);
  const discountAmount = Math.max(0, parseFloat(item.discountAmount) || 0);
  const gstRate = Math.max(0, parseFloat(item.gstRate) || 0);
  const isTaxInclusive = !!item.isTaxInclusive;

  const grossTotal = unitPrice * quantity;
  const netBeforeTax = Math.max(0, grossTotal - discountAmount);

  let taxableAmount = 0;
  let taxAmount = 0;

  if (isTaxInclusive) {
    taxableAmount = netBeforeTax / (1 + gstRate / 100);
    taxAmount = netBeforeTax - taxableAmount;
  } else {
    taxableAmount = netBeforeTax;
    taxAmount = (taxableAmount * gstRate) / 100;
  }

  taxableAmount = Math.round(taxableAmount * 100) / 100;
  taxAmount = Math.round(taxAmount * 100) / 100;

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstAmount = taxAmount;
  } else {
    cgstAmount = Math.round((taxAmount / 2) * 100) / 100;
    sgstAmount = Math.round((taxAmount - cgstAmount) * 100) / 100;
  }

  const lineTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

  return {
    quantity,
    unitPrice,
    mrp: item.mrp || unitPrice,
    discountAmount,
    gstRate,
    taxableAmount,
    taxAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount: lineTotal,
  };
}

export function calculateInvoiceTotals(items = [], options = {}) {
  const businessStateCode = String(options.businessStateCode || '24').trim();
  const customerStateCode = String(options.customerStateCode || '24').trim();
  const isInterState = businessStateCode !== customerStateCode;
  const invoiceDiscount = Math.max(0, parseFloat(options.invoiceDiscount) || 0);

  let subtotal = 0;
  let discountTotal = invoiceDiscount;
  let taxableTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let taxTotal = 0;

  const processedItems = items.map((item) => {
    const calc = calculateItemGst(item, isInterState);
    subtotal += calc.unitPrice * calc.quantity;
    discountTotal += calc.discountAmount;
    taxableTotal += calc.taxableAmount;
    cgstTotal += calc.cgstAmount;
    sgstTotal += calc.sgstAmount;
    igstTotal += calc.igstAmount;
    taxTotal += calc.taxAmount;

    return {
      ...item,
      ...calc,
    };
  });

  if (invoiceDiscount > 0 && taxableTotal > 0) {
    const ratio = Math.max(0, (taxableTotal - invoiceDiscount) / taxableTotal);
    cgstTotal = Math.round(cgstTotal * ratio * 100) / 100;
    sgstTotal = Math.round(sgstTotal * ratio * 100) / 100;
    igstTotal = Math.round(igstTotal * ratio * 100) / 100;
    taxTotal = Math.round((cgstTotal + sgstTotal + igstTotal) * 100) / 100;
    taxableTotal = Math.round((taxableTotal - invoiceDiscount) * 100) / 100;
  }

  const rawGrandTotal = taxableTotal + taxTotal;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((roundedGrandTotal - rawGrandTotal) * 100) / 100;

  return {
    isInterState,
    items: processedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    discountTotal: Math.round(discountTotal * 100) / 100,
    taxableTotal: Math.round(taxableTotal * 100) / 100,
    cgstTotal: Math.round(cgstTotal * 100) / 100,
    sgstTotal: Math.round(sgstTotal * 100) / 100,
    igstTotal: Math.round(igstTotal * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    roundOff,
    grandTotal: roundedGrandTotal,
  };
}

