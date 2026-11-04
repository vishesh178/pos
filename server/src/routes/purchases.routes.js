const express = require('express');
const prisma = require('../prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// ==========================================
// SUPPLIERS
// ==========================================

// GET /api/purchases/suppliers - List all suppliers
router.get('/suppliers', async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: { select: { purchaseOrders: true, purchaseBills: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(suppliers);
  } catch (err) {
    console.error('Fetch suppliers error:', err);
    res.status(500).json({ error: 'Failed to retrieve suppliers.' });
  }
});

// POST /api/purchases/suppliers - Create supplier & enqueue Zoho Vendor Sync
router.post('/suppliers', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'INVENTORY']), async (req, res) => {
  try {
    const { name, contactPerson, mobile, email, gstin, address, state, stateCode, openingBalance } = req.body;

    if (!name || !mobile) {
      return res.status(400).json({ error: 'Supplier company name and mobile are required.' });
    }

    const openBal = openingBalance ? parseFloat(openingBalance) : 0.0;

    const supplier = await prisma.$transaction(async (tx) => {
      const newSup = await tx.supplier.create({
        data: {
          name: name.trim(),
          contactPerson: contactPerson ? contactPerson.trim() : null,
          mobile: mobile.trim(),
          email: email ? email.trim() : null,
          gstin: gstin ? gstin.trim().toUpperCase() : null,
          address: address ? address.trim() : null,
          state: state || 'Gujarat',
          stateCode: stateCode || '24',
          openingBalance: openBal,
          currentBalance: openBal,
          zohoSyncStatus: 'PENDING',
        },
      });

      return newSup;
    });

    req.logAudit('CREATE_SUPPLIER', 'SUPPLIER', supplier.id, { name: supplier.name });
    res.status(201).json(supplier);
  } catch (err) {
    console.error('Create supplier error:', err);
    res.status(500).json({ error: 'Failed to create supplier.' });
  }
});

// ==========================================
// PURCHASE ORDERS (PO)
// ==========================================

