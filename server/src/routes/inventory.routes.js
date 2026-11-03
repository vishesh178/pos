const express = require('express');
const prisma = require('../prisma');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/inventory/overview - Inventory health & valuation
router.get('/overview', optionalAuth, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        currentStock: true,
        minStock: true,
        purchasePrice: true,
        sellingPrice: true,
      },
    });

    const totalProducts = products.length;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStockUnits = 0;
    let totalValuationCost = 0;
    let totalValuationRetail = 0;

    for (const p of products) {
      totalStockUnits += p.currentStock;
      totalValuationCost += p.currentStock * p.purchasePrice;
      totalValuationRetail += p.currentStock * p.sellingPrice;

      if (p.currentStock <= 0) {
        outOfStockCount++;
      } else if (p.currentStock <= p.minStock) {
        lowStockCount++;
      }
    }

    const isAdmin = req.user && req.user.role === 'ADMIN';

    res.json({
      totalProducts,
      lowStockCount,
      outOfStockCount,
      totalStockUnits,
      totalValuationCost: isAdmin ? Math.round(totalValuationCost * 100) / 100 : null,
      totalValuationRetail: Math.round(totalValuationRetail * 100) / 100,
      potentialProfit: isAdmin ? Math.round((totalValuationRetail - totalValuationCost) * 100) / 100 : null,
    });
  } catch (err) {
    console.error('Fetch inventory overview error:', err);
    res.status(500).json({ error: 'Failed to retrieve inventory overview.' });
  }
});

// GET /api/inventory/movements - Stock movement ledger
router.get('/movements', optionalAuth, async (req, res) => {
  try {
    const { productId, type, limit = 50 } = req.query;
    const where = {};

    if (productId) where.productId = productId;
    if (type) where.type = type;

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, barcode: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
    });

    const isAdmin = req.user && req.user.role === 'ADMIN';
    const sanitized = isAdmin
      ? movements
      : movements.map((m) => {
          const copy = { ...m };
          delete copy.unitCost;
          return copy;
        });

    res.json(sanitized);
  } catch (err) {
    console.error('Fetch stock movements error:', err);
    res.status(500).json({ error: 'Failed to retrieve stock movements.' });
  }
});

// POST /api/inventory/adjust - Manual stock adjustment
router.post('/adjust', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'INVENTORY']), async (req, res) => {
  try {
    const { productId, type, quantity, notes } = req.body;

    if (!productId || !type || quantity === undefined || parseInt(quantity, 10) <= 0) {
      return res.status(400).json({ error: 'Valid productId, adjustment type, and positive quantity are required.' });
    }

    const validTypes = ['DAMAGE_OUTWARD', 'ADJUSTMENT_ADD', 'ADJUSTMENT_SUBTRACT'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid adjustment type. Allowed: ${validTypes.join(', ')}` });
    }

    const adjustmentQty = parseInt(quantity, 10);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Determine stock change
    let newStock = product.currentStock;
    if (type === 'ADJUSTMENT_ADD') {
      newStock += adjustmentQty;
    } else {
      if (product.currentStock < adjustmentQty) {
        return res.status(400).json({
          error: `Insufficient stock to subtract. Current stock: ${product.currentStock}, requested deduction: ${adjustmentQty}`,
        });
      }
      newStock -= adjustmentQty;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update product stock
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      });

      // 2. Record stock movement
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          type,
          quantity: type === 'ADJUSTMENT_ADD' ? adjustmentQty : -adjustmentQty,
          unitCost: product.purchasePrice,
          balanceAfter: newStock,
          referenceType: 'MANUAL',
          notes: notes || `Manual stock adjustment (${type})`,
          createdBy: req.user.name,
        },
      });

      // 3. Enqueue Zoho Inventory adjustment SyncJob
      await tx.syncJob.create({
        data: {
          entityType: 'ADJUSTMENT',
          localRecordId: movement.id,
          operation: 'CREATE',
          payload: JSON.stringify({
            product_id: product.id,
            sku: product.sku,
            zoho_item_id: product.zohoItemId,
            adjustment_type: type === 'ADJUSTMENT_ADD' ? 'quantity_increase' : 'quantity_decrease',
            quantity: adjustmentQty,
            reason: notes || type,
          }),
          status: 'PENDING',
        },
      });

      return { product: updatedProduct, movement };
    });

    req.logAudit('ADJUST_STOCK', 'PRODUCT', productId, {
      type,
      quantity: adjustmentQty,
      previousStock: product.currentStock,
      newStock,
      notes,
    });

    res.json({
      message: 'Stock adjusted successfully.',
      currentStock: result.product.currentStock,
      movement: result.movement,
    });
  } catch (err) {
    console.error('Stock adjustment error:', err);
    res.status(500).json({ error: 'Failed to adjust stock.' });
  }
});

module.exports = router;

