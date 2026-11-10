const express = require('express');
const prisma = require('../prisma');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/dashboard - Live KPI calculations from real database queries
router.get('/dashboard', optionalAuth, async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Sales metrics
    const allInvoices = await prisma.invoice.findMany({
      where: { status: 'COMPLETED' },
      include: {
        items: {
          include: {
            product: { select: { purchasePrice: true } },
          },
        },
      },
    });

    let todaySales = 0;
    let monthSales = 0;
    let totalRevenue = 0;
    let totalCogs = 0;

    for (const inv of allInvoices) {
      const invDate = new Date(inv.createdAt);
      totalRevenue += inv.grandTotal;

      if (invDate >= startOfToday) {
        todaySales += inv.grandTotal;
      }
      if (invDate >= startOfMonth) {
        monthSales += inv.grandTotal;
      }

      // Compute COGS
      for (const it of inv.items) {
        const cost = it.product?.purchasePrice || (it.unitPrice * 0.5); // Fallback to 50% if unlinked
        totalCogs += it.quantity * cost;
      }
    }

    const grossProfit = Math.round((totalRevenue - totalCogs) * 100) / 100;

    // 2. Expenses metrics
    const allExpenses = await prisma.expense.findMany();
    const totalExpenses = allExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfitEstimate = Math.round((grossProfit - totalExpenses) * 100) / 100;

    // 3. Products & Stock Counts
    const products = await prisma.product.findMany({
      select: { currentStock: true, minStock: true },
    });
    const totalProducts = products.length;
    let lowStockProducts = 0;
    let outOfStockProducts = 0;

    for (const p of products) {
      if (p.currentStock <= 0) outOfStockProducts++;
      else if (p.currentStock <= p.minStock) lowStockProducts++;
    }

    // 4. Entity Counts
    const totalCustomers = await prisma.customer.count();
    const totalSuppliers = await prisma.supplier.count();
    const pendingPurchaseOrders = await prisma.purchaseOrder.count({
      where: { status: 'ISSUED' },
    });

    // 5. Recent 6 Transactions
    const recentTransactions = await prisma.invoice.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        grandTotal: true,
        paymentStatus: true,
        paymentMethod: true,
        createdAt: true,
      },
    });

    // 6. Top Selling Products
    const itemAgg = {};
    for (const inv of allInvoices) {
      for (const it of inv.items) {
        if (!itemAgg[it.productName]) {
          itemAgg[it.productName] = { name: it.productName, sku: it.sku, quantity: 0, revenue: 0 };
        }
        itemAgg[it.productName].quantity += it.quantity;
        itemAgg[it.productName].revenue += it.totalAmount;
      }
    }
    const topProducts = Object.values(itemAgg)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // 7. Last 7 Days Daily Sales Chart Data
    const salesChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

      const dayInvoices = allInvoices.filter((inv) => {
        const invDate = new Date(inv.createdAt);
        return invDate >= dayStart && invDate <= dayEnd;
      });

      const dayTotal = dayInvoices.reduce((s, inv) => s + inv.grandTotal, 0);
      salesChart.push({
        date: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
        sales: dayTotal,
      });
    }

    // 8. Expense Distribution Chart Data
    const expCatMap = {};
    allExpenses.forEach((e) => {
      expCatMap[e.category] = (expCatMap[e.category] || 0) + e.amount;
    });
    const expenseChart = Object.entries(expCatMap).map(([name, value]) => ({ name, value }));

    const isAdmin = req.user && req.user.role === 'ADMIN';

    res.json({
      todaySales: Math.round(todaySales * 100) / 100,
      monthlySales: Math.round(monthSales * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      grossProfit: isAdmin ? grossProfit : null,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfitEstimate: isAdmin ? netProfitEstimate : null,
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      totalCustomers,
      totalSuppliers,
      pendingPurchaseOrders,
      recentTransactions,
      topProducts,
      salesChart,
      expenseChart,
      syncHealth: {
        failed: 0,
        pending: 0,
        status: 'ONLINE',
      },
    });
  } catch (err) {
    console.error('Fetch dashboard error:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard reports.' });
  }
});

