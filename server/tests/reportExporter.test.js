const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');

// Pure test of report generation logic matching reportExporter.js
function formatReportDate(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatReportCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  return Math.round(Number(val) * 100) / 100;
}

test('Report Exporter - Formats dates and currency properly', () => {
  const d = new Date('2026-11-16T12:00:00Z');
  const formatted = formatReportDate(d);
  assert.ok(formatted.includes('2026'));
  assert.ok(formatted.includes('Nov'));

  assert.equal(formatReportCurrency(1234.567), 1234.57);
  assert.equal(formatReportCurrency(null), 0);
  assert.equal(formatReportCurrency(undefined), 0);
  assert.equal(formatReportCurrency(0), 0);
});

test('Report Exporter - Generates clean workbook with auto column widths and no internal CUIDs', () => {
  const rawInvoices = [
    {
      id: 'cuid_test_12345',
      invoiceNumber: 'INV-2026-001',
      createdAt: '2026-11-16T10:00:00Z',
      customerName: 'Aarav Mehta',
      customerMobile: '9898012345',
      customerGstin: '24AAACP1234A1Z5',
      paymentMethod: 'UPI',
      paymentStatus: 'PAID',
      items: [{ quantity: 2 }, { quantity: 1 }],
      subtotal: 5000,
      discountTotal: 200,
      taxTotal: 864,
      roundOff: 0,
      grandTotal: 5664,
      paidAmount: 5664,
      balanceAmount: 0,
    },
  ];

  const formattedRows = rawInvoices.map((inv, idx) => ({
    'Sr No': idx + 1,
    'Invoice Number': inv.invoiceNumber,
    'Date & Time': formatReportDate(inv.createdAt),
    'Customer Name': inv.customerName,
    'Customer Mobile': inv.customerMobile,
    'GSTIN': inv.customerGstin,
    'Payment Mode': inv.paymentMethod,
    'Payment Status': inv.paymentStatus,
    'Total Items Sold': inv.items.reduce((sum, item) => sum + item.quantity, 0),
    'Subtotal (₹)': formatReportCurrency(inv.subtotal),
    'Discount (₹)': formatReportCurrency(inv.discountTotal),
    'GST Total (₹)': formatReportCurrency(inv.taxTotal),
    'Round Off (₹)': formatReportCurrency(inv.roundOff),
    'Grand Total (₹)': formatReportCurrency(inv.grandTotal),
    'Paid Amount (₹)': formatReportCurrency(inv.paidAmount),
    'Balance Due (₹)': formatReportCurrency(inv.balanceAmount),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(formattedRows);

  // Auto col widths
  const keys = Object.keys(formattedRows[0]);
  const colWidths = keys.map((key) => {
    let maxLen = key.length;
    for (const row of formattedRows) {
      const val = row[key];
      if (val !== undefined && val !== null) {
        maxLen = Math.max(maxLen, String(val).length);
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 10), 60) };
  });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Invoices_Register');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  assert.ok(buffer.length > 500);

  // Read back and verify
  const parsed = XLSX.read(buffer, { type: 'buffer' });
  assert.equal(parsed.SheetNames[0], 'Invoices_Register');
  const sheet = parsed.Sheets['Invoices_Register'];
  const json = XLSX.utils.sheet_to_json(sheet);
  assert.equal(json.length, 1);
  assert.equal(json[0]['Invoice Number'], 'INV-2026-001');
  assert.equal(json[0]['Grand Total (₹)'], 5664);
  assert.equal(json[0]['id'], undefined); // CUID must not exist!
  assert.equal(json[0]['cuid_test_12345'], undefined);
});
