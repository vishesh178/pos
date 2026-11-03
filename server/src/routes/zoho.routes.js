const express = require('express');
const prisma = require('../prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { encrypt } = require('../utils/crypto');
const zohoAuth = require('../services/zohoAuthService');
const zohoApi = require('../services/zohoApiService');
const zohoSync = require('../services/zohoSyncService');

const router = express.Router();

// GET /api/zoho/config - Safe connection status (secrets never exposed)
router.get('/config', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const config = await prisma.zohoConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return res.json({
        isConnected: false,
        autoSyncEnabled: true,
        dcDomain: 'in',
        clientId: null,
        organizationId: null,
      });
    }

    res.json({
      isConnected: config.isConnected,
      clientId: config.clientId,
      hasClientSecret: !!config.clientSecretEncrypted,
      hasRefreshToken: !!config.refreshTokenEncrypted,
      organizationId: config.organizationId,
      dcDomain: config.dcDomain,
      autoSyncEnabled: config.autoSyncEnabled,
      lastSyncAt: config.lastSyncAt,
      tokenExpiresAt: config.tokenExpiresAt,
    });
  } catch (err) {
    console.error('Fetch zoho config error:', err);
    res.status(500).json({ error: 'Failed to retrieve Zoho configuration.' });
  }
});

// POST /api/zoho/config - Update Zoho credentials & organization ID (ADMIN only)
router.post('/config', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { clientId, clientSecret, organizationId, autoSyncEnabled } = req.body;

    const dataToUpdate = {};
    if (clientId !== undefined) dataToUpdate.clientId = clientId.trim();
    if (clientSecret && clientSecret.trim()) {
      dataToUpdate.clientSecretEncrypted = encrypt(clientSecret.trim());
    }
    if (organizationId !== undefined) dataToUpdate.organizationId = organizationId.trim();
    if (autoSyncEnabled !== undefined) dataToUpdate.autoSyncEnabled = !!autoSyncEnabled;

    const config = await prisma.zohoConfig.upsert({
      where: { id: 'default' },
      update: dataToUpdate,
      create: {
        id: 'default',
        clientId: clientId ? clientId.trim() : null,
        clientSecretEncrypted: clientSecret ? encrypt(clientSecret.trim()) : null,
        organizationId: organizationId ? organizationId.trim() : null,
        autoSyncEnabled: autoSyncEnabled !== undefined ? !!autoSyncEnabled : true,
        dcDomain: 'in',
      },
    });

    req.logAudit('UPDATE_ZOHO_CONFIG', 'ZOHO_CONFIG', 'default', {
      clientId: config.clientId,
      organizationId: config.organizationId,
      autoSyncEnabled: config.autoSyncEnabled,
    });

    res.json({
      success: true,
      message: 'Zoho configuration updated securely.',
    });
  } catch (err) {
    console.error('Save zoho config error:', err);
    res.status(500).json({ error: 'Failed to save Zoho configuration.' });
  }
});

// GET /api/zoho/auth-url - Generate OAuth Authorization URL
router.get('/auth-url', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const config = await prisma.zohoConfig.findUnique({ where: { id: 'default' } });
    if (!config || !config.clientId) {
      return res.status(400).json({ error: 'Please enter and save your Zoho Client ID first.' });
    }

    const defaultRedirectUri = process.env.ZOHO_REDIRECT_URI || 'http://localhost:5001/api/zoho/callback';
    const redirectUri = req.query.redirectUri || defaultRedirectUri;
    const url = zohoAuth.getAuthorizationUrl({
      clientId: config.clientId,
      redirectUri,
    });

    res.json({ url, redirectUri });
  } catch (err) {
    console.error('Generate auth url error:', err);
    res.status(500).json({ error: 'Failed to generate authorization URL: ' + err.message });
  }
});

