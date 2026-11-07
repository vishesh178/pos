/**
 * Indian GST Calculation Engine for Curated Art ERP
 */

/**
 * Calculates line-item GST amounts based on Place of Supply
 *
 * @param {Object} item
 * @param {number} item.unitPrice - Unit price
 * @param {number} item.quantity - Quantity
 * @param {number} [item.discountAmount=0] - Flat discount on item
 * @param {number} [item.gstRate=18] - GST percentage (0, 5, 12, 18, 28)
 * @param {boolean} [item.isTaxInclusive=false] - Whether unitPrice includes GST
 * @param {boolean} [isInterState=false] - True if customer is outside business state
 */
function calculateItemGst(item, isInterState = false) {
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
    // Reverse calculation: Taxable = Gross / (1 + Rate / 100)
    taxableAmount = netBeforeTax / (1 + gstRate / 100);
    taxAmount = netBeforeTax - taxableAmount;
  } else {
    // Standard calculation: Tax = Net * (Rate / 100)
    taxableAmount = netBeforeTax;
    taxAmount = (taxableAmount * gstRate) / 100;
  }

  // Round amounts to 2 decimal places
  taxableAmount = Math.round(taxableAmount * 100) / 100;
  taxAmount = Math.round(taxAmount * 100) / 100;

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstAmount = taxAmount;
  } else {
    // Split equally into CGST and SGST
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

/**
 * Calculates complete invoice totals, item breakdown, and round-off
 *
 * @param {Array<Object>} items - Array of invoice items
 * @param {Object} options
 * @param {string} [options.businessStateCode='24'] - Store state code (e.g. 24 for Gujarat)
 * @param {string} [options.customerStateCode='24'] - Customer state code
 * @param {number} [options.invoiceDiscount=0] - Overall bill discount
 */
function calculateInvoiceTotals(items = [], options = {}) {
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

  // Apply invoice-level discount to taxable total proportionally if present
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

const GST_STATE_CODE_TO_ZOHO = {
  '01': 'JK',
  '02': 'HP',
  '03': 'PB',
  '04': 'CH',
  '05': 'UK',
  '06': 'HR',
  '07': 'DL',
  '08': 'RJ',
  '09': 'UP',
  '10': 'BR',
  '11': 'SK',
  '12': 'AR',
  '13': 'NL',
  '14': 'MN',
  '15': 'MZ',
  '16': 'TR',
  '17': 'ML',
  '18': 'AS',
  '19': 'WB',
  '20': 'JH',
  '21': 'OD',
  '22': 'CG',
  '23': 'MP',
  '24': 'GJ',
  '25': 'DD',
  '26': 'DN',
  '27': 'MH',
  '28': 'AP',
  '29': 'KA',
  '30': 'GA',
  '31': 'LD',
  '32': 'KL',
  '33': 'TN',
  '34': 'PY',
  '35': 'AN',
  '36': 'TG',
  '37': 'AD',
  '38': 'LA',
  '97': 'OT',
};

const STATE_NAME_TO_ZOHO = {
  'gujarat': 'GJ',
  'maharashtra': 'MH',
  'delhi': 'DL',
  'rajasthan': 'RJ',
  'karnataka': 'KA',
  'tamil nadu': 'TN',
  'uttar pradesh': 'UP',
  'punjab': 'PB',
  'haryana': 'HR',
  'west bengal': 'WB',
  'madhya pradesh': 'MP',
  'telangana': 'TG',
  'andhra pradesh': 'AP',
  'kerala': 'KL',
  'bihar': 'BR',
  'odisha': 'OD',
  'jharkhand': 'JH',
  'assam': 'AS',
  'chhattisgarh': 'CG',
  'uttarakhand': 'UK',
  'himachal pradesh': 'HP',
  'jammu and kashmir': 'JK',
  'goa': 'GA',
  'chandigarh': 'CH',
  'puducherry': 'PY',
};

/**
 * Returns the official 2-letter state code required by Zoho Books India (e.g. 'GJ', 'MH')
 */
function getZohoStateCode(input) {
  if (!input) return 'GJ';
  const str = String(input).trim();
  if (/^[A-Za-z]{2}$/.test(str)) {
    return str.toUpperCase();
  }
  const matchCode = str.match(/^(\d{2})/);
  if (matchCode && GST_STATE_CODE_TO_ZOHO[matchCode[1]]) {
    return GST_STATE_CODE_TO_ZOHO[matchCode[1]];
  }
  const cleanName = str.replace(/^\d+[-_ ]*/, '').toLowerCase().trim();
  if (STATE_NAME_TO_ZOHO[cleanName]) {
    return STATE_NAME_TO_ZOHO[cleanName];
  }
  return 'GJ';
}

module.exports = {
  calculateItemGst,
  calculateInvoiceTotals,
  getZohoStateCode,
};

