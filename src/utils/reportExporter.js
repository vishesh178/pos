import * as XLSX from 'xlsx';

/**
 * Format date in Indian business format: "16-Nov-2026"
 */
export function formatReportDate(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format datetime in Indian format: "16-Nov-2026 08:30 PM"
 */
export function formatReportDateTime(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const dateStr = formatReportDate(d);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${dateStr} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

/**
 * Format currency amount cleanly to 2 decimal places as a number
 */
export function formatReportCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  return Math.round(Number(val) * 100) / 100;
}

/**
 * Universal Formatted Report Exporter
 * Supports both Excel (.xlsx) and CSV (.csv)
 */
export function exportReportData({
  filename,
  sheetName = 'Report',
  rows = [],
  format = 'xlsx',
}) {
  if (!rows || !rows.length) {
    alert('No data available to export.');
    return;
  }

  // Ensure clean filename
  const cleanFilename = (filename || `Curated_Art_Report_${new Date().toISOString().slice(0, 10)}`)
    .replace(/[\\/:*?"<>|]/g, '_');

  // Create worksheet from formatted rows
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  const keys = Object.keys(rows[0] || {});
  const colWidths = keys.map((key) => {
    let maxLen = key.length;
    for (let i = 0; i < Math.min(rows.length, 500); i++) {
      const val = rows[i][key];
      if (val !== undefined && val !== null) {
        maxLen = Math.max(maxLen, String(val).length);
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 10), 60) };
  });
  ws['!cols'] = colWidths;

  if (format === 'csv') {
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    // Add UTF-8 BOM so Excel opens ₹ and UTF-8 characters without mojibake
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanFilename}.csv`;
    link.target = '_self';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 2500);
    return;
  }

  // Default: XLSX
  const wb = XLSX.utils.book_new();
  const safeSheetName = (sheetName || 'Report').slice(0, 31).replace(/[\\/?*\[\]]/g, '_');
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  XLSX.writeFile(wb, `${cleanFilename}.xlsx`);
}

/**
 * 1. Export Sales Summary by Period
 */
export function exportSalesReport(salesSummary, period = 'month', format = 'xlsx') {
  const periodLabel = String(period || 'month').toUpperCase();
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Curated_Art_Sales_Summary_${periodLabel}_${dateStr}`;

  const rows = (salesSummary?.invoices || []).map((inv, idx) => ({
    'Sr No': idx + 1,
    'Invoice Number': inv.invoiceNumber || '',
    'Date & Time': formatReportDateTime(inv.date),
    'Customer Name': inv.customerName || 'Walk-in Customer',
    'Items Count': inv.itemsCount || 0,
    'Payment Mode': inv.paymentMethod || 'CASH',
    'Payment Status': inv.paymentStatus || 'PAID',
    'Total Amount (₹)': formatReportCurrency(inv.grandTotal),
  }));

  exportReportData({
    filename,
    sheetName: `Sales_${periodLabel}`,
    rows,
    format,
  });
}

/**
 * 2. Export Product Profitability & Margins
 */
export function exportProfitabilityReport(productMargins = [], format = 'xlsx') {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Curated_Art_Product_Profitability_${dateStr}`;

  const rows = (productMargins || []).map((p, idx) => {
    const row = {
      'Sr No': idx + 1,
      'Product Title': p.name || '',
      'SKU': p.sku || '',
      'Barcode': p.barcode || '',
      'Category': p.category || 'General',
      'Current Stock': p.currentStock || 0,
      'Selling Price (₹)': formatReportCurrency(p.sellingPrice),
      'Units Sold': p.unitsSold || 0,
      'Total Revenue (₹)': formatReportCurrency(p.totalRevenue),
    };
    if (p.purchasePrice !== null && p.purchasePrice !== undefined) {
      row['Purchase Cost (₹)'] = formatReportCurrency(p.purchasePrice);
      row['Total Cost (₹)'] = formatReportCurrency(p.totalCogs);
      row['Gross Profit (₹)'] = formatReportCurrency(p.grossProfit);
      row['Gross Margin (%)'] = p.marginPercent !== null ? `${p.marginPercent}%` : '0%';
    }
    return row;
  });

  exportReportData({
    filename,
    sheetName: 'Product_Margins',
    rows,
    format,
  });
}

/**
 * 3. Export Category Performance
 */
export function exportCategoryReport(categorySales, format = 'xlsx') {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Curated_Art_Category_Performance_${dateStr}`;

  const rows = (categorySales?.categories || []).map((c, idx) => ({
    'Sr No': idx + 1,
    'Category Name': c.name || 'Uncategorized',
    'Designs / Products Count': c.productsCount || 0,
    'Units Sold': c.unitsSold || 0,
    'Total Revenue (₹)': formatReportCurrency(c.revenue),
    'Revenue Share (%)': `${c.sharePercent || 0}%`,
  }));

  exportReportData({
    filename,
    sheetName: 'Category_Performance',
    rows,
    format,
  });
}

/**
 * 4. Export Customer Receivables
 */
export function exportCustomerReceivablesReport(customers = [], format = 'xlsx') {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Curated_Art_Customer_Receivables_${dateStr}`;

  const rows = (customers || []).map((c, idx) => ({
    'Sr No': idx + 1,
    'Customer Name': c.name || '',
    'Mobile Number': c.mobile || '',
    'GSTIN': c.gstin || '',
    'Customer Type': c.customerType || 'RETAIL',
    'Total Purchases (₹)': formatReportCurrency(c.totalPurchases),
    'Pending Balance (₹)': formatReportCurrency(c.outstandingBalance),
    'Last Activity': formatReportDate(c.updatedAt),
  }));

  exportReportData({
    filename,
    sheetName: 'Customer_Receivables',
    rows,
    format,
  });
}

/**
 * 5. Export Supplier Payables
 */
export function exportSupplierPayablesReport(suppliers = [], format = 'xlsx') {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Curated_Art_Supplier_Payables_${dateStr}`;

  const rows = (suppliers || []).map((s, idx) => ({
    'Sr No': idx + 1,
    'Supplier Name': s.name || '',
    'Contact Person': s.contactPerson || '',
    'Mobile Number': s.mobile || '',
    'GSTIN': s.gstin || '',
    'Pending Balance (₹)': formatReportCurrency(s.outstandingBalance),
    'Last Activity': formatReportDate(s.updatedAt),
  }));

  exportReportData({
    filename,
    sheetName: 'Supplier_Payables',
    rows,
    format,
  });
}

/**
 * 6. Export GSTR-1 HSN Summary
 */
export function exportGstr1HsnReport(hsnSummary = [], format = 'xlsx') {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Curated_Art_GSTR1_HSN_Summary_${dateStr}`;

  const rows = (hsnSummary || []).map((h, idx) => {
    const taxable = formatReportCurrency(h.taxableValue);
    const tax = formatReportCurrency(h.totalTax);
    return {
      'Sr No': idx + 1,
      'HSN Code': h.hsnCode || '9701',
      'Description': h.description || '',
      'Total Quantity': h.totalQuantity || 0,
      'Taxable Value (₹)': taxable,
      'CGST (₹)': formatReportCurrency(h.cgstAmount),
      'SGST (₹)': formatReportCurrency(h.sgstAmount),
      'IGST (₹)': formatReportCurrency(h.igstAmount),
      'Total GST (₹)': tax,
      'Total Invoice Value (₹)': formatReportCurrency(taxable + tax),
    };
  });

  exportReportData({
    filename,
    sheetName: 'GSTR1_HSN_Summary',
    rows,
    format,
  });
}

/**
 * 7. Export Invoices Register
 */
export function exportInvoicesRegisterReport(invoices = [], format = 'xlsx') {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Curated_Art_Sales_Invoices_Register_${dateStr}`;

  const rows = (invoices || []).map((inv, idx) => {
    let itemsCount = 0;
    if (Array.isArray(inv.items)) {
      itemsCount = inv.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    } else if (inv.itemsCount) {
      itemsCount = inv.itemsCount;
    }

    return {
      'Sr No': idx + 1,
      'Invoice Number': inv.invoiceNumber || '',
      'Date & Time': formatReportDateTime(inv.createdAt),
      'Customer Name': inv.customerName || 'Walk-in Customer',
      'Customer Mobile': inv.customerMobile || '',
      'GSTIN': inv.customerGstin || '',
      'Payment Mode': inv.paymentMethod || 'CASH',
      'Payment Status': inv.paymentStatus || 'PAID',
      'Total Items Sold': itemsCount,
      'Subtotal (₹)': formatReportCurrency(inv.subtotal),
      'Discount (₹)': formatReportCurrency(inv.discountTotal || 0),
      'GST Total (₹)': formatReportCurrency(inv.taxTotal || 0),
      'Round Off (₹)': formatReportCurrency(inv.roundOff || 0),
      'Grand Total (₹)': formatReportCurrency(inv.grandTotal),
      'Paid Amount (₹)': formatReportCurrency(inv.paidAmount || 0),
      'Balance Due (₹)': formatReportCurrency(inv.balanceAmount || 0),
    };
  });

  exportReportData({
    filename,
    sheetName: 'Invoices_Register',
    rows,
    format,
  });
}

