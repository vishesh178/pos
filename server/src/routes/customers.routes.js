const express = require('express');
const prisma = require('../prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/customers - List customers with search & type filter
router.get('/', async (req, res) => {
  try {
    const { search, customerType } = req.query;
    const where = {};

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { mobile: { contains: q } },
        { email: { contains: q } },
        { gstin: { contains: q } },
        { panNo: { contains: q } },
        { billingAddress: { contains: q } },
      ];
    }

    if (customerType && customerType !== 'all') {
      where.customerType = customerType;
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        pricebook: true,
        _count: { select: { invoices: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(customers);
  } catch (err) {
    console.error('Fetch customers error:', err);
    res.status(500).json({ error: 'Failed to retrieve customers.' });
  }
});

// GET /api/customers/:id - Single customer with invoice ledger
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        pricebook: true,
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    res.json(customer);
  } catch (err) {
    console.error('Fetch customer details error:', err);
    res.status(500).json({ error: 'Failed to retrieve customer.' });
  }
});

// GET /api/customers/:id/ledger - Full Credit Ledger & Statement of Account
router.get('/:id/ledger', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const [invoices, payments, returns, business] = await Promise.all([
      prisma.invoice.findMany({
        where: { customerId: id },
        include: { items: { select: { productName: true, quantity: true, unitPrice: true, totalAmount: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.payment.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.salesReturn.findMany({
        where: { invoice: { customerId: id } },
        include: { invoice: { select: { invoiceNumber: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.businessProfile.findFirst(),
    ]);

    // Build chronological transaction timeline
    const rawEvents = [];

    // 1. Opening balance if non-zero
    if (customer.openingBalance && customer.openingBalance !== 0) {
      rawEvents.push({
        id: `open-${customer.id}`,
        date: customer.createdAt,
        type: 'OPENING_BALANCE',
        reference: 'OPEN-BAL',
        description: 'Opening Balance Brought Forward',
        debit: customer.openingBalance > 0 ? customer.openingBalance : 0,
        credit: customer.openingBalance < 0 ? Math.abs(customer.openingBalance) : 0,
      });
    }

    // 2. Invoices (Debit)
    for (const inv of invoices) {
      rawEvents.push({
        id: `inv-${inv.id}`,
        date: inv.createdAt,
        type: 'INVOICE',
        reference: inv.invoiceNumber,
        description: `Tax Invoice (${inv.items.length} items)`,
        debit: inv.grandTotal,
        credit: 0,
        paymentStatus: inv.paymentStatus,
        paymentMethod: inv.paymentMethod,
        balanceAmount: inv.balanceAmount,
        invoiceId: inv.id,
        zohoInvoiceId: inv.zohoInvoiceId,
        zohoSyncStatus: inv.zohoSyncStatus,
      });
    }

    // 3. Payments (Credit)
    for (const p of payments) {
      rawEvents.push({
        id: `pay-${p.id}`,
        date: p.createdAt,
        type: 'PAYMENT',
        reference: p.referenceNumber || `RCPT-${p.id.slice(-6).toUpperCase()}`,
        description: `Payment Received via ${p.paymentMethod}${p.notes ? ` (${p.notes})` : ''}`,
        debit: 0,
        credit: p.amount,
        paymentMethod: p.paymentMethod,
        zohoPaymentId: p.zohoPaymentId,
        zohoSyncStatus: p.zohoSyncStatus,
      });
    }

    // 4. Returns (Credit)
    for (const r of returns) {
      rawEvents.push({
        id: `ret-${r.id}`,
        date: r.createdAt,
        type: 'RETURN',
        reference: r.returnNumber,
        description: `Sales Return against ${r.invoice?.invoiceNumber || 'bill'}${r.reason ? ` (${r.reason})` : ''}`,
        debit: 0,
        credit: r.totalRefundAmount,
      });
    }

    // Sort chronologically ascending
    rawEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    let running = 0;
    const transactions = rawEvents.map((ev) => {
      running = running + ev.debit - ev.credit;
      return {
        ...ev,
        runningBalance: Math.round(running * 100) / 100,
      };
    });

    const totalDebit = invoices.reduce((s, x) => s + x.grandTotal, 0) + (customer.openingBalance > 0 ? customer.openingBalance : 0);
    const totalCredit = payments.reduce((s, x) => s + x.amount, 0) + returns.reduce((s, x) => s + x.totalRefundAmount, 0) + (customer.openingBalance < 0 ? Math.abs(customer.openingBalance) : 0);
    const netBalanceDue = Math.round((totalDebit - totalCredit) * 100) / 100;

    // Filter unpaid invoices for quick settlement
    const unpaidInvoices = invoices.filter((inv) => inv.balanceAmount > 0);

    // No external Zoho contact fetch in standalone mode
    const zohoContact = null;

    res.json({
      customer,
      business,
      zohoContact,
      summary: {
        openingBalance: customer.openingBalance || 0,
        totalDebit,
        totalCredit,
        netBalanceDue,
        invoicesCount: invoices.length,
        unpaidInvoicesCount: unpaidInvoices.length,
        zohoOutstanding: zohoContact?.outstanding_receivable_amount !== undefined
          ? parseFloat(zohoContact.outstanding_receivable_amount)
          : null,
      },
      unpaidInvoices,
      transactions,
    });
  } catch (err) {
    console.error('Customer ledger error:', err);
    res.status(500).json({ error: 'Failed to retrieve customer ledger: ' + err.message });
  }
});

// POST /api/customers/:id/payments - Record payment against customer credit ledger
router.post('/:id/payments', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'BILLING']), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod = 'CASH', referenceNumber, notes, autoApplyToInvoices = true } = req.body;

    const payAmt = parseFloat(amount);
    if (!payAmt || payAmt <= 0) {
      return res.status(400).json({ error: 'Valid payment amount greater than zero is required.' });
    }

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payment record linked to customer
      const payment = await tx.payment.create({
        data: {
          customerId: customer.id,
          type: 'RECEIPT',
          paymentMethod,
          amount: payAmt,
          referenceNumber: referenceNumber ? referenceNumber.trim() : null,
          notes: notes ? notes.trim() : `Customer Khata Settlement via ${paymentMethod}`,
        },
      });

      // 2. Decrement customer outstanding balance
      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: {
          currentBalance: { decrement: payAmt },
        },
      });

      // 3. If autoApplyToInvoices, distribute across unpaid/partial invoices (FIFO)
      if (autoApplyToInvoices) {
        const unpaidInvoices = await tx.invoice.findMany({
          where: { customerId: customer.id, balanceAmount: { gt: 0 } },
          orderBy: { createdAt: 'asc' },
        });

        const appliedZohoInvoices = [];
        let remaining = payAmt;
        for (const inv of unpaidInvoices) {
          if (remaining <= 0) break;
          const toPay = Math.min(remaining, inv.balanceAmount);
          const newBal = inv.balanceAmount - toPay;
          const newPaid = inv.paidAmount + toPay;
          const newStatus = newBal === 0 ? 'PAID' : 'PARTIAL';

          await tx.invoice.update({
            where: { id: inv.id },
            data: {
              paidAmount: newPaid,
              balanceAmount: newBal,
              paymentStatus: newStatus,
            },
          });

          remaining -= toPay;
        }
      }

      return { payment, updatedCustomer };
    });

    if (req.logAudit) {
      req.logAudit('RECORD_CUSTOMER_PAYMENT', 'CUSTOMER', customer.id, {
        amount: payAmt,
        paymentMethod,
        newBalance: result.updatedCustomer.currentBalance,
      });
    }

    res.json({
      success: true,
      message: `Payment of ₹${payAmt} recorded successfully.`,
      payment: result.payment,
      customer: result.updatedCustomer,
    });
  } catch (err) {
    console.error('Record customer payment error:', err);
    res.status(500).json({ error: 'Failed to record customer payment: ' + err.message });
  }
});

