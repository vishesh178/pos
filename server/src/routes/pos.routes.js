const express = require('express');
const prisma = require('../prisma');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const { calculateInvoiceTotals, getZohoStateCode } = require('../utils/gst');

const router = express.Router();

function sanitizePosProducts(prods, user) {
  if (user && user.role === 'ADMIN') return prods;
  return prods.map((p) => {
    const clean = { ...p };
    delete clean.purchasePrice;
    return clean;
  });
}

// GET /api/pos/search - Fast product search by barcode, SKU, or name
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      // Return top 20 active products for quick picking
      const quickProducts = await prisma.product.findMany({
        where: { status: 'ACTIVE' },
        include: { category: { select: { name: true } } },
        take: 20,
        orderBy: { name: 'asc' },
      });
      return res.json(sanitizePosProducts(quickProducts, req.user));
    }

    const query = q.trim();

    // 1. Check exact barcode match first (standard scanner behavior)
    const exactBarcode = await prisma.product.findFirst({
      where: {
        barcode: query,
        status: 'ACTIVE',
      },
      include: { category: { select: { name: true } } },
    });

    if (exactBarcode) {
      return res.json(sanitizePosProducts([exactBarcode], req.user));
    }

    // 2. Fuzzy search on title, SKU, or HSN code
    const matches = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { sku: { contains: query } },
          { name: { contains: query } },
          { hsnCode: { contains: query } },
          { barcode: { contains: query } },
        ],
      },
      include: { category: { select: { name: true } } },
      take: 15,
      orderBy: { name: 'asc' },
    });

    res.json(sanitizePosProducts(matches, req.user));
  } catch (err) {
    console.error('POS search error:', err);
    res.status(500).json({ error: 'Search failed.' });
  }
});

// POST /api/pos/calculate - Preview tax and discount calculation
router.post('/calculate', async (req, res) => {
  try {
    const { items, customerStateCode, invoiceDiscount } = req.body;
    const profile = await prisma.businessProfile.findFirst();
    const businessStateCode = profile ? profile.stateCode : '24';

    const calculation = calculateInvoiceTotals(items, {
      businessStateCode,
      customerStateCode: customerStateCode || businessStateCode,
      invoiceDiscount: invoiceDiscount || 0,
    });

    res.json(calculation);
  } catch (err) {
    console.error('Tax calculate error:', err);
    res.status(500).json({ error: 'Failed to calculate invoice totals.' });
  }
});

