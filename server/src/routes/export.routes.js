const express = require('express');
const XLSX = require('xlsx');
const prisma = require('../prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper: send workbook as Excel or CSV
function sendSpreadsheet(res, workbook, baseFilename, format = 'xlsx') {
  const timestamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    const firstSheetName = workbook.SheetNames[0];
    const csvContent = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}_${timestamp}.csv"`);
    return res.send(csvContent);
  }

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}_${timestamp}.xlsx"`);
  return res.send(buffer);
}

// 1. GET /api/export/all - Complete Multi-Sheet Master Migration Excel File
router.get('/all', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const [
      customers,
      products,
      suppliers,
      invoices,
      purchaseBills,
      stockMovements,
      expenses,
      pricebooks,
    ] = await Promise.all([
      prisma.customer.findMany({ include: { pricebook: true }, orderBy: { name: 'asc' } }),
      prisma.product.findMany({ include: { category: true, supplier: true }, orderBy: { name: 'asc' } }),
      prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
      prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.purchaseBill.findMany({ include: { supplier: true }, orderBy: { billDate: 'desc' } }),
      prisma.stockMovement.findMany({ include: { product: true }, orderBy: { createdAt: 'desc' }, take: 10000 }),
      prisma.expense.findMany({ orderBy: { expenseDate: 'desc' } }),
      prisma.pricebook.findMany({ orderBy: { name: 'asc' } }),
    ]);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Customers
    const customerRows = customers.map((c) => ({
      'Customer Name': c.name,
      'Mobile Number': c.mobile,
      'Email': c.email || '',
      'Billing Address': c.billingAddress || '',
      'Shipping Address': c.shippingAddress || '',
      'State': c.state || 'Gujarat',
      'State Code': c.stateCode || '24',
      'Pincode': c.pincode || '',
      'GSTIN': c.gstin || '',
      'GST Date': c.gstDate || '',
      'PAN No': c.panNo || '',
      'MSME No': c.msmeNo || '',
      'Customer Type': c.customerType || 'RETAIL',
      'Pricebook': c.pricebook?.name || 'Default MRP',
      'Current Balance (₹)': c.currentBalance || 0,
      'Opening Balance (₹)': c.openingBalance || 0,
      'Created Date': c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customerRows), 'Customers');

    // Sheet 2: Products
    const productRows = products.map((p) => ({
      'Product Title': p.name,
      'SKU': p.sku,
      'Barcode': p.barcode,
      'Category': p.category?.name || 'Home Décor',
      'HSN Code': p.hsnCode,
      'GST Rate (%)': p.gstRate,
      'Purchase Price (₹)': req.user.role === 'ADMIN' ? p.purchasePrice : 0,
      'Selling Price (₹)': p.sellingPrice,
      'MRP (₹)': p.mrp,
      'Current Stock': p.currentStock,
      'Min Stock Alert': p.minStock,
      'Unit': p.unit,
      'Status': p.status,
      'Supplier': p.supplier?.name || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), 'Products_Catalog');

    // Sheet 3: Suppliers
    const supplierRows = suppliers.map((s) => ({
      'Supplier Name': s.name,
      'Contact Person': s.contactPerson || '',
      'Mobile': s.mobile,
      'Email': s.email || '',
      'GSTIN': s.gstin || '',
      'Address': s.address || '',
      'State': s.state || 'Gujarat',
      'State Code': s.stateCode || '24',
      'Outstanding Balance (₹)': s.currentBalance || 0,
      'Opening Balance (₹)': s.openingBalance || 0,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(supplierRows), 'Suppliers');

    // Sheet 4: Sales Invoices
    const invoiceRows = invoices.map((inv) => ({
      'Invoice Number': inv.invoiceNumber,
      'Date': inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN') : '',
      'Customer Name': inv.customerName,
      'Customer Mobile': inv.customerMobile || '',
      'Customer GSTIN': inv.customerGstin || '',
      'Place of Supply': inv.placeOfSupply || '24-Gujarat',
      'Transaction Type': inv.isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)',
      'Subtotal (₹)': inv.subtotal,
      'Discount (₹)': inv.discountTotal,
      'CGST (₹)': inv.cgstTotal,
      'SGST (₹)': inv.sgstTotal,
      'IGST (₹)': inv.igstTotal,
      'Round Off (₹)': inv.roundOff,
      'Grand Total (₹)': inv.grandTotal,
      'Paid Amount (₹)': inv.paidAmount,
      'Balance Due (₹)': inv.balanceAmount,
      'Payment Status': inv.paymentStatus,
      'Payment Method': inv.paymentMethod,
      'Status': inv.status,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoiceRows), 'Sales_Invoices');

    // Sheet 5: Purchase Bills
    const purchaseRows = purchaseBills.map((pb) => ({
      'Bill Number': pb.billNumber,
      'Supplier Bill No': pb.supplierBillNumber || '',
      'Supplier Name': pb.supplier?.name || '',
      'Bill Date': pb.billDate ? new Date(pb.billDate).toLocaleDateString('en-IN') : '',
      'Due Date': pb.dueDate ? new Date(pb.dueDate).toLocaleDateString('en-IN') : '',
      'Subtotal (₹)': pb.subtotal,
      'Tax (₹)': pb.taxTotal,
      'Grand Total (₹)': pb.grandTotal,
      'Paid Amount (₹)': pb.paidAmount,
      'Payment Status': pb.paymentStatus,
      'Notes': pb.notes || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchaseRows), 'Purchase_Bills');

    // Sheet 6: Stock Movements Ledger
    const stockRows = stockMovements.map((sm) => ({
      'Date': sm.createdAt ? new Date(sm.createdAt).toLocaleString('en-IN') : '',
      'Product Name': sm.product?.name || '',
      'SKU': sm.product?.sku || '',
      'Movement Type': sm.type,
      'Quantity': sm.quantity,
      'Balance After': sm.balanceAfter,
      'Reference Type': sm.referenceType || '',
      'Reference ID': sm.referenceId || '',
      'Notes': sm.notes || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockRows), 'Stock_Ledger');

    // Sheet 7: Expenses
    const expenseRows = expenses.map((e) => ({
      'Expense Date': e.expenseDate ? new Date(e.expenseDate).toLocaleDateString('en-IN') : '',
      'Expense Title': e.title,
      'Category': e.category,
      'Amount (₹)': e.amount,
      'Tax Rate (%)': e.taxRate,
      'Tax Amount (₹)': e.taxAmount,
      'Payment Method': e.paymentMethod,
      'Description': e.description || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), 'Expenses');

    // Sheet 8: Pricebooks
    const pricebookRows = pricebooks.map((pb) => ({
      'Pricebook Name': pb.name,
      'Code': pb.code,
      'Type': pb.type,
      'Discount %': pb.discountPercentage,
      'Is Default': pb.isDefault ? 'YES' : 'NO',
      'Is Active': pb.isActive ? 'ACTIVE' : 'INACTIVE',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pricebookRows), 'Pricebooks');

    req.logAudit?.('EXPORT_ALL_DATA', 'SYSTEM', null, {
      sheets: wb.SheetNames,
      totalCustomers: customers.length,
      totalProducts: products.length,
      totalInvoices: invoices.length,
    });

    sendSpreadsheet(res, wb, 'curated_art_complete_business_data', 'xlsx');
  } catch (err) {
    console.error('Master export error:', err);
    res.status(500).json({ error: 'Failed to generate master data export: ' + err.message });
  }
});

// 2. GET /api/export/customers - Export Customers Only (.xlsx or .csv)
router.get('/customers', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
    const customers = await prisma.customer.findMany({
      include: { pricebook: true },
      orderBy: { name: 'asc' },
    });

    const rows = customers.map((c) => ({
      'Account Name': c.name,
      'Mobile Nos.': c.mobile,
      'Email': c.email || '',
      'Address': c.billingAddress || '',
      'Shipping Address': c.shippingAddress || '',
      'State': c.state || 'Gujarat',
      'State Code': c.stateCode || '24',
      'Pincode': c.pincode || '',
      'GST No.': c.gstin || '',
      'GST Date': c.gstDate || '',
      'PAN No.': c.panNo || '',
      'MSME No.': c.msmeNo || '',
      'Customer Type': c.customerType || 'RETAIL',
      'Pricebook': c.pricebook?.name || 'Default MRP',
      'Current Balance': c.currentBalance || 0,
      'Opening Balance': c.openingBalance || 0,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Customers');
    sendSpreadsheet(res, wb, 'customers_export', format);
  } catch (err) {
    console.error('Export customers error:', err);
    res.status(500).json({ error: 'Failed to export customers: ' + err.message });
  }
});

// 3. GET /api/export/products - Export Products Catalog (.xlsx or .csv)
router.get('/products', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
    const products = await prisma.product.findMany({
      include: { category: true, supplier: true },
      orderBy: { name: 'asc' },
    });

    const rows = products.map((p) => ({
      'Product Title': p.name,
      'SKU': p.sku,
      'Barcode': p.barcode,
      'Category': p.category?.name || 'Home Décor',
      'HSN Code': p.hsnCode,
      'Purchase Price': req.user.role === 'ADMIN' ? p.purchasePrice : 0,
      'Selling Price': p.sellingPrice,
      'MRP': p.mrp,
      'GST Rate': p.gstRate,
      'Current Stock': p.currentStock,
      'Min Stock': p.minStock,
      'Unit': p.unit,
      'Status': p.status,
      'Supplier': p.supplier?.name || '',
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Products');
    sendSpreadsheet(res, wb, 'products_catalog_export', format);
  } catch (err) {
    console.error('Export products error:', err);
    res.status(500).json({ error: 'Failed to export products: ' + err.message });
  }
});

// 4. GET /api/export/suppliers - Export Suppliers (.xlsx or .csv)
router.get('/suppliers', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });

    const rows = suppliers.map((s) => ({
      'Supplier Name': s.name,
      'Contact Person': s.contactPerson || '',
      'Mobile Nos.': s.mobile,
      'Email': s.email || '',
      'GST No.': s.gstin || '',
      'Address': s.address || '',
      'State': s.state || 'Gujarat',
      'State Code': s.stateCode || '24',
      'Current Balance': s.currentBalance || 0,
      'Opening Balance': s.openingBalance || 0,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Suppliers');
    sendSpreadsheet(res, wb, 'suppliers_export', format);
  } catch (err) {
    console.error('Export suppliers error:', err);
    res.status(500).json({ error: 'Failed to export suppliers: ' + err.message });
  }
});

// 5. GET /api/export/invoices - Export Sales Invoices (.xlsx or .csv)
router.get('/invoices', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
    const invoices = await prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } });

    const rows = invoices.map((inv) => ({
      'Invoice Number': inv.invoiceNumber,
      'Invoice Date': inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN') : '',
      'Customer Name': inv.customerName,
      'Mobile': inv.customerMobile || '',
      'GSTIN': inv.customerGstin || '',
      'Place of Supply': inv.placeOfSupply || '24-Gujarat',
      'Inter-State': inv.isInterState ? 'YES' : 'NO',
      'Subtotal': inv.subtotal,
      'Discount': inv.discountTotal,
      'CGST': inv.cgstTotal,
      'SGST': inv.sgstTotal,
      'IGST': inv.igstTotal,
      'Round Off': inv.roundOff,
      'Grand Total': inv.grandTotal,
      'Paid Amount': inv.paidAmount,
      'Balance Due': inv.balanceAmount,
      'Payment Status': inv.paymentStatus,
      'Payment Method': inv.paymentMethod,
      'Status': inv.status,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Sales_Invoices');
    sendSpreadsheet(res, wb, 'sales_invoices_export', format);
  } catch (err) {
    console.error('Export invoices error:', err);
    res.status(500).json({ error: 'Failed to export invoices: ' + err.message });
  }
});

// 6. GET /api/export/purchases - Export Purchase Bills (.xlsx or .csv)
router.get('/purchases', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
    const bills = await prisma.purchaseBill.findMany({
      include: { supplier: true },
      orderBy: { billDate: 'desc' },
    });

    const rows = bills.map((pb) => ({
      'Bill Number': pb.billNumber,
      'Supplier Bill No': pb.supplierBillNumber || '',
      'Supplier Name': pb.supplier?.name || '',
      'Bill Date': pb.billDate ? new Date(pb.billDate).toLocaleDateString('en-IN') : '',
      'Due Date': pb.dueDate ? new Date(pb.dueDate).toLocaleDateString('en-IN') : '',
      'Subtotal': pb.subtotal,
      'Tax Total': pb.taxTotal,
      'Grand Total': pb.grandTotal,
      'Paid Amount': pb.paidAmount,
      'Payment Status': pb.paymentStatus,
      'Notes': pb.notes || '',
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Purchase_Bills');
    sendSpreadsheet(res, wb, 'purchase_bills_export', format);
  } catch (err) {
    console.error('Export purchases error:', err);
    res.status(500).json({ error: 'Failed to export purchases: ' + err.message });
  }
});

// 7. GET /api/export/inventory - Export Stock Movements (.xlsx or .csv)
router.get('/inventory', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
    const movements = await prisma.stockMovement.findMany({
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const rows = movements.map((sm) => ({
      'Timestamp': sm.createdAt ? new Date(sm.createdAt).toLocaleString('en-IN') : '',
      'Product Name': sm.product?.name || '',
      'SKU': sm.product?.sku || '',
      'Movement Type': sm.type,
      'Quantity Changed': sm.quantity,
      'Stock After Movement': sm.balanceAfter,
      'Reference Type': sm.referenceType || '',
      'Reference ID': sm.referenceId || '',
      'Notes': sm.notes || '',
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Stock_Ledger');
    sendSpreadsheet(res, wb, 'stock_movement_ledger_export', format);
  } catch (err) {
    console.error('Export inventory error:', err);
    res.status(500).json({ error: 'Failed to export inventory: ' + err.message });
  }
});

// 8. GET /api/export/expenses - Export Expenses (.xlsx or .csv)
router.get('/expenses', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
    const expenses = await prisma.expense.findMany({ orderBy: { expenseDate: 'desc' } });

    const rows = expenses.map((e) => ({
      'Expense Date': e.expenseDate ? new Date(e.expenseDate).toLocaleDateString('en-IN') : '',
      'Title': e.title,
      'Category': e.category,
      'Amount (₹)': e.amount,
      'Tax Rate (%)': e.taxRate,
      'Tax Amount (₹)': e.taxAmount,
      'Payment Method': e.paymentMethod,
      'Description': e.description || '',
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Expenses');
    sendSpreadsheet(res, wb, 'expenses_export', format);
  } catch (err) {
    console.error('Export expenses error:', err);
    res.status(500).json({ error: 'Failed to export expenses: ' + err.message });
  }
});

module.exports = router;