// GET /api/zoho/callback - Browser redirect endpoint directly from Zoho OAuth
router.get('/callback', async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Zoho Connection Failed</title></head>
        <body style="background:#090a0f;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;background:#161820;padding:40px;border-radius:16px;border:1px solid #7f1d1d;max-width:480px;">
            <div style="font-size:40px;color:#f43f5e;margin-bottom:12px;">✕</div>
            <h2 style="color:#f43f5e;margin:0 0 8px 0;">Zoho Authorization Denied</h2>
            <p style="color:#94a3b8;font-size:14px;margin-bottom:20px;">${error}</p>
            <button onclick="window.close()" style="background:#272a38;color:#f8fafc;padding:8px 20px;border:none;border-radius:6px;cursor:pointer;">Close</button>
          </div>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send('Authorization code missing.');
  }

  try {
    const config = await prisma.zohoConfig.findUnique({ where: { id: 'default' } });
    if (!config || !config.clientId || !config.clientSecretEncrypted) {
      throw new Error('Zoho Client ID and Secret must be configured in Curated Art ERP first.');
    }

    const { decrypt } = require('../utils/crypto');
    const clientSecret = decrypt(config.clientSecretEncrypted);
    const redirectUri = process.env.ZOHO_REDIRECT_URI || 'http://localhost:5001/api/zoho/callback';

    await zohoAuth.exchangeCodeForTokens({
      code,
      clientId: config.clientId,
      clientSecret,
      redirectUri,
    });

    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Zoho Connected</title></head>
        <body style="background:#090a0f;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;background:#161820;padding:40px;border-radius:16px;border:1px solid #272a38;max-width:480px;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
            <div style="font-size:48px;color:#10b981;margin-bottom:12px;">✓</div>
            <h2 style="color:#d97706;margin:0 0 8px 0;font-size:22px;letter-spacing:0.5px;">Connected to Zoho Successfully</h2>
            <p style="color:#94a3b8;font-size:14px;margin-bottom:24px;">Curated Art ERP is now authenticated with Zoho Inventory & Books (India DC).</p>
            <p style="color:#64748b;font-size:12px;margin-bottom:20px;">This window will close automatically...</p>
            <button onclick="window.close()" style="background:#d97706;color:#090a0f;font-weight:bold;padding:10px 24px;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Done</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'ZOHO_AUTH_SUCCESS' }, '*');
              setTimeout(() => { window.close(); }, 2000);
            }
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Zoho OAuth callback error:', err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Zoho Connection Failed</title></head>
        <body style="background:#090a0f;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;background:#161820;padding:40px;border-radius:16px;border:1px solid #7f1d1d;max-width:480px;">
            <div style="font-size:40px;color:#f43f5e;margin-bottom:12px;">✕</div>
            <h2 style="color:#f43f5e;margin:0 0 8px 0;">Token Exchange Failed</h2>
            <p style="color:#94a3b8;font-size:14px;margin-bottom:20px;">${err.message}</p>
            <button onclick="window.close()" style="background:#272a38;color:#f8fafc;padding:8px 20px;border:none;border-radius:6px;cursor:pointer;">Close</button>
          </div>
        </body>
      </html>
    `);
  }
});

// POST /api/zoho/callback - Exchange authorization code for tokens (manual / programmatic)
router.post('/callback', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required.' });
    }

    const config = await prisma.zohoConfig.findUnique({ where: { id: 'default' } });
    if (!config || !config.clientId || !config.clientSecretEncrypted) {
      return res.status(400).json({ error: 'Zoho Client ID and Secret must be configured first.' });
    }

    const { decrypt } = require('../utils/crypto');
    const clientSecret = decrypt(config.clientSecretEncrypted);
    const targetRedirectUri = redirectUri || process.env.ZOHO_REDIRECT_URI || 'http://localhost:5001/api/zoho/callback';

    const result = await zohoAuth.exchangeCodeForTokens({
      code,
      clientId: config.clientId,
      clientSecret,
      redirectUri: targetRedirectUri,
    });

    req.logAudit('ZOHO_OAUTH_CONNECTED', 'ZOHO_CONFIG', 'default', {});
    res.json({ success: true, message: 'Connected to Zoho successfully!' });
  } catch (err) {
    console.error('Zoho callback error:', err);
    res.status(500).json({ error: 'OAuth exchange failed: ' + err.message });
  }
});

// GET /api/zoho/organizations - Fetch organizations from Zoho API
router.get('/organizations', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const orgs = await zohoApi.listOrganizations();
    res.json(orgs);
  } catch (err) {
    console.error('List organizations error:', err);
    res.status(500).json({ error: 'Failed to fetch organizations: ' + err.message });
  }
});

// POST /api/zoho/test - Test live connection
router.post('/test', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const orgs = await zohoApi.listOrganizations();
    res.json({
      success: true,
      message: `Successfully connected to Zoho India Data Center. Found ${orgs.length} organization(s).`,
      organizations: orgs.map((o) => ({ id: o.organization_id, name: o.name, currency: o.currency_code })),
    });
  } catch (err) {
    console.error('Test connection error:', err);
    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

// GET /api/zoho/jobs - Live Outbox Sync Jobs Queue
router.get('/jobs', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const where = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const jobs = await prisma.syncJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
    });

    const statusCounts = {
      pending: await prisma.syncJob.count({ where: { status: 'PENDING' } }),
      processing: await prisma.syncJob.count({ where: { status: 'PROCESSING' } }),
      synced: await prisma.syncJob.count({ where: { status: 'SYNCED' } }),
      failed: await prisma.syncJob.count({ where: { status: 'FAILED' } }),
      retryScheduled: await prisma.syncJob.count({ where: { status: 'RETRY_SCHEDULED' } }),
    };

    res.json({ jobs, statusCounts });
  } catch (err) {
    console.error('Fetch sync jobs error:', err);
    res.status(500).json({ error: 'Failed to retrieve sync queue.' });
  }
});

// POST /api/zoho/jobs/:id/retry - Retry single failed job
router.post('/jobs/:id/retry', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const job = await prisma.syncJob.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const updated = await prisma.syncJob.update({
      where: { id },
      data: {
        status: 'PENDING',
        retryCount: 0,
        errorMessage: null,
      },
    });

    // Run immediate pass
    zohoSync.runSyncPass().catch(console.error);

    res.json({ success: true, message: 'Job rescheduled for immediate sync.', job: updated });
  } catch (err) {
    console.error('Retry job error:', err);
    res.status(500).json({ error: 'Failed to retry job.' });
  }
});

// POST /api/zoho/jobs/retry-all-failed - Retry all failed jobs
router.post('/jobs/retry-all-failed', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const result = await prisma.syncJob.updateMany({
      where: { OR: [{ status: 'FAILED' }, { status: 'RETRY_SCHEDULED' }] },
      data: {
        status: 'PENDING',
        retryCount: 0,
        errorMessage: null,
      },
    });

    // Run immediate pass
    zohoSync.runSyncPass().catch(console.error);

    res.json({ success: true, message: `${result.count} failed jobs reset to PENDING.` });
  } catch (err) {
    console.error('Retry all failed error:', err);
    res.status(500).json({ error: 'Failed to reset failed jobs.' });
  }
});

// POST /api/zoho/sync-now - Trigger immediate outbox worker pass
router.post('/sync-now', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const outcome = await zohoSync.runSyncPass();
    res.json({ success: true, outcome });
  } catch (err) {
    console.error('Sync now error:', err);
    res.status(500).json({ error: 'Sync run failed: ' + err.message });
  }
});

module.exports = router;

