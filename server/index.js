const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');

const { auditMiddleware } = require('./src/middleware/audit');
const authRoutes = require('./src/routes/auth.routes');
const businessRoutes = require('./src/routes/business.routes');
const productsRoutes = require('./src/routes/products.routes');
const inventoryRoutes = require('./src/routes/inventory.routes');
const posRoutes = require('./src/routes/pos.routes');
const customersRoutes = require('./src/routes/customers.routes');
const purchasesRoutes = require('./src/routes/purchases.routes');
const expensesRoutes = require('./src/routes/expenses.routes');
const reportsRoutes = require('./src/routes/reports.routes');
const backupRoutes = require('./src/routes/backup.routes');
const estimatesRoutes = require('./src/routes/estimates.routes');
const pricebooksRoutes = require('./src/routes/pricebooks.routes');
const exportRoutes = require('./src/routes/export.routes');
const generalAccountsRoutes = require('./src/routes/generalAccounts.routes');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(auditMiddleware);

// Static uploads directory (product images, receipts) with 7-day browser caching
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Curated Art ERP',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    mode: 'offline-first',
  });
});

// Network info endpoint for mobile phone pairing on local Wi-Fi
app.get('/api/network-info', (req, res) => {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          interface: name,
          ip: iface.address,
          url: `http://${iface.address}:${PORT}`,
        });
      }
    }
  }

  const primary = addresses.find((a) => a.interface === 'en0') || addresses[0] || {
    interface: 'localhost',
    ip: '127.0.0.1',
    url: `http://localhost:${PORT}`,
  };

  res.json({
    port: PORT,
    primaryUrl: primary.url,
    primaryIp: primary.ip,
    addresses,
  });
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/estimates', estimatesRoutes);
app.use('/api/pricebooks', pricebooksRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/general-accounts', generalAccountsRoutes);

// Serve static client build with optimized HTTP cache controls
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath, {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    // HTML index should revalidate so client gets software updates immediately
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));
app.use('/assets', express.static(path.join(distPath, 'assets'), {
  maxAge: '1y',
  immutable: true,
}));

// Ensure assets are served even when loaded from nested SPA routes (e.g. /invoices/assets/...)
app.use((req, res, next) => {
  if (req.path.includes('/assets/')) {
    const filename = req.path.split('/assets/').pop();
    const assetPath = path.join(distPath, 'assets', filename);
    const fs = require('fs');
    if (fs.existsSync(assetPath)) {
      return res.sendFile(assetPath);
    }
  }
  next();
});

// SPA fallback for client-side routing
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const { startBackupScheduler } = require('./src/services/backupScheduler');

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Curated Art ERP Server listening on port ${PORT} (0.0.0.0)`);
    console.log(`Local Access: http://localhost:${PORT}`);
    const os = require('os');
    const ifaces = os.networkInterfaces();
    for (const name in ifaces) {
      for (const iface of ifaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`Mobile / LAN Access (${name}): http://${iface.address}:${PORT}`);
        }
      }
    }
    console.log(`Health endpoint: http://localhost:${PORT}/api/health`);
    
    // Start automated daily backup scheduler
    startBackupScheduler();
  });
}

module.exports = app;
