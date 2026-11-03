const bcrypt = require('bcryptjs');
const prisma = require('../src/prisma');

async function seed() {
  console.log('Seeding Curated Art ERP database...');

  // 1. Business Profile
  const existingProfile = await prisma.businessProfile.findFirst();
  if (!existingProfile) {
    await prisma.businessProfile.create({
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
        termsAndConditions: '1. Goods once sold can only be exchanged within 7 days in original packing.\n2. Fragile items (glass, mirrors) must be inspected at the time of delivery.\n3. All disputes subject to Ahmedabad jurisdiction.',
      },
    });
    console.log('✓ Business Profile initialized');
  }

  // 2. Default ZohoConfig
  const existingZoho = await prisma.zohoConfig.findUnique({ where: { id: 'default' } });
  if (!existingZoho) {
    await prisma.zohoConfig.create({
      data: {
        id: 'default',
        dcDomain: 'in',
        isConnected: false,
        autoSyncEnabled: true,
      },
    });
    console.log('✓ Default Zoho configuration initialized');
  }

  // 3. Users with standard passwords (admin123, manager123, cashier123)
  const users = [
    {
      name: 'Viren Shah (Owner/Admin)',
      email: 'admin@curatedart.in',
      password: 'admin123',
      role: 'ADMIN',
    },
    {
      name: 'Priya Joshi (Store Manager)',
      email: 'manager@curatedart.in',
      password: 'manager123',
      role: 'MANAGER',
    },
    {
      name: 'Rohan Mehta (Billing Staff)',
      email: 'cashier@curatedart.in',
      password: 'cashier123',
      role: 'BILLING',
    },
  ];

  for (const u of users) {
    const passwordHash = bcrypt.hashSync(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        passwordHash,
        isActive: true,
      },
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        isActive: true,
      },
    });
  }
  console.log('✓ Standard Users seeded (admin123, manager123, cashier123)');

  // 4. Default Categories
  const categories = [
    { name: 'Metal Wall Art', description: 'Handcrafted luxury metal wall art pieces and panels' },
    { name: 'Wall Clocks', description: 'Designer minimalist and antique brass wall clocks' },
    { name: 'Ceramic Planters', description: 'Premium ceramic and fluted planters with brass stands' },
    { name: 'Showpieces & Sculptures', description: 'Artisanal brass, resin, and stone sculptures' },
    { name: 'Framed Canvas Art', description: 'Museum quality framed abstract and botanical canvases' },
    { name: 'Artificial Flowers', description: 'Lifelike silk and velvet floral arrangements' },
    { name: 'Decorative Pots & Urns', description: 'Rustic terracotta and glazed porcelain urns' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log('✓ Home décor categories initialized');

  console.log('Database seeding completed successfully.');
}

if (require.main === module) {
  seed()
    .catch((e) => {
      console.error('Seed error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = seed;

