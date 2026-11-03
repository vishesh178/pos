const fs = require('fs');
const path = require('path');
const express = require('express');
const prisma = require('../prisma');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const { generateSku, generateEan13Barcode, isValidEan13 } = require('../utils/barcode');

const router = express.Router();

// Helper function to sanitize product objects so only ADMIN can view purchase cost
function filterProductForUser(product, user) {
  if (!product) return product;
  if (user && user.role === 'ADMIN') {
    return product;
  }
  const clean = { ...product };
  delete clean.purchasePrice;
  if (clean.stockMovements && Array.isArray(clean.stockMovements)) {
    clean.stockMovements = clean.stockMovements.map((sm) => {
      const smClean = { ...sm };
      delete smClean.unitCost;
      return smClean;
    });
  }
  return clean;
}

// GET /api/products/categories - List categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (err) {
    console.error('Fetch categories error:', err);
    res.status(500).json({ error: 'Failed to retrieve categories.' });
  }
});

// POST /api/products/categories - Create category (ADMIN/MANAGER)
router.post('/categories', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
      },
    });

    req.logAudit('CREATE_CATEGORY', 'CATEGORY', category.id, { name: category.name });
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Category already exists.' });
    }
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

// GET /api/products/generate-sku - Next SKU helper
router.get('/generate-sku', async (req, res) => {
  try {
    const { categoryName } = req.query;
    const count = await prisma.product.count();
    const sku = generateSku(categoryName || 'General', count + 1);
    res.json({ sku });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate SKU.' });
  }
});

// GET /api/products/generate-barcode - Next EAN-13 barcode helper
router.get('/generate-barcode', async (req, res) => {
  try {
    const count = await prisma.product.count();
    let counter = count + 1;
    let barcode = generateEan13Barcode(counter);

    // Ensure barcode is unique
    let exists = await prisma.product.findFirst({ where: { barcode } });
    while (exists) {
      counter++;
      barcode = generateEan13Barcode(counter);
      exists = await prisma.product.findFirst({ where: { barcode } });
    }

    res.json({ barcode });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate barcode.' });
  }
});

