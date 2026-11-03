const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { generateToken, authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials or account is inactive.' });
    }

    const isMatch = bcrypt.compareSync(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = generateToken(user);
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      entityType: 'USER',
      entityId: user.id,
      details: { role: user.role },
      ipAddress,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/users (ADMIN / MANAGER)
router.get('/users', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
});

// POST /api/auth/users (ADMIN only)
router.post('/users', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }

    const validRoles = ['ADMIN', 'MANAGER', 'BILLING', 'INVENTORY'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Allowed: ${validRoles.join(', ')}` });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const newUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        role,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    req.logAudit('CREATE_USER', 'USER', newUser.id, { email: newUser.email, role: newUser.role });

    res.status(201).json(newUser);
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// PATCH /api/auth/users/:id/toggle (ADMIN only)
router.patch('/users/:id/toggle', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own administrator account.' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !targetUser.isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    req.logAudit('TOGGLE_USER_STATUS', 'USER', id, { isActive: updated.isActive });

    res.json(updated);
  } catch (err) {
    console.error('Toggle user error:', err);
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

module.exports = router;

