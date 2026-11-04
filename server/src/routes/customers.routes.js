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

// POST /api/customers/bulk-import - Bulk import customers from Excel / CSV with strict deduplication
router.post('/bulk-import', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'BILLING']), async (req, res) => {
  try {
    const { items, overwriteExisting = false } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Valid items array is required for bulk import.' });
    }

    const defaultPb = await prisma.pricebook.findFirst({ where: { isDefault: true } });
    const designerPb = await prisma.pricebook.findUnique({ where: { code: 'DESIGNER' } });

    // Fetch existing customer directory for instant in-memory deduplication check
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

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    const seenInCurrentBatch = new Set();

    for (const item of items) {
      if (!item.name || !item.name.trim()) {
        skipped++;
        continue;
      }

      const cleanName = item.name.trim();
      const nameKey = cleanName.toLowerCase();
      let cleanMobile = (item.mobile && item.mobile.toString().trim()) ? item.mobile.toString().replace(/\.0$/, '').trim() : '-';
      if (!cleanMobile || cleanMobile === '0' || cleanMobile.toLowerCase() === 'nan') {
        cleanMobile = '-';
      }

      const cleanGstin = item.gstin && item.gstin.toString().trim() ? item.gstin.toString().trim().toUpperCase() : null;
      const cleanPan = item.panNo && item.panNo.toString().trim() ? item.panNo.toString().trim().toUpperCase() : (cleanGstin && cleanGstin.length === 15 ? cleanGstin.substring(2, 12) : null);
      const cleanMsme = item.msmeNo && item.msmeNo.toString().trim() ? item.msmeNo.toString().trim() : null;
      const cleanGstDate = item.gstDate && item.gstDate.toString().trim() ? item.gstDate.toString().trim() : null;
      const cleanPincode = item.pincode && item.pincode.toString().trim() ? item.pincode.toString().replace(/\.0$/, '').trim() : null;
      const cleanState = item.state && item.state.toString().trim() ? item.state.toString().trim() : 'Gujarat';
      let cleanStateCode = item.stateCode && item.stateCode.toString().trim() ? item.stateCode.toString().replace(/\.0$/, '').trim() : '24';
      if (cleanStateCode.length === 1) cleanStateCode = '0' + cleanStateCode;

      let cleanAddress = item.billingAddress || item.address || null;
      if (cleanPincode && cleanAddress && !cleanAddress.includes(cleanPincode)) {
        cleanAddress = `${cleanAddress}, ${cleanPincode}`;
      }

      const cleanType = item.customerType || (cleanGstin ? 'CORPORATE' : 'RETAIL');
      const openBal = parseFloat(item.openingBalance || 0) || 0;

      // 1. Strict In-Batch Deduplication: prevent duplicate rows inside the same Excel file
      if (
        seenInCurrentBatch.has(nameKey) ||
        (cleanMobile !== '-' && seenInCurrentBatch.has(`m:${cleanMobile}`)) ||
        (cleanGstin && seenInCurrentBatch.has(`g:${cleanGstin}`))
      ) {
        skipped++;
        continue;
      }
      seenInCurrentBatch.add(nameKey);
      if (cleanMobile !== '-') seenInCurrentBatch.add(`m:${cleanMobile}`);
      if (cleanGstin) seenInCurrentBatch.add(`g:${cleanGstin}`);

      let assignedPbId = item.pricebookId;
      if (!assignedPbId) {
        if (cleanType === 'INTERIOR_DESIGNER' && designerPb) assignedPbId = designerPb.id;
        else if (defaultPb) assignedPbId = defaultPb.id;
      }

      // 2. Strict Database Deduplication: Match existing by Name, Mobile, GSTIN, or PAN
      const existing =
        existingByName.get(nameKey) ||
        (cleanMobile !== '-' ? existingByMobile.get(cleanMobile) : null) ||
        (cleanGstin ? existingByGst.get(cleanGstin) : null) ||
        (cleanPan ? existingByPan.get(cleanPan) : null);

      if (existing) {
        if (overwriteExisting) {
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
          updated++;
        } else {
          // Strictly skip: No duplicate row will be added
          skipped++;
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

        // Register new customer in in-memory maps to prevent duplicates within this batch
        existingByName.set(nameKey, newCust);
        if (cleanMobile !== '-') existingByMobile.set(cleanMobile, newCust);
        if (cleanGstin) existingByGst.set(cleanGstin, newCust);
        if (cleanPan) existingByPan.set(cleanPan, newCust);

        imported++;
      }
    }

    res.json({
      success: true,
      message: `Import complete: ${imported} imported, ${updated} updated, ${skipped} duplicates prevented.`,
      imported,
      updated,
      skipped,
      total: items.length,
    });
  } catch (err) {
    console.error('Customer bulk-import error:', err);
    res.status(500).json({ error: 'Failed to bulk-import customers: ' + err.message });
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

