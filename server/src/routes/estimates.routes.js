const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { calculateInvoiceTotals, getZohoStateCode } = require('../utils/gst');
const { generateEstimatePdf } = require('../utils/estimatePdf');

// GET /api/estimates - List estimates with filter & search
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const where = {};

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { estimateNumber: { contains: q } },
        { customerName: { contains: q } },
        { customerMobile: { contains: q } },
      ];
    }

    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * take;

    const [estimates, total] = await Promise.all([
      prisma.estimate.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, imageUrl: true, currentStock: true },
              },
            },
          },
          customer: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.estimate.count({ where }),
    ]);

    res.json({
      estimates,
      total,
      page: parseInt(page, 10) || 1,
      limit: take,
    });
  } catch (err) {
    console.error('Failed to list estimates:', err);
    res.status(500).json({ error: 'Failed to retrieve estimates: ' + err.message });
  }
});

// GET /api/estimates/:id - Get single estimate with business profile
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const estimate = await prisma.estimate.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    const business = await prisma.businessProfile.findFirst();

    res.json({
      estimate,
      business,
    });
  } catch (err) {
    console.error('Failed to get estimate:', err);
    res.status(500).json({ error: 'Failed to retrieve estimate: ' + err.message });
  }
});

// POST /api/estimates - Create new quotation/estimate (does NOT deduct inventory)
router.post('/', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'BILLING']), async (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerMobile,
      customerGstin,
      customerState,
      customerStateCode,
      items,
      invoiceDiscount = 0,
      pricebookId,
      pricebookName,
      validityDays = 15,
      notes,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Estimate must contain at least one item.' });
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

    // Execute in transaction
    const estimate = await prisma.$transaction(async (tx) => {
      // 1. Generate unique estimate number
      const prefix = business ? (business.estimatePrefix || 'EST-') : 'EST-';
      const nextNum = business ? (business.estimateNextNumber || 1001) : 1001;
      const estimateNumber = `${prefix}${nextNum}`;

      // Increment sequence in business profile
      if (business) {
        await tx.businessProfile.update({
          where: { id: business.id },
          data: { estimateNextNumber: nextNum + 1 },
        });
      }

      // 2. Resolve or create customer if phone provided
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

      // 3. Create Estimate record
      const newEstimate = await tx.estimate.create({
        data: {
          estimateNumber,
          customerId: resolvedCustomerId,
          customerName: finalCustomerName,
          customerMobile: customerMobile ? customerMobile.trim() : null,
          customerGstin: customerGstin ? customerGstin.trim() : null,
          placeOfSupply: `${cStateCode}-${customerState || (business ? business.state : 'Gujarat')}`,
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
          validityDays: parseInt(validityDays, 10) || 15,
          notes: notes || null,
          status: 'PENDING',
          items: {
            create: calc.items.map((it) => ({
              productId: it.productId || null,
              productName: it.productName,
              sku: it.sku || 'CUSTOM',
              hsnCode: it.hsnCode || '9701',
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              mrp: it.mrp || it.unitPrice,
              discountAmount: it.discountAmount || 0,
              taxRate: it.gstRate,
              taxableAmount: it.taxableAmount,
              cgstAmount: it.cgstAmount,
              sgstAmount: it.sgstAmount,
              igstAmount: it.igstAmount,
              totalAmount: it.totalAmount,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          customer: true,
        },
      });

      return newEstimate;
    });

    if (req.logAudit) {
      req.logAudit({
        action: 'CREATE_ESTIMATE',
        entityType: 'ESTIMATE',
        entityId: estimate.id,
        details: `Created estimate ${estimate.estimateNumber} for ${estimate.customerName} (₹${estimate.grandTotal})`,
      });
    }

    res.status(201).json({
      message: 'Estimate created successfully',
      estimate,
    });
  } catch (err) {
    console.error('Estimate creation error:', err);
    res.status(500).json({ error: 'Failed to create estimate: ' + err.message });
  }
});

// PUT /api/estimates/:id/status - Update estimate status
router.put('/:id/status', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'BILLING']), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['PENDING', 'CONVERTED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid estimate status' });
    }

    const updated = await prisma.estimate.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json({ message: 'Estimate status updated', estimate: updated });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update status: ' + err.message });
  }
});