// POST /api/customers/bulk-import - Smart Multi-Entity Account & Party Importer with Section Routing
router.post('/bulk-import', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'BILLING']), async (req, res) => {
  try {
    const { items, overwriteExisting = false, cleanupMisrouted = true } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Valid items array is required for bulk import.' });
    }

    const defaultPb = await prisma.pricebook.findFirst({ where: { isDefault: true } });
    const designerPb = await prisma.pricebook.findUnique({ where: { code: 'DESIGNER' } });
    const wholesalePb = await prisma.pricebook.findUnique({ where: { code: 'WHOLESALE' } });

    // Fetch existing customer directory for in-memory deduplication & misroute cleanup
    const existingCustomers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        mobile: true,
        gstin: true,
        panNo: true,
        billingAddress: true,
        pincode: true,
        state: true,
        stateCode: true,
        customerType: true,
        pricebookId: true,
        gstDate: true,
        msmeNo: true,
      },
    });

    const existingByName = new Map();
    const existingByMobile = new Map();
    const existingByGst = new Map();
    const existingByPan = new Map();

    for (const c of existingCustomers) {
      if (c.name) existingByName.set(c.name.trim().toLowerCase(), c);
      if (c.mobile && c.mobile !== '-') existingByMobile.set(c.mobile.trim(), c);
      if (c.gstin) existingByGst.set(c.gstin.trim().toUpperCase(), c);
      if (c.panNo) existingByPan.set(c.panNo.trim().toUpperCase(), c);
    }

    // Fetch existing supplier directory for in-memory deduplication
    const existingSuppliers = await prisma.supplier.findMany({
      select: {
        id: true,
        name: true,
        mobile: true,
        gstin: true,
        address: true,
        state: true,
        stateCode: true,
      },
    });

    const existingSuppliersByName = new Map();
    const existingSuppliersByMobile = new Map();
    const existingSuppliersByGst = new Map();

    for (const s of existingSuppliers) {
      if (s.name) existingSuppliersByName.set(s.name.trim().toLowerCase(), s);
      if (s.mobile && s.mobile !== '-') existingSuppliersByMobile.set(s.mobile.trim(), s);
      if (s.gstin) existingSuppliersByGst.set(s.gstin.trim().toUpperCase(), s);
    }

    // Fetch existing general accounts for in-memory deduplication
    const existingGenAccounts = await prisma.generalAccount.findMany({
      select: {
        id: true,
        name: true,
        accountGroup: true,
        accountType: true,
        address: true,
        state: true,
        stateCode: true,
        mobile: true,
        gstin: true,
        panNo: true,
      },
    });
    const existingGenAccountsByName = new Map();
    for (const g of existingGenAccounts) {
      if (g.name) existingGenAccountsByName.set(g.name.trim().toLowerCase(), g);
    }

    let importedCustomers = 0;
    let updatedCustomers = 0;
    let skippedCustomers = 0;

    let importedSuppliers = 0;
    let updatedSuppliers = 0;
    let skippedSuppliers = 0;

    let importedLedgers = 0;
    let updatedLedgers = 0;
    let categorizedLedgers = 0;
    let cleanedMisrouted = 0;

    const breakdown = {
      retailers: 0,
      wholesalers: 0,
      architects: 0,
      corporate: 0,
      suppliers: 0,
      generalLedgers: 0,
    };

    const seenInCurrentBatch = new Set();

    // Helper: auto-detect routing based on targetEntity, section name, or customerType
    function getEntityRouting(item) {
      if (item.targetEntity) {
        return {
          target: item.targetEntity,
          customerType: item.customerType || 'RETAIL',
        };
      }

      const sec = String(item.section || '').toLowerCase().trim();
      if (sec.includes('sundry creditor') || sec.includes('supplier') || sec.includes('vendor')) {
        return { target: 'SUPPLIER', customerType: null };
      }
      if (sec.includes('sundry debtor') || sec.includes('debtor')) {
        if (sec.includes('wholesal')) {
          return { target: 'CUSTOMER', customerType: 'WHOLESALE' };
        }
        if (sec.includes('architech') || sec.includes('architect') || sec.includes('designer')) {
          return { target: 'CUSTOMER', customerType: 'INTERIOR_DESIGNER' };
        }
        return { target: 'CUSTOMER', customerType: item.gstin ? 'CORPORATE' : 'RETAIL' };
      }
      if (
        sec.includes('capital') ||
        sec.includes('loan') ||
        sec.includes('bank') ||
        sec.includes('cash') ||
        sec.includes('expense') ||
        sec.includes('liability') ||
        sec.includes('asset') ||
        sec.includes('p&l') ||
        sec.includes('profit and loss') ||
        sec.includes('trading') ||
        sec.includes('salary') ||
        sec.includes('stock') ||
        sec.includes('sales')
      ) {
        return { target: 'ACCOUNTING_LEDGER', customerType: null };
      }

      return {
        target: 'CUSTOMER',
        customerType: item.customerType || (item.gstin ? 'CORPORATE' : 'RETAIL'),
      };
    }

    for (const item of items) {
      if (!item.name || !item.name.trim()) {
        continue;
      }

      const cleanName = item.name.trim();
      const nameKey = cleanName.toLowerCase();
      let cleanMobile =
        item.mobile && item.mobile.toString().trim()
          ? item.mobile.toString().replace(/\.0$/, '').trim()
          : '-';
      if (!cleanMobile || cleanMobile === '0' || cleanMobile.toLowerCase() === 'nan') {
        cleanMobile = '-';
      }

      const cleanGstin =
        item.gstin && item.gstin.toString().trim()
          ? item.gstin.toString().trim().toUpperCase()
          : null;
      const cleanPan =
        item.panNo && item.panNo.toString().trim()
          ? item.panNo.toString().trim().toUpperCase()
          : cleanGstin && cleanGstin.length === 15
          ? cleanGstin.substring(2, 12)
          : null;
      const cleanMsme =
        item.msmeNo && item.msmeNo.toString().trim() ? item.msmeNo.toString().trim() : null;
      const cleanGstDate =
        item.gstDate && item.gstDate.toString().trim() ? item.gstDate.toString().trim() : null;
      const cleanPincode =
        item.pincode && item.pincode.toString().trim()
          ? item.pincode.toString().replace(/\.0$/, '').trim()
          : null;
      const cleanState =
        item.state && item.state.toString().trim() ? item.state.toString().trim() : 'Gujarat';
      let cleanStateCode =
        item.stateCode && item.stateCode.toString().trim()
          ? item.stateCode.toString().replace(/\.0$/, '').trim()
          : '24';
      if (cleanStateCode.length === 1) cleanStateCode = '0' + cleanStateCode;

      let cleanAddress = item.billingAddress || item.address || null;
      if (cleanPincode && cleanAddress && !cleanAddress.includes(cleanPincode)) {
        cleanAddress = `${cleanAddress}, ${cleanPincode}`;
      }

      const openBal = parseFloat(item.openingBalance || 0) || 0;
      const routing = getEntityRouting(item);

      // ==========================================
      // ROUTING 1: GENERAL LEDGER ACCOUNTING ACCOUNTS
      // (Capital, Loans, Bank, Cash, Expenses, etc. - Saved to GeneralAccount table)
      // ==========================================
      if (routing.target === 'ACCOUNTING_LEDGER') {
        const ledgerBatchKey = `ledger:${nameKey}`;
        if (seenInCurrentBatch.has(ledgerBatchKey)) {
          continue;
        }
        seenInCurrentBatch.add(ledgerBatchKey);

        const secStr = String(item.section || 'General Ledger').trim();
        const secLower = secStr.toLowerCase();

        let accountGroup = 'General Ledger';
        let accountType = 'GENERAL';

        if (secLower.includes('bank')) {
          accountGroup = 'Bank & Cash Accounts';
          accountType = 'BANK';
        } else if (secLower.includes('cash')) {
          accountGroup = 'Bank & Cash Accounts';
          accountType = 'CASH';
        } else if (secLower.includes('loan')) {
          accountGroup = 'Loans & Borrowings';
          accountType = 'LOAN';
        } else if (secLower.includes('capital') || secLower.includes('reserve')) {
          accountGroup = 'Capital & Reserves';
          accountType = 'CAPITAL';
        } else if (
          secLower.includes('expense') ||
          secLower.includes('salary') ||
          secLower.includes('purchase stock')
        ) {
          accountGroup = 'Operating & P&L Expenses';
          accountType = 'EXPENSE';
        } else if (secLower.includes('income') || secLower.includes('sales')) {
          accountGroup = 'Revenue & Income';
          accountType = 'INCOME';
        } else if (secLower.includes('liability') || secLower.includes('liabilities')) {
          accountGroup = 'Liabilities';
          accountType = 'LIABILITY';
        } else {
          accountGroup = 'Current Assets & Stock';
          accountType = 'ASSET';
        }

        const existingGenAcc = existingGenAccountsByName.get(nameKey);
        if (existingGenAcc) {
          if (overwriteExisting) {
            await prisma.generalAccount.update({
              where: { id: existingGenAcc.id },
              data: {
                section: secStr,
                accountGroup,
                accountType,
                mobile: cleanMobile !== '-' ? cleanMobile : existingGenAcc.mobile,
                address: cleanAddress || existingGenAcc.address,
                state: cleanState || existingGenAcc.state,
                stateCode: cleanStateCode || existingGenAcc.stateCode,
                gstin: cleanGstin || existingGenAcc.gstin,
                panNo: cleanPan || existingGenAcc.panNo,
              },
            });
            updatedLedgers++;
          }
        } else {
          const newGenAcc = await prisma.generalAccount.create({
            data: {
              name: cleanName,
              section: secStr,
              accountGroup,
              accountType,
              openingBalance: openBal,
              currentBalance: openBal,
              mobile: cleanMobile !== '-' ? cleanMobile : null,
              address: cleanAddress,
              state: cleanState,
              stateCode: cleanStateCode,
              gstin: cleanGstin,
              panNo: cleanPan,
            },
          });
          existingGenAccountsByName.set(nameKey, newGenAcc);
          importedLedgers++;
        }

        categorizedLedgers++;
        breakdown.generalLedgers++;

        // If this ledger account was previously accidentally saved in Customer directory, clean it up!
        if (cleanupMisrouted) {
          const misroutedCust = existingByName.get(nameKey);
          if (misroutedCust) {
            try {
              const relCount = await prisma.customer.findUnique({
                where: { id: misroutedCust.id },
                select: {
                  _count: { select: { invoices: true, estimates: true, payments: true } },
                },
              });
              if (
                relCount &&
                relCount._count.invoices === 0 &&
                relCount._count.estimates === 0 &&
                relCount._count.payments === 0
              ) {
                await prisma.customer.delete({ where: { id: misroutedCust.id } });
                existingByName.delete(nameKey);
                cleanedMisrouted++;
              }
            } catch (ignoreErr) {
              // Ignore deletion error if constrained
            }
          }
        }
        continue;
      }

      // ==========================================
      // ROUTING 2: SUPPLIERS & VENDORS
      // (Sundry Creditors / Suppliers -> prisma.supplier)
      // ==========================================
      if (routing.target === 'SUPPLIER') {
        const supBatchKey = `sup:${nameKey}`;
        if (seenInCurrentBatch.has(supBatchKey)) {
          skippedSuppliers++;
          continue;
        }
        seenInCurrentBatch.add(supBatchKey);

        const existingSup =
          existingSuppliersByName.get(nameKey) ||
          (cleanMobile !== '-' ? existingSuppliersByMobile.get(cleanMobile) : null) ||
          (cleanGstin ? existingSuppliersByGst.get(cleanGstin) : null);

        if (existingSup) {
          if (overwriteExisting) {
            await prisma.supplier.update({
              where: { id: existingSup.id },
              data: {
                address: cleanAddress || existingSup.address,
                state: cleanState || existingSup.state,
                stateCode: cleanStateCode || existingSup.stateCode,
                gstin: cleanGstin || existingSup.gstin,
                mobile: cleanMobile !== '-' ? cleanMobile : existingSup.mobile,
              },
            });
            updatedSuppliers++;
          } else {
            skippedSuppliers++;
          }
        } else {
          const newSup = await prisma.supplier.create({
            data: {
              name: cleanName,
              contactPerson: item.contactPerson ? item.contactPerson.toString().trim() : null,
              mobile: cleanMobile,
              email: item.email ? item.email.toString().trim() : null,
              gstin: cleanGstin,
              address: cleanAddress,
              state: cleanState,
              stateCode: cleanStateCode,
              openingBalance: openBal,
              currentBalance: openBal,
              zohoSyncStatus: 'PENDING',
            },
          });

          existingSuppliersByName.set(nameKey, newSup);
          if (cleanMobile !== '-') existingSuppliersByMobile.set(cleanMobile, newSup);
          if (cleanGstin) existingSuppliersByGst.set(cleanGstin, newSup);
          importedSuppliers++;
        }

        breakdown.suppliers++;

        // If this supplier was previously accidentally saved in Customer directory, clean it up!
        if (cleanupMisrouted) {
          const misroutedCust = existingByName.get(nameKey);
          if (misroutedCust) {
            try {
              const relCount = await prisma.customer.findUnique({
                where: { id: misroutedCust.id },
                select: {
                  _count: { select: { invoices: true, estimates: true, payments: true } },
                },
              });
              if (
                relCount &&
                relCount._count.invoices === 0 &&
                relCount._count.estimates === 0 &&
                relCount._count.payments === 0
              ) {
                await prisma.customer.delete({ where: { id: misroutedCust.id } });
                existingByName.delete(nameKey);
                cleanedMisrouted++;
              }
            } catch (ignoreErr) {
              // Ignore deletion error if constrained
            }
          }
        }
        continue;
      }

      // ==========================================
      // ROUTING 3: CUSTOMERS
      // (Sundry Debtors -> prisma.customer with Tiered Pricebook)
      // ==========================================
      const cleanType = routing.customerType || 'RETAIL';
      const custBatchKey = `cust:${nameKey}`;

      if (
        seenInCurrentBatch.has(custBatchKey) ||
        (cleanMobile !== '-' && seenInCurrentBatch.has(`m:${cleanMobile}`)) ||
        (cleanGstin && seenInCurrentBatch.has(`g:${cleanGstin}`))
      ) {
        skippedCustomers++;
        continue;
      }
      seenInCurrentBatch.add(custBatchKey);
      if (cleanMobile !== '-') seenInCurrentBatch.add(`m:${cleanMobile}`);
      if (cleanGstin) seenInCurrentBatch.add(`g:${cleanGstin}`);

      // Map appropriate Pricebook based on customer tier
      let assignedPbId = item.pricebookId;
      if (!assignedPbId) {
        if (cleanType === 'WHOLESALE' && wholesalePb) assignedPbId = wholesalePb.id;
        else if (cleanType === 'INTERIOR_DESIGNER' && designerPb) assignedPbId = designerPb.id;
        else if (defaultPb) assignedPbId = defaultPb.id;
      }

      if (cleanType === 'WHOLESALE') breakdown.wholesalers++;
      else if (cleanType === 'INTERIOR_DESIGNER') breakdown.architects++;
      else if (cleanType === 'CORPORATE') breakdown.corporate++;
      else breakdown.retailers++;

      // Database Deduplication: Match existing by Name, Mobile, GSTIN, or PAN
      const existing =
        existingByName.get(nameKey) ||
        (cleanMobile !== '-' ? existingByMobile.get(cleanMobile) : null) ||
        (cleanGstin ? existingByGst.get(cleanGstin) : null) ||
        (cleanPan ? existingByPan.get(cleanPan) : null);

      if (existing) {
        // If overwrite is enabled, or if updating a generic customer to a specific WHOLESALE/DESIGNER tier
        if (overwriteExisting || (cleanType !== 'RETAIL' && existing.customerType === 'RETAIL')) {
          await prisma.customer.update({
            where: { id: existing.id },
            data: {
              billingAddress: cleanAddress || existing.billingAddress,
              pincode: cleanPincode || existing.pincode,
              gstin: cleanGstin || existing.gstin,
              gstDate: cleanGstDate || existing.gstDate,
              panNo: cleanPan || existing.panNo,
              msmeNo: cleanMsme || existing.msmeNo,
              state: cleanState || existing.state,
              stateCode: cleanStateCode || existing.stateCode,
              customerType: cleanType || existing.customerType,
              pricebookId: assignedPbId || existing.pricebookId,
            },
          });
          updatedCustomers++;
        } else {
          skippedCustomers++;
        }
      } else {
        const newCust = await prisma.customer.create({
          data: {
            name: cleanName,
            mobile: cleanMobile,
            email: item.email ? item.email.toString().trim() : null,
            billingAddress: cleanAddress,
            pincode: cleanPincode,
            gstin: cleanGstin,
            gstDate: cleanGstDate,
            panNo: cleanPan,
            msmeNo: cleanMsme,
            state: cleanState,
            stateCode: cleanStateCode,
            customerType: cleanType,
            pricebookId: assignedPbId,
            openingBalance: openBal,
            currentBalance: openBal,
            zohoSyncStatus: 'PENDING',
          },
        });

        existingByName.set(nameKey, newCust);
        if (cleanMobile !== '-') existingByMobile.set(cleanMobile, newCust);
        if (cleanGstin) existingByGst.set(cleanGstin, newCust);
        if (cleanPan) existingByPan.set(cleanPan, newCust);

        importedCustomers++;
      }
    }

    const totalLedgers = importedLedgers + updatedLedgers;
    const message = `Smart Account Routing Complete: ${importedCustomers + updatedCustomers} Customers organized (${breakdown.retailers} Retail, ${breakdown.wholesalers} Wholesale, ${breakdown.architects} Architects), ${importedSuppliers + updatedSuppliers} Suppliers in Supplier Directory, and ${totalLedgers} General Accounts stored in Chart of Accounts.${cleanedMisrouted > 0 ? ` (${cleanedMisrouted} previously misrouted entries cleaned)` : ''}`;

    res.json({
      success: true,
      message,
      importedCustomers,
      updatedCustomers,
      skippedCustomers,
      importedSuppliers,
      updatedSuppliers,
      skippedSuppliers,
      importedLedgers,
      updatedLedgers,
      categorizedLedgers: totalLedgers,
      cleanedMisrouted,
      breakdown,
      total: items.length,
    });
  } catch (err) {
    console.error('Customer bulk-import error:', err);
    res.status(500).json({ error: 'Failed to bulk-import accounts: ' + err.message });
  }
});