// POST /api/pos/checkout - Atomic POS Checkout with Transactional Outbox
router.post('/checkout', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'BILLING']), async (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerMobile,
      customerGstin,
      customerState,
      customerStateCode,
      items, // array of { productId, productName, sku, hsnCode, quantity, unitPrice, mrp, discountAmount, gstRate, isTaxInclusive }
      paymentMethod, // 'CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'SPLIT'
      paidAmount,
      invoiceDiscount,
      pricebookId,
      pricebookName,
      notes,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invoice must contain at least one item.' });
    }

    const business = await prisma.businessProfile.findFirst();
    const businessStateCode = business ? business.stateCode : '24';
    const cStateCode = customerStateCode || businessStateCode;

    // Run GST calculations
    const calc = calculateInvoiceTotals(items, {
      businessStateCode,
      customerStateCode: cStateCode,
      invoiceDiscount: invoiceDiscount || 0,
    });

    const isInterState = businessStateCode !== cStateCode;
    const finalPaid = paidAmount !== undefined ? parseFloat(paidAmount) : calc.grandTotal;
    const balanceAmount = Math.max(0, calc.grandTotal - finalPaid);
    const paymentStatus = balanceAmount === 0 ? 'PAID' : finalPaid > 0 ? 'PARTIAL' : 'UNPAID';

    // Execute atomic checkout in a single Prisma transaction
    const invoice = await prisma.$transaction(async (tx) => {
      // 1. Generate unique invoice number
      const prefix = business ? business.invoicePrefix : 'CA-';
      const nextNum = business ? business.invoiceNextNumber : 1001;
      const invoiceNumber = `${prefix}${nextNum}`;

      // Increment sequence
      if (business) {
        await tx.businessProfile.update({
          where: { id: business.id },
          data: { invoiceNextNumber: nextNum + 1 },
        });
      }

      // 2. Resolve or create customer
      let resolvedCustomerId = customerId || null;
      const finalCustomerName = customerName && customerName.trim() ? customerName.trim() : 'Walk-in Retail Customer';

      if (!resolvedCustomerId && customerMobile && customerMobile.trim()) {
        const existingCust = await tx.customer.findFirst({
          where: { mobile: customerMobile.trim() },
        });
        if (existingCust) {
          resolvedCustomerId = existingCust.id;
        } else {
          const newCust = await tx.customer.create({
            data: {
              name: finalCustomerName,
              mobile: customerMobile.trim(),
              gstin: customerGstin ? customerGstin.trim() : null,
              state: customerState || (business ? business.state : 'Gujarat'),
              stateCode: cStateCode,
            },
          });
          resolvedCustomerId = newCust.id;
        }
      }

      // 3. Create Invoice record
      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: resolvedCustomerId,
          customerName: finalCustomerName,
          customerMobile: customerMobile ? customerMobile.trim() : null,
          customerGstin: customerGstin ? customerGstin.trim() : null,
          placeOfSupply: `${cStateCode}-${customerState || 'Gujarat'}`,
          isInterState,
          pricebookId: pricebookId || null,
          pricebookName: pricebookName || null,
          subtotal: calc.subtotal,
          discountTotal: calc.discountTotal,
          taxTotal: calc.taxTotal,
          cgstTotal: calc.cgstTotal,
          sgstTotal: calc.sgstTotal,
          igstTotal: calc.igstTotal,
          roundOff: calc.roundOff,
          grandTotal: calc.grandTotal,
          paidAmount: finalPaid,
          balanceAmount,
          paymentStatus,
          paymentMethod: paymentMethod || 'CASH',
          notes: notes ? notes.trim() : null,
          status: 'COMPLETED',
          zohoSyncStatus: 'PENDING',
        },
      });

      // 4. Create InvoiceItems & deduct stock
      for (const item of calc.items) {
        await tx.invoiceItem.create({
          data: {
            invoiceId: newInvoice.id,
            productId: item.productId || null,
            productName: item.name || item.productName,
            sku: item.sku,
            hsnCode: item.hsnCode || '9701',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            mrp: item.mrp || item.unitPrice,
            discountAmount: item.discountAmount,
            taxRate: item.gstRate,
            taxableAmount: item.taxableAmount,
            cgstAmount: item.cgstAmount,
            sgstAmount: item.sgstAmount,
            igstAmount: item.igstAmount,
            totalAmount: item.totalAmount,
          },
        });

        // Deduct inventory and log stock movement if product exists
        if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product) {
            const newStock = product.currentStock - item.quantity;
            await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: newStock },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: 'SALE',
                quantity: -item.quantity,
                unitCost: product.purchasePrice,
                balanceAfter: newStock,
                referenceType: 'INVOICE',
                referenceId: newInvoice.invoiceNumber,
                notes: `Sold via POS Invoice ${newInvoice.invoiceNumber}`,
                createdBy: req.user.name,
              },
            });
          }
        }
      }

      // 5. Record Payment
      if (finalPaid > 0) {
        await tx.payment.create({
          data: {
            customerId: resolvedCustomerId,
            invoiceId: newInvoice.id,
            type: 'RECEIPT',
            paymentMethod: paymentMethod || 'CASH',
            amount: finalPaid,
            notes: `POS billing receipt for invoice ${invoiceNumber}`,
          },
        });
      }

      // 5b. Update Customer outstanding balance if balance is due
      if (resolvedCustomerId && balanceAmount > 0) {
        await tx.customer.update({
          where: { id: resolvedCustomerId },
          data: {
            currentBalance: { increment: balanceAmount },
          },
        });
      }

      // 6. Enqueue Zoho Books SyncJob (Transactional Outbox Pattern)
      await tx.syncJob.create({
        data: {
          entityType: 'INVOICE',
          localRecordId: newInvoice.id,
          operation: 'CREATE',
          payload: JSON.stringify({
            invoice_number: newInvoice.invoiceNumber,
            date: new Date().toISOString().split('T')[0],
            customer_name: newInvoice.customerName,
            customer_phone: newInvoice.customerMobile,
            customer_gstin: newInvoice.customerGstin,
            place_of_supply: getZohoStateCode(newInvoice.placeOfSupply),
            total: newInvoice.grandTotal,
            line_items: calc.items.map((it) => ({
              product_id: it.productId,
              name: it.productName || it.name,
              sku: it.sku,
              rate: it.unitPrice,
              quantity: it.quantity,
              tax_percentage: it.gstRate,
              hsn_or_sac: it.hsnCode,
            })),
            paid_amount: finalPaid,
            payment_mode: paymentMethod || 'CASH',
          }),
          status: 'PENDING',
        },
      });

      return newInvoice;
    });

    // Fetch complete invoice with items for instant receipt rendering
    const fullInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        items: true,
        payments: true,
      },
    });

    req.logAudit('CREATE_INVOICE', 'INVOICE', invoice.id, {
      invoiceNumber: invoice.invoiceNumber,
      grandTotal: invoice.grandTotal,
      itemsCount: items.length,
    });

    res.status(201).json({
      success: true,
      invoice: fullInvoice,
      businessProfile: business,
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Checkout transaction failed: ' + err.message });
  }
});