// POST /api/estimates/:id/convert - Convert Estimate into final GST Tax Invoice
router.post('/:id/convert', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'BILLING']), async (req, res) => {
  try {
    const { paymentMethod = 'CASH', paidAmount } = req.body;

    const estimate = await prisma.estimate.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    if (estimate.status === 'CONVERTED') {
      return res.status(400).json({
        error: `Estimate ${estimate.estimateNumber} has already been converted to invoice ${estimate.convertedInvoiceId}.`,
      });
    }

    const business = await prisma.businessProfile.findFirst();
    const finalPaid = paidAmount !== undefined ? parseFloat(paidAmount) : estimate.grandTotal;
    const balanceAmount = Math.max(0, estimate.grandTotal - finalPaid);
    const paymentStatus = balanceAmount === 0 ? 'PAID' : finalPaid > 0 ? 'PARTIAL' : 'UNPAID';

    // Atomic transaction: invoice creation, stock deduction, stock ledger, payment, status update, sync job
    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate unique invoice number
      const prefix = business ? business.invoicePrefix : 'CA-';
      const nextNum = business ? business.invoiceNextNumber : 1001;
      const invoiceNumber = `${prefix}${nextNum}`;

      if (business) {
        await tx.businessProfile.update({
          where: { id: business.id },
          data: { invoiceNextNumber: nextNum + 1 },
        });
      }

      // 2. Create Invoice
      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: estimate.customerId,
          customerName: estimate.customerName,
          customerMobile: estimate.customerMobile,
          customerGstin: estimate.customerGstin,
          placeOfSupply: estimate.placeOfSupply,
          isInterState: estimate.isInterState,
          pricebookId: estimate.pricebookId,
          pricebookName: estimate.pricebookName,
          subtotal: estimate.subtotal,
          discountTotal: estimate.discountTotal,
          taxTotal: estimate.taxTotal,
          cgstTotal: estimate.cgstTotal,
          sgstTotal: estimate.sgstTotal,
          igstTotal: estimate.igstTotal,
          roundOff: estimate.roundOff,
          grandTotal: estimate.grandTotal,
          paidAmount: finalPaid,
          balanceAmount,
          paymentStatus,
          paymentMethod,
          notes: `Converted from Estimate ${estimate.estimateNumber}${estimate.notes ? ` - ${estimate.notes}` : ''}`,
          status: 'COMPLETED',
          items: {
            create: estimate.items.map((it) => ({
              productId: it.productId,
              productName: it.productName,
              sku: it.sku,
              hsnCode: it.hsnCode,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              mrp: it.mrp,
              discountAmount: it.discountAmount,
              taxRate: it.taxRate,
              taxableAmount: it.taxableAmount,
              cgstAmount: it.cgstAmount,
              sgstAmount: it.sgstAmount,
              igstAmount: it.igstAmount,
              totalAmount: it.totalAmount,
            })),
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });

      // 3. Atomically decrement stock & record StockMovement for each product
      for (const item of estimate.items) {
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
                referenceId: newInvoice.id,
                notes: `Sale via converted estimate ${estimate.estimateNumber}`,
                createdBy: req.user?.name || 'System',
              },
            });
          }
        }
      }

      // 4. Record Payment if paid
      if (finalPaid > 0) {
        await tx.payment.create({
          data: {
            invoiceId: newInvoice.id,
            type: 'RECEIPT',
            paymentMethod,
            amount: finalPaid,
            notes: `Payment for ${newInvoice.invoiceNumber} via converted estimate ${estimate.estimateNumber}`,
          },
        });
      }

      // 5. Update Estimate status
      await tx.estimate.update({
        where: { id: estimate.id },
        data: {
          status: 'CONVERTED',
          convertedInvoiceId: newInvoice.invoiceNumber,
        },
      });

      return newInvoice;
    });

    if (req.logAudit) {
      req.logAudit({
        action: 'CONVERT_ESTIMATE_TO_INVOICE',
        entityType: 'ESTIMATE',
        entityId: estimate.id,
        details: `Converted estimate ${estimate.estimateNumber} to invoice ${result.invoiceNumber} (₹${result.grandTotal})`,
      });
    }

    res.json({
      message: `Estimate ${estimate.estimateNumber} converted successfully to invoice ${result.invoiceNumber}`,
      invoice: result,
    });
  } catch (err) {
    console.error('Estimate conversion error:', err);
    res.status(500).json({ error: 'Failed to convert estimate: ' + err.message });
  }
});