// POST /api/customers - Create customer & enqueue Zoho Contact Sync
router.post('/', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'BILLING']), async (req, res) => {
  try {
    const {
      name,
      mobile,
      email,
      billingAddress,
      shippingAddress,
      pincode,
      gstin,
      gstDate,
      panNo,
      msmeNo,
      state,
      stateCode,
      customerType,
      openingBalance,
      pricebookId,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer / Firm name is required.' });
    }

    // Check for duplicate customer before manual creation
    const cleanName = name.trim();
    const cleanMobile = (mobile && mobile.trim()) ? mobile.trim() : '-';
    const existing = await prisma.customer.findFirst({
      where: {
        OR: [
          { name: { equals: cleanName } },
          ...(cleanMobile && cleanMobile !== '-' ? [{ mobile: { equals: cleanMobile } }] : []),
          ...(gstin && gstin.trim() ? [{ gstin: { equals: gstin.trim().toUpperCase() } }] : []),
        ],
      },
    });

    if (existing) {
      return res.status(409).json({ error: `A customer with this name ("${existing.name}") or phone/GST already exists.` });
    }

    const openBal = openingBalance ? parseFloat(openingBalance) : 0.0;

    // Resolve default pricebook if not explicitly provided
    let assignedPricebookId = pricebookId;
    if (!assignedPricebookId) {
      if (customerType === 'INTERIOR_DESIGNER') {
        const designerPb = await prisma.pricebook.findUnique({ where: { code: 'DESIGNER' } });
        if (designerPb) assignedPricebookId = designerPb.id;
      } else {
        const defaultPb = await prisma.pricebook.findFirst({ where: { isDefault: true } });
        if (defaultPb) assignedPricebookId = defaultPb.id;
      }
    }

    const customer = await prisma.$transaction(async (tx) => {
      const newCust = await tx.customer.create({
        data: {
          name: cleanName,
          mobile: cleanMobile,
          email: email ? email.trim() : null,
          billingAddress: billingAddress ? billingAddress.trim() : null,
          shippingAddress: shippingAddress ? shippingAddress.trim() : null,
          pincode: pincode ? pincode.toString().trim() : null,
          gstin: gstin ? gstin.trim().toUpperCase() : null,
          gstDate: gstDate ? gstDate.trim() : null,
          panNo: panNo ? panNo.trim().toUpperCase() : null,
          msmeNo: msmeNo ? msmeNo.trim() : null,
          state: state || 'Gujarat',
          stateCode: stateCode || '24',
          customerType: customerType || 'RETAIL',
          pricebookId: assignedPricebookId,
          openingBalance: openBal,
          currentBalance: openBal,
          zohoSyncStatus: 'PENDING',
        },
        include: { pricebook: true },
      });

      return newCust;
    });

    req.logAudit('CREATE_CUSTOMER', 'CUSTOMER', customer.id, { name: customer.name, mobile: customer.mobile });
    res.status(201).json(customer);
  } catch (err) {
    console.error('Create customer error:', err);
    res.status(500).json({ error: 'Failed to create customer.' });
  }
});

