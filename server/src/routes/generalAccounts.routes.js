const express = require('express');
const prisma = require('../prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/general-accounts - List all General Ledger & Chart of Accounts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { group, type, search } = req.query;
    const where = {};

    if (group && group !== 'all') {
      where.accountGroup = group;
    }

    if (type && type !== 'all') {
      where.accountType = type;
    }

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim() } },
        { section: { contains: search.trim() } },
        { accountGroup: { contains: search.trim() } },
        { panNo: { contains: search.trim() } },
        { gstin: { contains: search.trim() } },
      ];
    }

    const accounts = await prisma.generalAccount.findMany({
      where,
      orderBy: [{ accountGroup: 'asc' }, { name: 'asc' }],
    });

    // Compute group summaries
    const allAccounts = await prisma.generalAccount.findMany({
      select: { id: true, accountGroup: true, accountType: true, openingBalance: true, currentBalance: true },
    });

    const groupCounts = {};
    allAccounts.forEach((acc) => {
      const g = acc.accountGroup || 'Other';
      groupCounts[g] = (groupCounts[g] || 0) + 1;
    });

    res.json({
      success: true,
      total: accounts.length,
      allTotal: allAccounts.length,
      groupCounts,
      accounts,
    });
  } catch (err) {
    console.error('Fetch general accounts error:', err);
    res.status(500).json({ error: 'Failed to retrieve general accounts: ' + err.message });
  }
});

// POST /api/general-accounts - Create a manual General Account
router.post('/', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const {
      name,
      section = 'General Ledger',
      accountGroup = 'General Ledger',
      accountType = 'GENERAL',
      openingBalance = 0,
      mobile,
      address,
      state = 'Gujarat',
      stateCode = '24',
      gstin,
      panNo,
      notes,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Account name is required.' });
    }

    const openBal = parseFloat(openingBalance || 0) || 0;

    const account = await prisma.generalAccount.create({
      data: {
        name: name.trim(),
        section: section ? section.trim() : 'General Ledger',
        accountGroup: accountGroup ? accountGroup.trim() : 'General Ledger',
        accountType: accountType || 'GENERAL',
        openingBalance: openBal,
        currentBalance: openBal,
        mobile: mobile ? mobile.trim() : null,
        address: address ? address.trim() : null,
        state: state || 'Gujarat',
        stateCode: stateCode || '24',
        gstin: gstin ? gstin.trim().toUpperCase() : null,
        panNo: panNo ? panNo.trim().toUpperCase() : null,
        notes: notes ? notes.trim() : null,
      },
    });

    res.status(201).json({ success: true, account });
  } catch (err) {
    console.error('Create general account error:', err);
    res.status(500).json({ error: 'Failed to create general account: ' + err.message });
  }
});

// PUT /api/general-accounts/:id - Update General Account
router.put('/:id', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, section, accountGroup, accountType, openingBalance, currentBalance, mobile, address, state, stateCode, gstin, panNo, notes, isActive } = req.body;

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (section !== undefined) data.section = section.trim();
    if (accountGroup !== undefined) data.accountGroup = accountGroup.trim();
    if (accountType !== undefined) data.accountType = accountType;
    if (openingBalance !== undefined) data.openingBalance = parseFloat(openingBalance) || 0;
    if (currentBalance !== undefined) data.currentBalance = parseFloat(currentBalance) || 0;
    if (mobile !== undefined) data.mobile = mobile ? mobile.trim() : null;
    if (address !== undefined) data.address = address ? address.trim() : null;
    if (state !== undefined) data.state = state;
    if (stateCode !== undefined) data.stateCode = stateCode;
    if (gstin !== undefined) data.gstin = gstin ? gstin.trim().toUpperCase() : null;
    if (panNo !== undefined) data.panNo = panNo ? panNo.trim().toUpperCase() : null;
    if (notes !== undefined) data.notes = notes;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.generalAccount.update({
      where: { id },
      data,
    });

    res.json({ success: true, account: updated });
  } catch (err) {
    console.error('Update general account error:', err);
    res.status(500).json({ error: 'Failed to update general account: ' + err.message });
  }
});

// DELETE /api/general-accounts/:id - Delete General Account
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.generalAccount.delete({ where: { id } });
    res.json({ success: true, message: 'General account deleted successfully.' });
  } catch (err) {
    console.error('Delete general account error:', err);
    res.status(500).json({ error: 'Failed to delete general account: ' + err.message });
  }
});

module.exports = router;