// DELETE /api/estimates/:id - Delete estimate
router.delete('/:id', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const existing = await prisma.estimate.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    if (existing.status === 'CONVERTED') {
      return res.status(400).json({ error: 'Cannot delete an estimate that has already been converted to an invoice.' });
    }

    await prisma.estimate.delete({ where: { id: req.params.id } });

    res.json({ message: 'Estimate deleted successfully' });
  } catch (err) {
    console.error('Delete estimate error:', err);
    res.status(500).json({ error: 'Failed to delete estimate: ' + err.message });
  }
});

// GET /api/estimates/:id/export/excel - Export single estimate as Excel spreadsheet
router.get('/:id/export/excel', authenticateToken, async (req, res) => {
  try {
    const estimate = await prisma.estimate.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    const business = (await prisma.businessProfile.findFirst()) || {
      businessName: 'Curated Art',
      phone: '+91 98765 43210',
      gstin: '24AAAAA0000A1Z5',
      address: 'Showroom #104, Design District, SG Highway, Ahmedabad, Gujarat - 380054',
    };

    const XLSX = require('xlsx');

    const wsData = [];
    const merges = [];

    // Row 0: Business Name
    wsData.push([business.businessName.toUpperCase(), '', '', '', '', '', '', '']);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });

    // Row 1: Tel & GSTIN
    wsData.push([`Tel: ${business.phone || ''} | GSTIN: ${business.gstin || ''}`, '', '', '', '', '', '', '']);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 7 } });

    // Row 2: Address
    wsData.push([`Address: ${business.address || ''}`, '', '', '', '', '', '', '']);
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 7 } });

    // Row 3: Blank
    wsData.push([]);

    // Row 4: Title & Doc Info
    wsData.push(['ESTIMATE / QUOTATION', '', '', '', `Doc #: ${estimate.estimateNumber}`, '', `Date: ${new Date(estimate.createdAt).toLocaleDateString('en-IN')}`, '']);
    merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: 3 } });
    merges.push({ s: { r: 4, c: 4 }, e: { r: 4, c: 5 } });
    merges.push({ s: { r: 4, c: 6 }, e: { r: 4, c: 7 } });

    // Row 5: Customer & Validity
    wsData.push([`Customer: ${estimate.customerName}`, '', '', '', `Valid For: ${estimate.validityDays || 15} Days`, '', `Status: ${estimate.status}`, '']);
    merges.push({ s: { r: 5, c: 0 }, e: { r: 5, c: 3 } });
    merges.push({ s: { r: 5, c: 4 }, e: { r: 5, c: 5 } });
    merges.push({ s: { r: 5, c: 6 }, e: { r: 5, c: 7 } });

    // Row 6: Phone & GSTIN & Place of Supply
    wsData.push([`Phone: ${estimate.customerMobile || 'N/A'}`, '', `GSTIN: ${estimate.customerGstin || 'N/A'}`, '', `Place of Supply: ${estimate.placeOfSupply || '24-Gujarat'}`, '', '', '']);
    merges.push({ s: { r: 6, c: 0 }, e: { r: 6, c: 1 } });
    merges.push({ s: { r: 6, c: 2 }, e: { r: 6, c: 3 } });
    merges.push({ s: { r: 6, c: 4 }, e: { r: 6, c: 7 } });

    // Row 7: Blank
    wsData.push([]);

    // Row 8: Table Header
    wsData.push(['#', 'Item Description', 'Item Code / SKU', 'Product Photo', 'Qty', 'Rate (MRP) (₹)', 'Discount (₹)', 'Total (₹)']);

    const host = req.get('host') || 'localhost:5001';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    (estimate.items || []).forEach((it, idx) => {
      let photoUrl = it.product?.imageUrl || it.imageUrl || '';
      if (photoUrl && photoUrl.startsWith('/')) {
        photoUrl = `${baseUrl}${photoUrl}`;
      } else if (!photoUrl) {
        photoUrl = '-';
      }

      wsData.push([
        idx + 1,
        it.productName,
        it.sku || it.product?.sku || 'CUSTOM',
        photoUrl,
        Number(it.quantity),
        Number(it.mrp || it.unitPrice),
        Number(it.discountAmount || 0),
        Number(it.totalAmount),
      ]);
    });

    // Blank row before totals
    wsData.push([]);

    // Subtotal Row
    const subtotalIdx = wsData.length;
    wsData.push(['BILLING AMOUNT (SUBTOTAL):', '', '', '', '', '', '', Number(estimate.subtotal)]);
    merges.push({ s: { r: subtotalIdx, c: 0 }, e: { r: subtotalIdx, c: 6 } });

    if (estimate.discountTotal > 0) {
      const discIdx = wsData.length;
      wsData.push(['TOTAL DISCOUNT APPLIED:', '', '', '', '', '', '', -Number(estimate.discountTotal)]);
      merges.push({ s: { r: discIdx, c: 0 }, e: { r: discIdx, c: 6 } });
    }

    if (estimate.cgstTotal > 0) {
      const cgstIdx = wsData.length;
      wsData.push(['CGST:', '', '', '', '', '', '', Number(estimate.cgstTotal)]);
      merges.push({ s: { r: cgstIdx, c: 0 }, e: { r: cgstIdx, c: 6 } });

      const sgstIdx = wsData.length;
      wsData.push(['SGST:', '', '', '', '', '', '', Number(estimate.sgstTotal)]);
      merges.push({ s: { r: sgstIdx, c: 0 }, e: { r: sgstIdx, c: 6 } });
    }

    if (estimate.igstTotal > 0) {
      const igstIdx = wsData.length;
      wsData.push(['IGST (Inter-State):', '', '', '', '', '', '', Number(estimate.igstTotal)]);
      merges.push({ s: { r: igstIdx, c: 0 }, e: { r: igstIdx, c: 6 } });
    }

    if (estimate.roundOff !== 0) {
      const roIdx = wsData.length;
      wsData.push(['Round Off:', '', '', '', '', '', '', Number(estimate.roundOff)]);
      merges.push({ s: { r: roIdx, c: 0 }, e: { r: roIdx, c: 6 } });
    }

    // Final Grand Total Row
    const grandIdx = wsData.length;
    wsData.push(['FINAL PAYABLE AMOUNT (GRAND TOTAL):', '', '', '', '', '', '', Number(estimate.grandTotal)]);
    merges.push({ s: { r: grandIdx, c: 0 }, e: { r: grandIdx, c: 6 } });

    // Blank row
    wsData.push([]);

    // Terms & Notes
    const notesIdx = wsData.length;
    wsData.push(['Notes & Terms:']);
    merges.push({ s: { r: notesIdx, c: 0 }, e: { r: notesIdx, c: 7 } });

    const note1Idx = wsData.length;
    wsData.push([`1. This estimate is valid for ${estimate.validityDays || 15} days from the date of issue.`]);
    merges.push({ s: { r: note1Idx, c: 0 }, e: { r: note1Idx, c: 7 } });

    const note2Idx = wsData.length;
    wsData.push(['2. Subject to product availability at the time of final confirmation.']);
    merges.push({ s: { r: note2Idx, c: 0 }, e: { r: note2Idx, c: 7 } });

    const note3Idx = wsData.length;
    wsData.push(['3. Fragile luxury décor is quality-checked prior to dispatch.']);
    merges.push({ s: { r: note3Idx, c: 0 }, e: { r: note3Idx, c: 7 } });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!merges'] = merges;
    ws['!cols'] = [
      { wch: 6 },   // #
      { wch: 38 },  // Item Description
      { wch: 20 },  // Item Code / SKU
      { wch: 32 },  // Product Photo Link
      { wch: 8 },   // Qty
      { wch: 16 },  // Rate (MRP) (₹)
      { wch: 16 },  // Discount (₹)
      { wch: 18 },  // Total (₹)
    ];

    // Format currency and numeric cells
    for (let r = 8; r < wsData.length; r++) {
      ['E', 'F', 'G', 'H'].forEach((col) => {
        const cellRef = `${col}${r + 1}`;
        if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
          ws[cellRef].t = 'n';
          ws[cellRef].z = col === 'E' ? '#,##0' : '#,##0.00';
        }
      });
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Estimate');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Estimate_${estimate.estimateNumber}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Estimate Excel export error:', err);
    res.status(500).json({ error: 'Failed to export estimate to Excel: ' + err.message });
  }
});

