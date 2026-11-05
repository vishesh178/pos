const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const prisma = require('../src/prisma');
const { generateToken } = require('../src/middleware/auth');

test('Data Export Engine - Generates Valid Multi-Tab Excel Workbook', async () => {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  assert.ok(admin, 'Admin user must exist');
  const token = generateToken(admin);
  assert.ok(token);

  // Fetch data directly similar to export route
  const [customers, products, suppliers, invoices, bills, stock, expenses, pricebooks, generalAccounts] = await Promise.all([
    prisma.customer.findMany({ include: { pricebook: true } }),
    prisma.product.findMany({ include: { category: true, supplier: true } }),
    prisma.supplier.findMany(),
    prisma.invoice.findMany(),
    prisma.purchaseBill.findMany({ include: { supplier: true } }),
    prisma.stockMovement.findMany({ include: { product: true }, take: 100 }),
    prisma.expense.findMany(),
    prisma.pricebook.findMany(),
    prisma.generalAccount.findMany(),
  ]);

  const wb = XLSX.utils.book_new();

  const customerRows = customers.map((c) => ({ Name: c.name, Mobile: c.mobile, GSTIN: c.gstin || '' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customerRows), 'Customers');

  const productRows = products.map((p) => ({ Title: p.name, SKU: p.sku, Barcode: p.barcode, Price: p.sellingPrice }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), 'Products_Catalog');

  const supplierRows = suppliers.map((s) => ({ Name: s.name, Mobile: s.mobile, GSTIN: s.gstin || '' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(supplierRows), 'Suppliers');

  const invoiceRows = invoices.map((inv) => ({ Number: inv.invoiceNumber, GrandTotal: inv.grandTotal }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoiceRows), 'Sales_Invoices');

  const billRows = bills.map((b) => ({ Number: b.billNumber, GrandTotal: b.grandTotal }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(billRows), 'Purchase_Bills');

  const stockRows = stock.map((s) => ({ Type: s.type, Qty: s.quantity }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockRows), 'Stock_Ledger');

  const expenseRows = expenses.map((e) => ({ Title: e.title, Amount: e.amount }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), 'Expenses');

  const pricebookRows = pricebooks.map((pb) => ({ Name: pb.name, Discount: pb.discountPercentage }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pricebookRows), 'Pricebooks');

  const ledgerRows = generalAccounts.map((ga) => ({ Name: ga.name, Group: ga.accountGroup, Type: ga.accountType }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ledgerRows), 'Chart_of_Accounts');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  assert.ok(buffer.length > 1000, 'Excel buffer must have valid binary size');

  // Verify that the written binary can be read back cleanly by SheetJS
  const parsedWb = XLSX.read(buffer, { type: 'buffer' });
  assert.equal(parsedWb.SheetNames.length, 9);
  assert.ok(parsedWb.SheetNames.includes('Customers'));
  assert.ok(parsedWb.SheetNames.includes('Products_Catalog'));
  assert.ok(parsedWb.SheetNames.includes('Suppliers'));
  assert.ok(parsedWb.SheetNames.includes('Sales_Invoices'));
  assert.ok(parsedWb.SheetNames.includes('Chart_of_Accounts'));
  assert.ok(parsedWb.SheetNames.includes('Purchase_Bills'));
  assert.ok(parsedWb.SheetNames.includes('Stock_Ledger'));
  assert.ok(parsedWb.SheetNames.includes('Expenses'));
  assert.ok(parsedWb.SheetNames.includes('Pricebooks'));
});

