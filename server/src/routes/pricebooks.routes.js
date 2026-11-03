const express = require('express');
const prisma = require('../prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');
const zohoApi = require('../services/zohoApiService');
const zohoSync = require('../services/zohoSyncService');

const router = express.Router();

/**
 * GET /api/pricebooks
 * List all pricebook tiers with customer and invoice counts
 */
router.get('/', async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const where = includeInactive === 'true' ? {} : { isActive: true };

    const pricebooks = await prisma.pricebook.findMany({
      where,
      orderBy: { discountPercentage: 'asc' },
      include: {
        _count: {
          select: {
            customers: true,
            invoices: true,
            estimates: true,
          },
        },
      },
    });

    res.json(pricebooks);
  } catch (err) {
    console.error('Fetch pricebooks error:', err);
    res.status(500).json({ error: 'Failed to retrieve pricebooks.' });
  }
});

/**
 * GET /api/pricebooks/:id
 * Get single pricebook details
 */
router.get('/:id', async (req, res) => {
  try {
    const pricebook = await prisma.pricebook.findUnique({
      where: { id: req.params.id },
      include: {
        customers: {
          select: { id: true, name: true, mobile: true, customerType: true },
          take: 10,
        },
        _count: {
          select: { customers: true, invoices: true, estimates: true },
        },
      },
    });

    if (!pricebook) {
      return res.status(404).json({ error: 'Pricebook not found.' });
    }

    res.json(pricebook);
  } catch (err) {
    console.error('Fetch pricebook error:', err);
    res.status(500).json({ error: 'Failed to retrieve pricebook details.' });
  }
});

/**
 * POST /api/pricebooks
 * Create a new custom Pricebook tier (Admin only)
 */
router.post('/', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, code, description, discountPercentage, pricingType, isDefault } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Pricebook name is required.' });
    }

    const generatedCode = (code || name.replace(/[^A-Za-z0-9]/g, '_')).toUpperCase();
    const discount = Math.max(0, Math.min(100, parseFloat(discountPercentage) || 0));

    // If marked default, unset existing defaults
    if (isDefault) {
      await prisma.pricebook.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const pricebook = await prisma.pricebook.create({
      data: {
        name: name.trim(),
        code: generatedCode,
        description: description ? description.trim() : null,
        discountPercentage: discount,
        pricingType: pricingType || 'DISCOUNT',
        isDefault: !!isDefault,
        isActive: true,
        zohoSyncStatus: 'PENDING',
      },
    });

    // Enqueue transactional outbox job for Zoho Books sync
    await prisma.syncJob.create({
      data: {
        entityType: 'PRICEBOOK',
        localRecordId: pricebook.id,
        operation: 'CREATE',
        payload: JSON.stringify({
          name: pricebook.name,
          description: pricebook.description,
          discountPercentage: pricebook.discountPercentage,
          isActive: pricebook.isActive,
        }),
      },
    });

    req.logAudit?.('CREATE_PRICEBOOK', 'PRICEBOOK', pricebook.id, {
      name: pricebook.name,
      discountPercentage: pricebook.discountPercentage,
    });

    // Trigger background sync pass
    zohoSync.runSyncPass().catch(console.error);

    res.status(201).json(pricebook);
  } catch (err) {
    console.error('Create pricebook error:', err);
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A pricebook with this name or code already exists.' });
    }
    res.status(500).json({ error: 'Failed to create pricebook: ' + err.message });
  }
});

/**
 * PUT /api/pricebooks/:id
 * Update pricebook tier (Admin only)
 */
router.put('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, description, discountPercentage, isDefault, isActive } = req.body;

    const existing = await prisma.pricebook.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Pricebook not found.' });
    }

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (description !== undefined) dataToUpdate.description = description.trim();
    if (discountPercentage !== undefined) {
      dataToUpdate.discountPercentage = Math.max(0, Math.min(100, parseFloat(discountPercentage) || 0));
    }
    if (isActive !== undefined) dataToUpdate.isActive = !!isActive;

    if (isDefault) {
      await prisma.pricebook.updateMany({
        where: { isDefault: true, id: { not: req.params.id } },
        data: { isDefault: false },
      });
      dataToUpdate.isDefault = true;
    }

    const updated = await prisma.pricebook.update({
      where: { id: req.params.id },
      data: dataToUpdate,
    });

    // Enqueue outbox update
    await prisma.syncJob.create({
      data: {
        entityType: 'PRICEBOOK',
        localRecordId: updated.id,
        zohoRecordId: updated.zohoPricebookId,
        operation: 'UPDATE',
        payload: JSON.stringify({
          name: updated.name,
          description: updated.description,
          discountPercentage: updated.discountPercentage,
          isActive: updated.isActive,
        }),
      },
    });

    req.logAudit?.('UPDATE_PRICEBOOK', 'PRICEBOOK', updated.id, dataToUpdate);
    zohoSync.runSyncPass().catch(console.error);

    res.json(updated);
  } catch (err) {
    console.error('Update pricebook error:', err);
    res.status(500).json({ error: 'Failed to update pricebook: ' + err.message });
  }
});

/**
 * POST /api/pricebooks/calculate
 * Quick calculation preview for cart items with a specific pricebook
 */
router.post('/calculate', (req, res) => {
  const { items = [], discountPercentage = 0 } = req.body;
  const discount = Math.max(0, Math.min(100, parseFloat(discountPercentage) || 0));

  const calculatedItems = items.map((item) => {
    const basePrice = item.mrp || item.sellingPrice || item.unitPrice || 0;
    const rate = discount > 0 ? Math.round(basePrice * (1 - discount / 100)) : basePrice;
    const itemSavings = Math.max(0, basePrice - rate) * (item.quantity || 1);

    return {
      ...item,
      basePrice,
      effectiveUnitPrice: rate,
      itemSavings,
    };
  });

  const totalOriginal = calculatedItems.reduce((acc, it) => acc + it.basePrice * (it.quantity || 1), 0);
  const totalDiscounted = calculatedItems.reduce((acc, it) => acc + it.effectiveUnitPrice * (it.quantity || 1), 0);
  const totalSavings = Math.max(0, totalOriginal - totalDiscounted);

  res.json({
    discountPercentage: discount,
    items: calculatedItems,
    totalOriginal,
    totalDiscounted,
    totalSavings,
  });
});

module.exports = router;

