const prisma = require('../prisma');

async function resetNegativeStock() {
  console.log('--- RESETTING NEGATIVE INVENTORY STOCKS TO 0 ---');
  
  const beforeCount = await prisma.product.count({
    where: { currentStock: { lt: 0 } },
  });
  
  console.log(`Found ${beforeCount} products with negative stock.`);

  const updateResult = await prisma.product.updateMany({
    where: { currentStock: { lt: 0 } },
    data: { currentStock: 0.0 },
  });

  console.log(`Successfully updated ${updateResult.count} products to currentStock = 0.`);

  // Verify new inventory metrics
  const products = await prisma.product.findMany({
    select: {
      currentStock: true,
      minStock: true,
      purchasePrice: true,
      sellingPrice: true,
    },
  });

  let totalStockUnits = 0;
  let totalCost = 0;
  let totalRetail = 0;
  let outOfStock = 0;
  let lowStock = 0;

  for (const p of products) {
    totalStockUnits += p.currentStock;
    totalCost += p.currentStock * p.purchasePrice;
    totalRetail += p.currentStock * p.sellingPrice;
    if (p.currentStock <= 0) {
      outOfStock++;
    } else if (p.currentStock <= p.minStock) {
      lowStock++;
    }
  }

  console.log('\n--- NEW INVENTORY OVERVIEW ---');
  console.log(`Total Products: ${products.length}`);
  console.log(`Total Stock Quantity: ${totalStockUnits.toLocaleString('en-IN')} Units`);
  console.log(`Valuation (At Cost): ₹${Math.round(totalCost).toLocaleString('en-IN')}`);
  console.log(`Valuation (At Retail): ₹${Math.round(totalRetail).toLocaleString('en-IN')}`);
  console.log(`Out of Stock: ${outOfStock}`);
  console.log(`Low Stock: ${lowStock}`);
}

resetNegativeStock()
  .catch((err) => {
    console.error('Error running reset:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