// GET /api/reports/gst - Comprehensive Indian GST Reports (GSTR-1 & GSTR-3B)
router.get('/gst', async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { status: 'COMPLETED' },
      include: { items: true },
    });

    const bills = await prisma.purchaseBill.findMany();

    // 1. GSTR-1 HSN Summary
    const hsnMap = {};
    let b2cTaxable = 0;
    let b2cTax = 0;
    let b2bTaxable = 0;
    let b2bTax = 0;

    for (const inv of invoices) {
      const isB2B = !!(inv.customerGstin && inv.customerGstin.trim());
      if (isB2B) {
        b2bTaxable += inv.subtotal;
        b2bTax += inv.taxTotal;
      } else {
        b2cTaxable += inv.subtotal;
        b2cTax += inv.taxTotal;
      }

      for (const it of inv.items) {
        const hsn = it.hsnCode || '9701';
        if (!hsnMap[hsn]) {
          hsnMap[hsn] = {
            hsnCode: hsn,
            description: it.productName,
            totalQuantity: 0,
            taxableValue: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            totalTax: 0,
          };
        }
        hsnMap[hsn].totalQuantity += it.quantity;
        hsnMap[hsn].taxableValue += it.taxableAmount;
        hsnMap[hsn].cgstAmount += it.cgstAmount;
        hsnMap[hsn].sgstAmount += it.sgstAmount;
        hsnMap[hsn].igstAmount += it.igstAmount;
        hsnMap[hsn].totalTax += it.taxAmount;
      }
    }

    const hsnSummary = Object.values(hsnMap).map((h) => ({
      ...h,
      taxableValue: Math.round(h.taxableValue * 100) / 100,
      cgstAmount: Math.round(h.cgstAmount * 100) / 100,
      sgstAmount: Math.round(h.sgstAmount * 100) / 100,
      igstAmount: Math.round(h.igstAmount * 100) / 100,
      totalTax: Math.round(h.totalTax * 100) / 100,
    }));

    // 2. GSTR-3B Output vs Inward ITC
    const outputTax = invoices.reduce((sum, inv) => sum + inv.taxTotal, 0);
    const inputTaxCredit = bills.reduce((sum, b) => sum + b.taxTotal, 0);
    const netGstPayable = Math.max(0, Math.round((outputTax - inputTaxCredit) * 100) / 100);

    res.json({
      gstr1: {
        b2c: { taxableValue: Math.round(b2cTaxable * 100) / 100, taxAmount: Math.round(b2cTax * 100) / 100 },
        b2b: { taxableValue: Math.round(b2bTaxable * 100) / 100, taxAmount: Math.round(b2bTax * 100) / 100 },
        hsnSummary,
      },
      gstr3b: {
        outputTaxLiability: Math.round(outputTax * 100) / 100,
        inputTaxCredit: Math.round(inputTaxCredit * 100) / 100,
        netTaxPayable: netGstPayable,
      },
    });
  } catch (err) {
    console.error('Fetch GST report error:', err);
    res.status(500).json({ error: 'Failed to retrieve GST reports.' });
  }
});

// GET /api/reports/sales-summary - Filtered Sales by Period (Daily, Weekly, Monthly, Yearly, Custom)
router.get('/sales-summary', async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;
    const now = new Date();
    let start, end;

    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (period === 'week') {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end = now;
    } else if (period === 'year') {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      end = now;
    } else {
      // month default
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = now;
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: start, lte: end },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalRevenue = 0;
    let totalTaxable = 0;
    let totalTax = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalDiscount = 0;
    let totalQuantity = 0;
    const payments = { CASH: 0, UPI: 0, CARD: 0, SPLIT: 0 };
    const paymentsCount = { CASH: 0, UPI: 0, CARD: 0, SPLIT: 0 };

    for (const inv of invoices) {
      totalRevenue += inv.grandTotal;
      totalTaxable += inv.subtotal;
      totalTax += inv.taxTotal;
      totalCgst += inv.cgstTotal;
      totalSgst += inv.sgstTotal;
      totalIgst += inv.igstTotal;
      totalDiscount += inv.discountTotal;

      const pMethod = inv.paymentMethod || 'CASH';
      payments[pMethod] = (payments[pMethod] || 0) + inv.paidAmount;
      paymentsCount[pMethod] = (paymentsCount[pMethod] || 0) + 1;

      for (const it of inv.items) {
        totalQuantity += it.quantity;
      }
    }

    res.json({
      period,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalInvoices: invoices.length,
      totalQuantity,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalTaxable: Math.round(totalTaxable * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalCgst: Math.round(totalCgst * 100) / 100,
      totalSgst: Math.round(totalSgst * 100) / 100,
      totalIgst: Math.round(totalIgst * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      payments: {
        CASH: Math.round(payments.CASH * 100) / 100,
        UPI: Math.round(payments.UPI * 100) / 100,
        CARD: Math.round(payments.CARD * 100) / 100,
        SPLIT: Math.round(payments.SPLIT * 100) / 100,
      },
      paymentsCount,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        date: inv.createdAt,
        itemsCount: inv.items.length,
        grandTotal: inv.grandTotal,
        paymentMethod: inv.paymentMethod,
        paymentStatus: inv.paymentStatus,
      })),
    });
  } catch (err) {
    console.error('Fetch sales summary error:', err);
    res.status(500).json({ error: 'Failed to retrieve sales summary.' });
  }
});