// GET /api/pos/invoices - Recent invoices
router.get('/invoices', async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    const invoices = await prisma.invoice.findMany({
      include: {
        items: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
    });

    res.json(invoices);
  } catch (err) {
    console.error('Fetch invoices error:', err);
    res.status(500).json({ error: 'Failed to retrieve invoices.' });
  }
});

// GET /api/pos/invoices/:id - Single invoice with full details
router.get('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ id }, { invoiceNumber: id }],
      },
      include: {
        items: true,
        payments: true,
        customer: true,
        salesReturns: { include: { items: true } },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const business = await prisma.businessProfile.findFirst();

    res.json({ invoice, businessProfile: business });
  } catch (err) {
    console.error('Fetch invoice details error:', err);
    res.status(500).json({ error: 'Failed to retrieve invoice.' });
  }
});

// POST /api/pos/invoices/:id/payment - Record follow-up payment on partial/unpaid invoice
router.post('/invoices/:id/payment', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'BILLING']), async (req, res) => {
  try {
    const { amount, paymentMethod = 'CASH', notes } = req.body;
    const payAmt = parseFloat(amount);
    if (!payAmt || payAmt <= 0) {
      return res.status(400).json({ error: 'Valid payment amount greater than zero is required.' });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { OR: [{ id: req.params.id }, { invoiceNumber: req.params.id }] },
      include: { customer: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    if (invoice.balanceAmount <= 0 || invoice.paymentStatus === 'PAID') {
      return res.status(400).json({ error: 'This invoice is already fully paid.' });
    }

    if (payAmt > invoice.balanceAmount) {
      return res.status(400).json({
        error: `Payment amount (₹${payAmt}) cannot exceed balance due (₹${invoice.balanceAmount}).`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const newPaid = invoice.paidAmount + payAmt;
      const newBalance = Math.max(0, invoice.balanceAmount - payAmt);
      const newStatus = newBalance === 0 ? 'PAID' : 'PARTIAL';

      // 1. Record Payment receipt
      const payment = await tx.payment.create({
        data: {
          customerId: invoice.customerId || null,
          invoiceId: invoice.id,
          type: 'RECEIPT',
          paymentMethod,
          amount: payAmt,
          notes: notes || `Follow-up settlement for invoice ${invoice.invoiceNumber}`,
        },
      });

      // 2. Update Invoice
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          paymentStatus: newStatus,
        },
        include: { payments: true, customer: true, items: true },
      });

      // 3. Decrement customer outstanding balance
      if (invoice.customerId) {
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: {
            currentBalance: { decrement: payAmt },
          },
        });
      }

      // 4. Enqueue Zoho Books Customer Payment sync
      const zohoPaymentPayload = {
        customer_id: invoice.customer?.zohoContactId || undefined,
        customer_name: invoice.customerName,
        customer_phone: invoice.customerMobile,
        amount: payAmt,
        payment_mode: paymentMethod,
        date: new Date().toISOString().split('T')[0],
        reference_number: payment.referenceNumber || undefined,
        notes: notes || `Settlement for invoice ${invoice.invoiceNumber}`,
        invoices: invoice.zohoInvoiceId
          ? [{ invoice_id: invoice.zohoInvoiceId, amount_applied: payAmt }]
          : undefined,
      };

      await tx.syncJob.create({
        data: {
          entityType: 'CUSTOMER_PAYMENT',
          localRecordId: payment.id,
          operation: 'CREATE',
          payload: JSON.stringify(zohoPaymentPayload),
          status: 'PENDING',
        },
      });

      return { payment, updatedInvoice };
    });

    const zohoSync = require('../services/zohoSyncService');
    zohoSync.runSyncPass().catch(console.error);

    if (req.logAudit) {
      req.logAudit('RECORD_INVOICE_PAYMENT', 'INVOICE', invoice.id, {
        amount: payAmt,
        paymentMethod,
        balanceRemaining: result.updatedInvoice.balanceAmount,
      });
    }

    res.json({
      success: true,
      message: `Payment of ₹${payAmt} recorded successfully. Balance remaining: ₹${result.updatedInvoice.balanceAmount}`,
      invoice: result.updatedInvoice,
      payment: result.payment,
    });
  } catch (err) {
    console.error('Record invoice payment error:', err);
    res.status(500).json({ error: 'Failed to record payment: ' + err.message });
  }
});