// POST /api/products/upload-image - Upload local product image file
router.post('/upload-image', authenticateToken, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64 || !imageBase64.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Valid image base64 data URL is required.' });
    }

    const matches = imageBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid image format.' });
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const dataBuffer = Buffer.from(matches[2], 'base64');

    const uploadsDir = path.resolve(__dirname, '../../uploads/products');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeName = `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const filePath = path.join(uploadsDir, safeName);
    fs.writeFileSync(filePath, dataBuffer);

    res.json({
      imageUrl: `/uploads/products/${safeName}`,
      success: true,
    });
  } catch (err) {
    console.error('Upload product image error:', err);
    res.status(500).json({ error: 'Failed to save product image.' });
  }
});

// GET /api/products - List products with optional search, category, and low stock filters
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, categoryId, status, lowStock } = req.query;
    const where = {};

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { sku: { contains: q } },
        { barcode: { contains: q } },
        { hsnCode: { contains: q } },
        { brand: { contains: q } },
      ];
    }

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    let products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lowStock === 'true') {
      products = products.filter((p) => p.currentStock <= p.minStock);
    }

    res.json(products.map((p) => filterProductForUser(p, req.user)));
  } catch (err) {
    console.error('Fetch products error:', err);
    res.status(500).json({ error: 'Failed to retrieve products.' });
  }
});

// GET /api/products/wholesale-catalog - Daily available in-stock items with wholesale pricing
router.get('/wholesale-catalog', async (req, res) => {
  try {
    const { categoryId, minStock = 1 } = req.query;
    const where = {
      status: 'ACTIVE',
      currentStock: { gte: parseInt(minStock, 10) || 1 },
    };

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }

    const items = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: [
        { category: { name: 'asc' } },
        { name: 'asc' },
      ],
    });

    const business = await prisma.businessProfile.findFirst();

    res.json({
      generatedAt: new Date().toISOString(),
      dateFormatted: new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      business: business || {
        businessName: 'Curated Art',
        legalName: 'Curated Art Luxury Decor Pvt Ltd',
        gstin: '24AAAAA0000A1Z5',
        phone: '+91 98765 43210',
        email: 'contact@curatedart.in',
        address: 'Showroom #104, Design District, SG Highway, Ahmedabad, Gujarat - 380054',
      },
      totalItems: items.length,
      totalStockPieces: items.reduce((sum, it) => sum + it.currentStock, 0),
      totalWholesaleValue: items.reduce((sum, it) => sum + (it.sellingPrice * it.currentStock), 0),
      items: items.map((p) => {
        const marginPercent =
          p.mrp > 0 && p.mrp > p.sellingPrice
            ? Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100)
            : 0;
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          categoryName: p.category?.name || 'General',
          brand: p.brand || 'Curated Art',
          description: p.description,
          imageUrl: p.imageUrl,
          wholesalePrice: p.sellingPrice,
          mrp: p.mrp,
          retailMarginPercent: marginPercent,
          gstRate: p.gstRate,
          hsnCode: p.hsnCode,
          currentStock: p.currentStock,
          unit: p.unit || 'PCS',
        };
      }),
    });
  } catch (err) {
    console.error('Fetch wholesale catalog error:', err);
    res.status(500).json({ error: 'Failed to generate wholesale catalog.' });
  }
});

// GET /api/products/:id - Single product with stock movement history
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        supplier: true,
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json(filterProductForUser(product, req.user));
  } catch (err) {
    console.error('Fetch product error:', err);
    res.status(500).json({ error: 'Failed to retrieve product.' });
  }
});

// POST /api/products - Create new product
router.post('/', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'INVENTORY']), async (req, res) => {
  try {
    const {
      name,
      sku,
      barcode,
      categoryId,
      subcategory,
      brand,
      description,
      imageUrl,
      purchasePrice,
      sellingPrice,
      mrp,
      gstRate,
      hsnCode,
      currentStock,
      minStock,
      unit,
      supplierId,
      status,
    } = req.body;

    if (!name || !sku || !barcode) {
      return res.status(400).json({ error: 'Product name, SKU, and barcode are required.' });
    }

    // Check SKU and Barcode uniqueness
    const existingSku = await prisma.product.findUnique({ where: { sku: sku.trim() } });
    if (existingSku) {
      return res.status(400).json({ error: `SKU '${sku}' is already in use.` });
    }

    const existingBarcode = await prisma.product.findUnique({ where: { barcode: barcode.trim() } });
    if (existingBarcode) {
      return res.status(400).json({ error: `Barcode '${barcode}' is already in use.` });
    }

    const stockQty = currentStock ? parseInt(currentStock, 10) : 0;
    const isAdmin = req.user && req.user.role === 'ADMIN';
    const cost = (isAdmin && purchasePrice) ? parseFloat(purchasePrice) : 0.0;
    const price = sellingPrice ? parseFloat(sellingPrice) : 0.0;
    const maxRetail = mrp ? parseFloat(mrp) : price;
    const gst = gstRate !== undefined ? parseFloat(gstRate) : 18.0;

    // Transaction to create product + initial opening stock movement + Zoho SyncJob
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          name: name.trim(),
          sku: sku.trim(),
          barcode: barcode.trim(),
          categoryId: categoryId || null,
          subcategory: subcategory ? subcategory.trim() : null,
          brand: brand ? brand.trim() : 'Curated Art',
          description: description ? description.trim() : null,
          imageUrl: imageUrl || null,
          purchasePrice: cost,
          sellingPrice: price,
          mrp: maxRetail,
          gstRate: gst,
          hsnCode: hsnCode ? hsnCode.trim() : '9701',
          currentStock: stockQty,
          minStock: minStock ? parseInt(minStock, 10) : 5,
          unit: unit ? unit.trim().toUpperCase() : 'PCS',
          supplierId: supplierId || null,
          status: status || 'ACTIVE',
          zohoSyncStatus: 'PENDING',
        },
      });

      // Record opening stock if stockQty > 0
      if (stockQty > 0) {
        await tx.stockMovement.create({
          data: {
            productId: newProduct.id,
            type: 'OPENING',
            quantity: stockQty,
            unitCost: cost,
            balanceAfter: stockQty,
            referenceType: 'MANUAL',
            notes: 'Initial opening stock upon product creation',
            createdBy: req.user.name,
          },
        });
      }

      // Enqueue Zoho Inventory Item creation job
      await tx.syncJob.create({
        data: {
          entityType: 'PRODUCT',
          localRecordId: newProduct.id,
          operation: 'CREATE',
          payload: JSON.stringify({
            name: newProduct.name,
            sku: newProduct.sku,
            rate: newProduct.sellingPrice,
            purchase_rate: newProduct.purchasePrice,
            hsn_or_sac: newProduct.hsnCode,
            unit: newProduct.unit,
            initial_stock: stockQty,
          }),
          status: 'PENDING',
        },
      });

      return newProduct;
    });

    req.logAudit('CREATE_PRODUCT', 'PRODUCT', product.id, { name: product.name, sku: product.sku });
    res.status(201).json(filterProductForUser(product, req.user));
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Failed to create product.' });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'INVENTORY']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      sku,
      barcode,
      categoryId,
      subcategory,
      brand,
      description,
      imageUrl,
      purchasePrice,
      sellingPrice,
      mrp,
      gstRate,
      hsnCode,
      minStock,
      unit,
      supplierId,
      status,
    } = req.body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (sku && sku !== existing.sku) {
      const duplicateSku = await prisma.product.findUnique({ where: { sku: sku.trim() } });
      if (duplicateSku) {
        return res.status(400).json({ error: `SKU '${sku}' is already in use by another product.` });
      }
    }

    if (barcode && barcode !== existing.barcode) {
      const duplicateBarcode = await prisma.product.findUnique({ where: { barcode: barcode.trim() } });
      if (duplicateBarcode) {
        return res.status(400).json({ error: `Barcode '${barcode}' is already in use by another product.` });
      }
    }

    const isAdmin = req.user && req.user.role === 'ADMIN';

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id },
        data: {
          name: name ? name.trim() : undefined,
          sku: sku ? sku.trim() : undefined,
          barcode: barcode ? barcode.trim() : undefined,
          categoryId: categoryId !== undefined ? categoryId : undefined,
          subcategory: subcategory !== undefined ? subcategory : undefined,
          brand: brand !== undefined ? brand : undefined,
          description: description !== undefined ? description : undefined,
          imageUrl: imageUrl !== undefined ? imageUrl : undefined,
          purchasePrice: (isAdmin && purchasePrice !== undefined) ? parseFloat(purchasePrice) : undefined,
          sellingPrice: sellingPrice !== undefined ? parseFloat(sellingPrice) : undefined,
          mrp: mrp !== undefined ? parseFloat(mrp) : undefined,
          gstRate: gstRate !== undefined ? parseFloat(gstRate) : undefined,
          hsnCode: hsnCode !== undefined ? hsnCode.trim() : undefined,
          minStock: minStock !== undefined ? parseInt(minStock, 10) : undefined,
          unit: unit !== undefined ? unit.trim().toUpperCase() : undefined,
          supplierId: supplierId !== undefined ? supplierId : undefined,
          status: status !== undefined ? status : undefined,
          zohoSyncStatus: 'PENDING',
        },
      });

      // Enqueue Zoho Item update job
      await tx.syncJob.create({
        data: {
          entityType: 'PRODUCT',
          localRecordId: p.id,
          zohoRecordId: p.zohoItemId || null,
          operation: 'UPDATE',
          payload: JSON.stringify({
            name: p.name,
            sku: p.sku,
            rate: p.sellingPrice,
            purchase_rate: p.purchasePrice,
            hsn_or_sac: p.hsnCode,
          }),
          status: 'PENDING',
        },
      });

      return p;
    });

    req.logAudit('UPDATE_PRODUCT', 'PRODUCT', updated.id, { name: updated.name, sku: updated.sku });
    res.json(filterProductForUser(updated, req.user));
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

// DELETE /api/products/:id - Delete or archive product
router.delete('/:id', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    // Check if referenced in invoices or bills
    const invoiceItem = await prisma.invoiceItem.findFirst({ where: { productId: id } });
    if (invoiceItem) {
      // Soft-delete by marking status DISCONTINUED
      await prisma.product.update({
        where: { id },
        data: { status: 'DISCONTINUED' },
      });
      req.logAudit('ARCHIVE_PRODUCT', 'PRODUCT', id, { reason: 'Has historical invoice transactions' });
      return res.json({ message: 'Product has invoice history; status marked as DISCONTINUED.' });
    }

    await prisma.product.delete({ where: { id } });
    req.logAudit('DELETE_PRODUCT', 'PRODUCT', id, {});
    res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Failed to delete product.' });
  }
});

// POST /api/products/bulk-import - Bulk import with duplicate detection
router.post('/bulk-import', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { items } = req.body; // array of product rows
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty items array.' });
    }

    const imported = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      try {
        if (!row.name || !row.name.trim()) {
          errors.push({ row: i + 1, error: 'Product name is required.' });
          continue;
        }

        // Auto-assign SKU/Barcode if missing
        const sku = row.sku && row.sku.trim() ? row.sku.trim() : generateSku(row.category || 'General', Date.now() + i);
        const barcode = row.barcode && row.barcode.trim() ? row.barcode.trim() : generateEan13Barcode(Date.now() % 90000 + i);

        // Check duplicates
        const dupSku = await prisma.product.findUnique({ where: { sku } });
        if (dupSku) {
          errors.push({ row: i + 1, sku, error: 'SKU already exists.' });
          continue;
        }

        // Category resolution
        let categoryId = null;
        if (row.category) {
          let cat = await prisma.category.findUnique({ where: { name: row.category.trim() } });
          if (!cat) {
            cat = await prisma.category.create({ data: { name: row.category.trim() } });
          }
          categoryId = cat.id;
        }

        const currentStock = row.currentStock ? parseInt(row.currentStock, 10) : 0;
        const isAdmin = req.user && req.user.role === 'ADMIN';
        const purchasePrice = (isAdmin && row.purchasePrice) ? parseFloat(row.purchasePrice) : 0.0;
        const sellingPrice = row.sellingPrice ? parseFloat(row.sellingPrice) : 0.0;

        const prod = await prisma.product.create({
          data: {
            name: row.name.trim(),
            sku,
            barcode,
            categoryId,
            brand: row.brand ? row.brand.trim() : 'Curated Art',
            description: row.description ? row.description.trim() : null,
            purchasePrice,
            sellingPrice,
            mrp: row.mrp ? parseFloat(row.mrp) : sellingPrice,
            gstRate: row.gstRate !== undefined ? parseFloat(row.gstRate) : 18.0,
            hsnCode: row.hsnCode ? String(row.hsnCode).trim() : '9701',
            currentStock,
            minStock: row.minStock ? parseInt(row.minStock, 10) : 5,
            unit: row.unit ? row.unit.trim().toUpperCase() : 'PCS',
            status: 'ACTIVE',
          },
        });

        if (currentStock > 0) {
          await prisma.stockMovement.create({
            data: {
              productId: prod.id,
              type: 'OPENING',
              quantity: currentStock,
              unitCost: purchasePrice,
              balanceAfter: currentStock,
              referenceType: 'BULK_IMPORT',
              notes: 'Imported via CSV/Excel migration',
              createdBy: req.user.name,
            },
          });
        }

        imported.push(prod);
      } catch (rowErr) {
        errors.push({ row: i + 1, error: rowErr.message });
      }
    }

    req.logAudit('BULK_IMPORT_PRODUCTS', 'PRODUCT', null, { importedCount: imported.length, errorsCount: errors.length });

    res.json({
      success: true,
      importedCount: imported.length,
      errorsCount: errors.length,
      errors,
    });
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Bulk import failed.' });
  }
});

// GET /api/products/export/csv - Export all products as CSV
router.get('/export/csv', optionalAuth, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    const isAdmin = req.user && req.user.role === 'ADMIN';

    const headers = [
      'ID',
      'Name',
      'SKU',
      'Barcode',
      'Category',
      'Brand',
      ...(isAdmin ? ['Purchase Price'] : []),
      'Selling Price',
      'MRP',
      'GST %',
      'HSN Code',
      'Current Stock',
      'Min Stock',
      'Unit',
      'Status',
    ];

    const rows = products.map((p) => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      p.sku,
      `'${p.barcode}'`,
      `"${(p.category?.name || '').replace(/"/g, '""')}"`,
      `"${(p.brand || '').replace(/"/g, '""')}"`,
      ...(isAdmin ? [p.purchasePrice] : []),
      p.sellingPrice,
      p.mrp,
      p.gstRate,
      p.hsnCode,
      p.currentStock,
      p.minStock,
      p.unit,
      p.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="curated_art_products.csv"');
    res.send(csvContent);
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'Failed to export products.' });
  }
});

// POST /api/products/sync-all - Queue all products for Zoho sync
router.post('/sync-all', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
    });

    let queuedCount = 0;
    for (const p of products) {
      const existingJob = await prisma.syncJob.findFirst({
        where: {
          localRecordId: p.id,
          entityType: 'PRODUCT',
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      });

      if (!existingJob) {
        await prisma.syncJob.create({
          data: {
            entityType: 'PRODUCT',
            localRecordId: p.id,
            operation: p.zohoItemId ? 'UPDATE' : 'CREATE',
            payload: JSON.stringify({
              name: p.name,
              sku: p.sku,
              rate: p.sellingPrice,
              purchase_rate: p.purchasePrice,
              hsn_or_sac: p.hsnCode,
              unit: p.unit,
              initial_stock: Math.max(0, p.currentStock),
            }),
            status: 'PENDING',
          },
        });
        queuedCount++;
      }
    }

    res.json({ message: `Queued ${queuedCount} products for Zoho sync.`, queuedCount });
  } catch (err) {
    console.error('Queue products error:', err);
    res.status(500).json({ error: 'Failed to queue products for sync: ' + err.message });
  }
});

module.exports = router;

