const express = require('express');
const prisma = require('../prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/expenses - List expenses with category & month filter
router.get('/', async (req, res) => {
  try {
    const { category, month, year } = req.query;
    const where = {};

    if (category && category !== 'all') {
      where.category = category;
    }

    if (year) {
      const y = parseInt(year, 10);
      const m = month ? parseInt(month, 10) - 1 : 0;
      const start = new Date(y, m, 1);
      const end = month ? new Date(y, m + 1, 0, 23, 59, 59) : new Date(y, 11, 31, 23, 59, 59);
      where.expenseDate = { gte: start, lte: end };
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
    });

    res.json(expenses);
  } catch (err) {
    console.error('Fetch expenses error:', err);
    res.status(500).json({ error: 'Failed to retrieve expenses.' });
  }
});

// POST /api/expenses - Record new expense & enqueue Zoho Books Expense Sync
router.post('/', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const {
      category,
      title,
      description,
      amount,
      taxRate,
      paymentMethod,
      receiptUrl,
      expenseDate,
    } = req.body;

    if (!category || !title || amount === undefined || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Expense category, title, and positive amount are required.' });
    }

    const expenseAmt = parseFloat(amount);
    const tax = taxRate ? parseFloat(taxRate) : 0.0;
    const taxAmt = (expenseAmt * tax) / 100;

    const expense = await prisma.$transaction(async (tx) => {
      const newExp = await tx.expense.create({
        data: {
          category: category.trim(),
          title: title.trim(),
          description: description ? description.trim() : null,
          amount: expenseAmt,
          taxRate: tax,
          taxAmount: taxAmt,
          paymentMethod: paymentMethod || 'BANK_TRANSFER',
          receiptUrl: receiptUrl || null,
          expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
          createdBy: req.user.name,
          zohoSyncStatus: 'PENDING',
        },
      });

      // Enqueue Zoho Books Expense
      await tx.syncJob.create({
        data: {
          entityType: 'EXPENSE',
          localRecordId: newExp.id,
          operation: 'CREATE',
          payload: JSON.stringify({
            account_name: newExp.category,
            date: newExp.expenseDate.toISOString().split('T')[0],
            amount: newExp.amount,
            description: `${newExp.title}: ${newExp.description || ''}`,
            paid_through_account_name: newExp.paymentMethod === 'CASH' ? 'Petty Cash' : 'Undeposited Funds',
          }),
          status: 'PENDING',
        },
      });

      return newExp;
    });

    req.logAudit('CREATE_EXPENSE', 'EXPENSE', expense.id, { title: expense.title, amount: expense.amount });
    res.status(201).json(expense);
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ error: 'Failed to record expense.' });
  }
});

// DELETE /api/expenses/:id - Delete expense
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.expense.delete({ where: { id } });
    req.logAudit('DELETE_EXPENSE', 'EXPENSE', id, {});
    res.json({ message: 'Expense deleted successfully.' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Failed to delete expense.' });
  }
});

module.exports = router;