// GET /api/purchases/orders - List POs
router.get('/orders', async (req, res) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: {
        supplier: { select: { id: true, name: true, mobile: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    console.error('Fetch POs error:', err);
    res.status(500).json({ error: 'Failed to retrieve purchase orders.' });
  }
});

// POST /api/purchases/orders - Create Purchase Order
router.post('/orders', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'INVENTORY']), async (req, res) => {
  try {
    const { supplierId, expectedDate, notes, items } = req.body;
    // items: array of { productId, quantity, unitCost, taxRate }

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Supplier and PO items are required.' });
    }

    const count = await prisma.purchaseOrder.count();
    const year = new Date().getFullYear();
    const poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`;

    let subtotal = 0;
    let taxTotal = 0;

    const processedItems = items.map((it) => {
      const qty = parseInt(it.quantity, 10) || 1;
      const cost = parseFloat(it.unitCost) || 0;
      const taxRate = parseFloat(it.taxRate) || 18.0;
      const itemSub = qty * cost;
      const itemTax = (itemSub * taxRate) / 100;
      const totalAmount = Math.round((itemSub + itemTax) * 100) / 100;

      subtotal += itemSub;
      taxTotal += itemTax;

      return {
        productId: it.productId,
        quantity: qty,
        unitCost: cost,
        taxRate,
        totalAmount,
      };
    });

    const grandTotal = Math.round((subtotal + taxTotal) * 100) / 100;

    const po = await prisma.$transaction(async (tx) => {
      const newPo = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId,
          status: 'ISSUED',
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          notes: notes ? notes.trim() : null,
          subtotal: Math.round(subtotal * 100) / 100,
          taxTotal: Math.round(taxTotal * 100) / 100,
          grandTotal,
        },
      });

      for (const it of processedItems) {
        await tx.purchaseOrderItem.create({
          data: {
            purchaseOrderId: newPo.id,
            productId: it.productId,
            quantity: it.quantity,
            unitCost: it.unitCost,
            taxRate: it.taxRate,
            totalAmount: it.totalAmount,
          },
        });
      }

      return newPo;
    });

    req.logAudit('CREATE_PO', 'PURCHASE_ORDER', po.id, { poNumber, grandTotal });
    res.status(201).json(po);
  } catch (err) {
    console.error('Create PO error:', err);
    res.status(500).json({ error: 'Failed to create purchase order.' });
  }
});

// ==========================================
// PURCHASE BILLS & INWARD STOCK
// ==========================================

// GET /api/purchases/bills - List bills
router.get('/bills', async (req, res) => {
  try {
    const bills = await prisma.purchaseBill.findMany({
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(bills);
  } catch (err) {
    console.error('Fetch bills error:', err);
    res.status(500).json({ error: 'Failed to retrieve purchase bills.' });
  }
});

// POST /api/purchases/bills - Record Inward Purchase Bill (Updates Inventory Stock!)
router.post('/bills', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'INVENTORY']), async (req, res) => {
  try {
    const {
      supplierId,
      supplierBillNumber,
      purchaseOrderId,
      billDate,
      dueDate,
      paidAmount,
      notes,
      items, // array of { productId, quantity, unitCost, taxRate }
    } = req.body;

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Supplier and bill items are required.' });
    }

    const count = await prisma.purchaseBill.count();
    const year = new Date().getFullYear();
    const billNumber = `BILL-${year}-${String(count + 1).padStart(4, '0')}`;

    let subtotal = 0;
    let taxTotal = 0;

    const processedItems = items.map((it) => {
      const qty = parseInt(it.quantity, 10) || 1;
      const cost = parseFloat(it.unitCost) || 0;
      const taxRate = parseFloat(it.taxRate) || 18.0;
      const itemSub = qty * cost;
      const itemTax = (itemSub * taxRate) / 100;
      const totalAmount = Math.round((itemSub + itemTax) * 100) / 100;

      subtotal += itemSub;
      taxTotal += itemTax;

      return {
        productId: it.productId,
        quantity: qty,
        unitCost: cost,
        taxRate,
        totalAmount,
      };
    });

    const grandTotal = Math.round((subtotal + taxTotal) * 100) / 100;
    const paid = paidAmount ? parseFloat(paidAmount) : 0.0;
    const paymentStatus = paid >= grandTotal ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';

    const bill = await prisma.$transaction(async (tx) => {
      // 1. Create PurchaseBill
      const newBill = await tx.purchaseBill.create({
        data: {
          billNumber,
          supplierBillNumber: supplierBillNumber ? supplierBillNumber.trim() : null,
          supplierId,
          purchaseOrderId: purchaseOrderId || null,
          billDate: billDate ? new Date(billDate) : new Date(),
          dueDate: dueDate ? new Date(dueDate) : null,
          subtotal: Math.round(subtotal * 100) / 100,
          taxTotal: Math.round(taxTotal * 100) / 100,
          grandTotal,
          paidAmount: paid,
          paymentStatus,
          notes: notes ? notes.trim() : null,
          zohoSyncStatus: 'PENDING',
        },
      });

      // 2. Inward Stock: update Product stock + StockMovement ledger
      for (const it of processedItems) {
        await tx.purchaseBillItem.create({
          data: {
            purchaseBillId: newBill.id,
            productId: it.productId,
            quantity: it.quantity,
            unitCost: it.unitCost,
            taxRate: it.taxRate,
            totalAmount: it.totalAmount,
          },
        });

        const prod = await tx.product.findUnique({ where: { id: it.productId } });
        if (prod) {
          const newStock = prod.currentStock + it.quantity;
          await tx.product.update({
            where: { id: it.productId },
            data: {
              currentStock: newStock,
              purchasePrice: it.unitCost, // Update latest purchase cost
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: it.productId,
              type: 'PURCHASE',
              quantity: it.quantity,
              unitCost: it.unitCost,
              balanceAfter: newStock,
              referenceType: 'PURCHASE_BILL',
              referenceId: billNumber,
              notes: `Stock Inward via Purchase Bill ${billNumber}`,
              createdBy: req.user.name,
            },
          });
        }
      }

      // 3. If linked to PO, mark PO as RECEIVED
      if (purchaseOrderId) {
        await tx.purchaseOrder.update({
          where: { id: purchaseOrderId },
          data: { status: 'RECEIVED' },
        });
      }

      // 4. Update Supplier Current Balance (add unpaid amount)
      const balanceDue = grandTotal - paid;
      if (balanceDue !== 0) {
        await tx.supplier.update({
          where: { id: supplierId },
          data: { currentBalance: { increment: balanceDue } },
        });
      }

      return newBill;
    });

    req.logAudit('CREATE_PURCHASE_BILL', 'PURCHASE_BILL', bill.id, { billNumber, grandTotal });
    res.status(201).json(bill);
  } catch (err) {
    console.error('Create bill error:', err);
    res.status(500).json({ error: 'Failed to record purchase bill: ' + err.message });
  }
});

module.exports = router;

