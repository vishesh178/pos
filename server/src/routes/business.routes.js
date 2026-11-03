const express = require('express');
const prisma = require('../prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/business/profile
router.get('/profile', async (req, res) => {
  try {
    let profile = await prisma.businessProfile.findFirst();
    if (!profile) {
      profile = await prisma.businessProfile.create({
        data: {
          id: 'curated-art-main',
          businessName: 'Curated Art',
          legalName: 'Curated Art Luxury Decor Pvt Ltd',
          gstin: '24AAAAA0000A1Z5',
          state: 'Gujarat',
          stateCode: '24',
          address: 'Showroom #104, Design District, SG Highway, Ahmedabad, Gujarat - 380054',
          phone: '+91 98765 43210',
          email: 'contact@curatedart.in',
          currency: 'INR',
          currencySymbol: '₹',
          invoicePrefix: 'CA-',
          invoiceNextNumber: 1001,
          thermalWidth: '80mm',
        },
      });
    }
    res.json(profile);
  } catch (err) {
    console.error('Fetch business profile error:', err);
    res.status(500).json({ error: 'Failed to retrieve business profile.' });
  }
});

// PUT /api/business/profile (ADMIN or MANAGER)
router.put('/profile', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const existing = await prisma.businessProfile.findFirst();
    const id = existing ? existing.id : 'curated-art-main';

    const {
      businessName,
      legalName,
      gstin,
      state,
      stateCode,
      address,
      phone,
      email,
      currency,
      currencySymbol,
      invoicePrefix,
      invoiceNextNumber,
      thermalWidth,
      termsAndConditions,
    } = req.body;

    const updated = await prisma.businessProfile.upsert({
      where: { id },
      update: {
        businessName,
        legalName,
        gstin,
        state,
        stateCode,
        address,
        phone,
        email,
        currency,
        currencySymbol,
        invoicePrefix,
        invoiceNextNumber: invoiceNextNumber ? parseInt(invoiceNextNumber, 10) : undefined,
        thermalWidth,
        termsAndConditions,
      },
      create: {
        id,
        businessName: businessName || 'Curated Art',
        legalName: legalName || 'Curated Art Luxury Decor Pvt Ltd',
        gstin: gstin || '24AAAAA0000A1Z5',
        state: state || 'Gujarat',
        stateCode: stateCode || '24',
        address: address || 'Showroom #104, Design District, SG Highway, Ahmedabad, Gujarat - 380054',
        phone: phone || '+91 98765 43210',
        email: email || 'contact@curatedart.in',
        currency: currency || 'INR',
        currencySymbol: currencySymbol || '₹',
        invoicePrefix: invoicePrefix || 'CA-',
        invoiceNextNumber: invoiceNextNumber ? parseInt(invoiceNextNumber, 10) : 1001,
        thermalWidth: thermalWidth || '80mm',
        termsAndConditions,
      },
    });

    req.logAudit('UPDATE_BUSINESS_PROFILE', 'BUSINESS_PROFILE', updated.id, { businessName: updated.businessName, gstin: updated.gstin });

    res.json(updated);
  } catch (err) {
    console.error('Update business profile error:', err);
    res.status(500).json({ error: 'Failed to update business profile.' });
  }
});

module.exports = router;