// PUT /api/customers/:id - Update customer
router.put('/:id', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'BILLING']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      mobile,
      email,
      billingAddress,
      shippingAddress,
      pincode,
      gstin,
      gstDate,
      panNo,
      msmeNo,
      state,
      stateCode,
      customerType,
      pricebookId,
    } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      const cust = await tx.customer.update({
        where: { id },
        data: {
          name: name ? name.trim() : undefined,
          mobile: mobile ? mobile.trim() : undefined,
          email: email !== undefined ? (email ? email.trim() : null) : undefined,
          billingAddress: billingAddress !== undefined ? (billingAddress ? billingAddress.trim() : null) : undefined,
          shippingAddress: shippingAddress !== undefined ? (shippingAddress ? shippingAddress.trim() : null) : undefined,
          pincode: pincode !== undefined ? (pincode ? pincode.toString().trim() : null) : undefined,
          gstin: gstin !== undefined ? (gstin ? gstin.trim().toUpperCase() : null) : undefined,
          gstDate: gstDate !== undefined ? (gstDate ? gstDate.trim() : null) : undefined,
          panNo: panNo !== undefined ? (panNo ? panNo.trim().toUpperCase() : null) : undefined,
          msmeNo: msmeNo !== undefined ? (msmeNo ? msmeNo.trim() : null) : undefined,
          state: state !== undefined ? state : undefined,
          stateCode: stateCode !== undefined ? stateCode : undefined,
          customerType: customerType !== undefined ? customerType : undefined,
          pricebookId: pricebookId !== undefined ? pricebookId : undefined,
          zohoSyncStatus: 'PENDING',
        },
        include: { pricebook: true },
      });

      return cust;
    });

    req.logAudit('UPDATE_CUSTOMER', 'CUSTOMER', updated.id, { name: updated.name });
    res.json(updated);
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ error: 'Failed to update customer.' });
  }
});

module.exports = router;