// POST /api/pos/returns - Process Sales Return & Refund
router.post('/returns', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'BILLING']), async (req, res) => {
  try {
    const { invoiceId, reason, refundMethod, items } = req.body;
    // items: array of { productId, quantity, refundAmount, condition: 'RESTOCKABLE' | 'DAMAGED' }

    if (!invoiceId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invoice ID and return items are required.' });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { OR: [{ id: invoiceId }, { invoiceNumber: invoiceId }] },
      include: { items: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Referenced invoice not found.' });
    }

    const totalRefund = items.reduce((sum, it) => sum + (parseFloat(it.refundAmount) || 0), 0);
    const returnNumber = `CR-${Date.now().toString().slice(-6)}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create SalesReturn record
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNumber,
          invoiceId: invoice.id,
          reason: reason || 'Customer return',
          totalRefundAmount: totalRefund,
          refundMethod: refundMethod || 'CASH',
          status: 'COMPLETED',
        },
      });

      // 2. Process returned items
      for (const item of items) {
        await tx.salesReturnItem.create({
          data: {
            salesReturnId: salesReturn.id,
            productId: item.productId,
            quantity: item.quantity,
            refundAmount: parseFloat(item.refundAmount) || 0,
            condition: item.condition || 'RESTOCKABLE',
          },
        });

        // If restockable, restore stock
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (prod) {
          if (item.condition === 'RESTOCKABLE') {
            const restoredStock = prod.currentStock + item.quantity;
            await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: restoredStock },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: 'RETURN_INWARD',
                quantity: item.quantity,
                unitCost: prod.purchasePrice,
                balanceAfter: restoredStock,
                referenceType: 'RETURN',
                referenceId: returnNumber,
                notes: `Restocked from customer return ${returnNumber} (Invoice ${invoice.invoiceNumber})`,
                createdBy: req.user.name,
              },
            });
          } else {
            // Damaged goods: log damaged stock movement
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: 'DAMAGE_OUTWARD',
                quantity: -item.quantity,
                unitCost: prod.purchasePrice,
                balanceAfter: prod.currentStock,
                referenceType: 'RETURN',
                referenceId: returnNumber,
                notes: `Damaged return not restocked (Credit ${returnNumber})`,
                createdBy: req.user.name,
              },
            });
          }
        }
      }

      // 3. Record Refund Payment
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          type: 'REFUND',
          paymentMethod: refundMethod || 'CASH',
          amount: -totalRefund,
          notes: `Refund issued for sales return ${returnNumber}`,
        },
      });

      // 4. Enqueue Zoho Credit Note SyncJob
      await tx.syncJob.create({
        data: {
          entityType: 'CREDIT_NOTE',
          localRecordId: salesReturn.id,
          operation: 'CREATE',
          payload: JSON.stringify({
            credit_note_number: returnNumber,
            invoice_number: invoice.invoiceNumber,
            customer_name: invoice.customerName,
            total: totalRefund,
            refund_mode: refundMethod || 'CASH',
          }),
          status: 'PENDING',
        },
      });

      return salesReturn;
    });

    req.logAudit('CREATE_SALES_RETURN', 'SALES_RETURN', result.id, {
      returnNumber,
      invoiceNumber: invoice.invoiceNumber,
      totalRefund,
    });

    res.status(201).json({
      success: true,
      salesReturn: result,
      message: `Return ${returnNumber} processed successfully.`,
    });
  } catch (err) {
    console.error('Sales return error:', err);
    res.status(500).json({ error: 'Failed to process return: ' + err.message });
  }
});

module.exports = router;