// GET /api/reports/product-profitability - Product-wise Gross Profit & Margin
router.get('/product-profitability', optionalAuth, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: { select: { name: true } },
        invoiceItems: {
          select: {
            quantity: true,
            unitPrice: true,
            taxableAmount: true,
            totalAmount: true,
            discountAmount: true,
          },
        },
      },
    });

    const isAdmin = req.user && req.user.role === 'ADMIN';

    const report = products
      .map((p) => {
        let unitsSold = 0;
        let revenue = 0;
        for (const it of p.invoiceItems) {
          unitsSold += it.quantity;
          revenue += it.totalAmount;
        }
        const cogs = unitsSold * p.purchasePrice;
        const profit = Math.round((revenue - cogs) * 100) / 100;
        const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          category: p.category?.name || 'Uncategorized',
          currentStock: p.currentStock,
          minStock: p.minStock,
          purchasePrice: isAdmin ? p.purchasePrice : null,
          sellingPrice: p.sellingPrice,
          unitsSold,
          totalRevenue: Math.round(revenue * 100) / 100,
          totalCogs: isAdmin ? Math.round(cogs * 100) / 100 : null,
          grossProfit: isAdmin ? profit : null,
          marginPercent: isAdmin ? margin : null,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json(report);
  } catch (err) {
    console.error('Fetch product profitability error:', err);
    res.status(500).json({ error: 'Failed to retrieve product profitability.' });
  }
});

// GET /api/reports/category-sales - Category revenue share & contribution
router.get('/category-sales', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        products: {
          include: {
            invoiceItems: {
              select: {
                quantity: true,
                totalAmount: true,
              },
            },
          },
        },
      },
    });

    let overallRevenue = 0;
    const catData = categories.map((cat) => {
      let unitsSold = 0;
      let revenue = 0;
      for (const prod of cat.products) {
        for (const it of prod.invoiceItems) {
          unitsSold += it.quantity;
          revenue += it.totalAmount;
        }
      }
      overallRevenue += revenue;
      return {
        id: cat.id,
        name: cat.name,
        productsCount: cat.products.length,
        unitsSold,
        revenue: Math.round(revenue * 100) / 100,
      };
    });

    const report = catData
      .map((c) => ({
        ...c,
        sharePercent: overallRevenue > 0 ? Math.round((c.revenue / overallRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    res.json({
      overallRevenue: Math.round(overallRevenue * 100) / 100,
      categories: report,
    });
  } catch (err) {
    console.error('Fetch category sales error:', err);
    res.status(500).json({ error: 'Failed to retrieve category sales.' });
  }
});

// GET /api/reports/outstandings - Customer and Supplier Outstandings
router.get('/outstandings', async (req, res) => {
  try {
    const rawCustomers = await prisma.customer.findMany({
      include: {
        invoices: {
          select: { grandTotal: true },
        },
      },
      orderBy: { currentBalance: 'desc' },
    });

    const customers = rawCustomers
      .map((c) => {
        const totalPurchases = c.invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
        return {
          id: c.id,
          name: c.name,
          mobile: c.mobile,
          gstin: c.gstin,
          customerType: c.customerType,
          totalPurchases: Math.round(totalPurchases * 100) / 100,
          outstandingBalance: Math.round(c.currentBalance * 100) / 100,
          updatedAt: c.updatedAt,
        };
      })
      .filter((c) => c.outstandingBalance > 0);

    const rawSuppliers = await prisma.supplier.findMany({
      orderBy: { currentBalance: 'desc' },
    });

    const suppliers = rawSuppliers
      .map((s) => ({
        id: s.id,
        name: s.name,
        contactPerson: s.contactPerson,
        mobile: s.mobile,
        gstin: s.gstin,
        outstandingBalance: Math.round(s.currentBalance * 100) / 100,
        updatedAt: s.updatedAt,
      }))
      .filter((s) => s.outstandingBalance > 0);

    const totalCustomerOutstanding = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);
    const totalSupplierOutstanding = suppliers.reduce((sum, s) => sum + s.outstandingBalance, 0);

    res.json({
      totalCustomerOutstanding: Math.round(totalCustomerOutstanding * 100) / 100,
      totalSupplierOutstanding: Math.round(totalSupplierOutstanding * 100) / 100,
      customers,
      suppliers,
    });
  } catch (err) {
    console.error('Fetch outstandings error:', err);
    res.status(500).json({ error: 'Failed to retrieve outstandings.' });
  }
});

module.exports = router;

