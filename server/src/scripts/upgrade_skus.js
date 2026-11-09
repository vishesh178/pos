const prisma = require('../prisma');
const { generateSmartSku } = require('../utils/barcode');

async function upgradeAllSkus() {
  console.log('--- Starting SKU Upgrade to Smart [Dept]-[Code]-[Tier] ---');
  
  const products = await prisma.product.findMany({
    include: { category: true }
  });

  console.log(`Found ${products.length} total products in database.`);
  
  let updatedCount = 0;
  const usedSkus = new Set();

  // Track existing smart SKUs
  for (const p of products) {
    if (p.sku && !p.sku.startsWith('CA-')) {
      usedSkus.add(p.sku);
    }
  }

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const isLegacy = p.sku.startsWith('CA-') || !p.sku.includes('-');
    
    if (isLegacy) {
      let newSku = generateSmartSku(p.name, p.category?.name || 'General', i + 1);
      
      // Handle collision if any
      let counter = 1;
      let finalSku = newSku;
      while (usedSkus.has(finalSku)) {
        finalSku = `${newSku}-${counter}`;
        counter++;
      }
      
      usedSkus.add(finalSku);

      await prisma.product.update({
        where: { id: p.id },
        data: { sku: finalSku }
      });

      console.log(`[UPDATED] "${p.name}": ${p.sku} -> ${finalSku}`);
      updatedCount++;
    }
  }

  console.log(`\nSuccessfully upgraded ${updatedCount} legacy SKUs to Smart Format!`);
  await prisma.$disconnect();
}

if (require.main === module) {
  upgradeAllSkus().catch((err) => {
    console.error('Upgrade failed:', err);
    process.exit(1);
  });
}

module.exports = { upgradeAllSkus };
