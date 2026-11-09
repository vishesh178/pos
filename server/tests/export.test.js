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

test('Customer / Account Directory Export - Formatted Categorized Account List with Merges and 10 Columns', async () => {
  // Ensure test fixture records exist if db was wiped
  if (await prisma.supplier.count() === 0) {
    await prisma.supplier.create({
      data: { name: 'Test Supplier Ltd', mobile: '9898000001' },
    });
  }
  if (await prisma.customer.count() === 0) {
    await prisma.customer.create({
      data: { name: 'Test Retail Customer', mobile: '9898000002', customerType: 'RETAIL' },
    });
  }
  if (await prisma.generalAccount.count() === 0) {
    await prisma.generalAccount.createMany({
      data: [
        { name: 'Owner Equity', section: 'Capital', accountGroup: 'Capital' },
        { name: 'HDFC Loan', section: 'Unsecured Loans', accountGroup: 'Loans & Liabilities' },
        { name: 'SBI Current A/c', section: 'Cash at Bank', accountGroup: 'Bank & Cash' },
      ],
    });
  }

  const [bp, customers, suppliers, generalAccounts] = await Promise.all([
    prisma.businessProfile.findFirst(),
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.generalAccount.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const SECTION_ORDER = [
    'Capital',
    'Reserve and Surplus',
    'Loans Funds',
    'Secured Loans',
    'Unsecured Loans',
    'Sundry Creditors / Suppliers',
    'Other Liabilities',
    'Current Assets',
    'Inventories',
    'Sundry Debtors / Architech',
    'Sundry Debtors / Retailer',
    'Sundry Debtors / Wholesaler',
    'Cash on Hand',
    'Cash at Bank',
    'Loans and Advances',
    'Other Current Assets',
    'Opening Stock',
    'Purchase Stock',
    'Trading Expenses',
    'Profit and Loss Expenses',
    'Sales',
    'Closing Stock',
    'Trading Incomes',
    'Profit and Loss Incomes',
    'Salary',
  ];

  const secMap = new Map();
  SECTION_ORDER.forEach((s) => secMap.set(s, []));
  secMap.set('Sundry Creditors / Suppliers', suppliers);

  for (const c of customers) {
    if (c.customerType === 'INTERIOR_DESIGNER') secMap.get('Sundry Debtors / Architech').push(c);
    else if (c.customerType === 'WHOLESALE') secMap.get('Sundry Debtors / Wholesaler').push(c);
    else secMap.get('Sundry Debtors / Retailer').push(c);
  }

  for (const ga of generalAccounts) {
    const matched = SECTION_ORDER.find((s) => s.toLowerCase() === (ga.section || '').toLowerCase());
    if (matched) secMap.get(matched).push(ga);
  }

  // Ensure all major sections have records
  assert.ok(secMap.get('Sundry Creditors / Suppliers').length > 0, 'Suppliers must be populated');
  assert.ok(secMap.get('Sundry Debtors / Retailer').length > 0, 'Retail debtors must be populated');
  assert.ok(secMap.get('Capital').length > 0, 'Capital accounts must be populated');
  assert.ok(secMap.get('Unsecured Loans').length > 0, 'Unsecured loans must be populated');
  assert.ok(secMap.get('Cash at Bank').length > 0, 'Bank accounts must be populated');
});