// GET /api/estimates/:id/export/pdf - Export single estimate as formatted PDF document
router.get('/:id/export/pdf', authenticateToken, async (req, res) => {
  try {
    const estimate = await prisma.estimate.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    const business = (await prisma.businessProfile.findFirst()) || {
      businessName: 'Curated Art',
      phone: '+91 98765 43210',
      email: 'contact@curatedart.in',
      gstin: '24AAAAA0000A1Z5',
      address: 'Showroom #104, Design District, SG Highway, Ahmedabad, Gujarat - 380054',
    };

    const pdfBuffer = await generateEstimatePdf(estimate, business);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Estimate_${estimate.estimateNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    console.error('Estimate PDF export error:', err);
    res.status(500).json({ error: 'Failed to export estimate to PDF: ' + err.message });
  }
});

// PATCH /api/estimates/:id/discount - Update overall or item discounts on an estimate
router.patch('/:id/discount', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'BILLING']), async (req, res) => {
  try {
    const { invoiceDiscount, itemDiscounts } = req.body;

    const existing = await prisma.estimate.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    if (existing.status === 'CONVERTED') {
      return res.status(400).json({ error: 'Cannot modify discount on an already converted estimate.' });
    }

    const business = await prisma.businessProfile.findFirst();
    const businessStateCode = business ? business.stateCode : '24';
    const cStateCode = existing.placeOfSupply?.includes('-') ? existing.placeOfSupply.split('-')[0] : businessStateCode;

    // Prepare items with new discounts
    const itemDiscountMap = {};
    if (Array.isArray(itemDiscounts)) {
      for (const idc of itemDiscounts) {
        if (idc.itemId) itemDiscountMap[idc.itemId] = Math.max(0, parseFloat(idc.discountAmount) || 0);
      }
    }

    const updatedRawItems = existing.items.map((it) => {
      const newDiscount = itemDiscountMap[it.id] !== undefined ? itemDiscountMap[it.id] : it.discountAmount;
      return {
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        hsnCode: it.hsnCode,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        mrp: it.mrp,
        discountAmount: newDiscount,
        gstRate: it.taxRate,
        isTaxInclusive: false,
      };
    });

    const finalInvoiceDiscount = invoiceDiscount !== undefined
      ? Math.max(0, parseFloat(invoiceDiscount) || 0)
      : 0;

    const calc = calculateInvoiceTotals(updatedRawItems, {
      businessStateCode,
      customerStateCode: cStateCode,
      invoiceDiscount: finalInvoiceDiscount,
    });

    // Update in database transaction
    const updated = await prisma.$transaction(async (tx) => {
      for (const calcItem of calc.items) {
        const matchingRaw = updatedRawItems.find((r) => r.sku === calcItem.sku && r.productName === calcItem.productName);
        if (matchingRaw?.id) {
          await tx.estimateItem.update({
            where: { id: matchingRaw.id },
            data: {
              discountAmount: calcItem.discountAmount,
              taxableAmount: calcItem.taxableAmount,
              cgstAmount: calcItem.cgstAmount,
              sgstAmount: calcItem.sgstAmount,
              igstAmount: calcItem.igstAmount,
              totalAmount: calcItem.totalAmount,
            },
          });
        }
      }

      return tx.estimate.update({
        where: { id: existing.id },
        data: {
          subtotal: calc.subtotal,
          discountTotal: calc.discountTotal,
          taxTotal: calc.taxTotal,
          cgstTotal: calc.cgstTotal,
          sgstTotal: calc.sgstTotal,
          igstTotal: calc.igstTotal,
          roundOff: calc.roundOff,
          grandTotal: calc.grandTotal,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          customer: true,
        },
      });
    });

    res.json({ message: 'Estimate discount updated successfully', estimate: updated });
  } catch (err) {
    console.error('Update estimate discount error:', err);
    res.status(500).json({ error: 'Failed to update discount: ' + err.message });
  }
});

// POST /api/estimates/:id/sync - Standalone mode (sync not required)
router.post('/:id/sync', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'BILLING']), async (req, res) => {
  res.json({ message: 'Estimate sync is not required in standalone mode.' });
});

module.exports = router;

