const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { encryptBuffer, decryptBuffer } = require('../utils/crypto');

const router = express.Router();

const DB_PATH = path.resolve(__dirname, '../../database/curated_art.db');
const BACKUPS_DIR = path.resolve(__dirname, '../../database/backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Helper: validate filename to prevent directory traversal
function isSafeFilename(name) {
  if (!name || typeof name !== 'string') return false;
  const basename = path.basename(name);
  if (basename !== name) return false;
  return /^[a-zA-Z0-9_\-\.]+$/.test(name);
}

// GET /api/backup/status - Vault status and disk metrics
router.get('/status', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const activeDbExists = fs.existsSync(DB_PATH);
    const activeDbSizeKb = activeDbExists ? Math.round(fs.statSync(DB_PATH).size / 1024) : 0;

    const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.sqlite') || f.endsWith('.db') || f.endsWith('.enc'));
    let totalBackupsSizeKb = 0;
    const backups = files.map((fileName) => {
      const filePath = path.join(BACKUPS_DIR, fileName);
      const stat = fs.statSync(filePath);
      const sizeKb = Math.round(stat.size / 1024);
      totalBackupsSizeKb += sizeKb;
      return {
        fileName,
        sizeKb,
        createdAt: stat.birthtime || stat.mtime,
        isEncrypted: fileName.endsWith('.enc'),
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      activeDbExists,
      activeDbSizeKb,
      totalBackups: backups.length,
      totalBackupsSizeKb,
      lastBackup: backups[0] || null,
      vaultPath: 'database/backups',
      autoBackupEnabled: true,
      autoBackupFrequency: 'Daily (Every 24h with 30-day rolling retention)',
    });
  } catch (err) {
    console.error('Backup status error:', err);
    res.status(500).json({ error: 'Failed to retrieve backup vault status.' });
  }
});

// GET /api/backup/list - List existing database backups
router.get('/list', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.sqlite') || f.endsWith('.db') || f.endsWith('.enc'));
    const backups = files.map((fileName) => {
      const filePath = path.join(BACKUPS_DIR, fileName);
      const stat = fs.statSync(filePath);
      return {
        fileName,
        sizeKb: Math.round(stat.size / 1024),
        createdAt: stat.birthtime || stat.mtime,
        isEncrypted: fileName.endsWith('.enc'),
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(backups);
  } catch (err) {
    console.error('List backups error:', err);
    res.status(500).json({ error: 'Failed to list backups.' });
  }
});

// POST /api/backup/create - Create immediate local database backup snapshot
router.post('/create', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ error: 'Source database file not found.' });
    }

    const isEncrypted = req.body?.encrypted === true;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = isEncrypted ? 'sqlite.enc' : 'sqlite';
    const backupFileName = `curated_art_backup_${timestamp}.${ext}`;
    const destinationPath = path.join(BACKUPS_DIR, backupFileName);

    if (isEncrypted) {
      const rawBuffer = fs.readFileSync(DB_PATH);
      const encBuffer = encryptBuffer(rawBuffer);
      fs.writeFileSync(destinationPath, encBuffer);
    } else {
      fs.copyFileSync(DB_PATH, destinationPath);
    }

    const stat = fs.statSync(destinationPath);
    const sizeKb = Math.round(stat.size / 1024);

    req.logAudit?.('BACKUP_DATABASE', 'SYSTEM', null, {
      fileName: backupFileName,
      sizeKb,
      isEncrypted,
    });

    res.json({
      success: true,
      message: `Database backup created successfully: ${backupFileName}`,
      backup: {
        fileName: backupFileName,
        sizeKb,
        createdAt: new Date(),
        isEncrypted,
      },
    });
  } catch (err) {
    console.error('Create backup error:', err);
    res.status(500).json({ error: 'Database backup failed: ' + err.message });
  }
});

// GET /api/backup/download - 1-Click Live Database Download (.sqlite or .enc)
router.get('/download', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ error: 'Source database file not found.' });
    }

    const isEncrypted = req.query.encrypted === 'true';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const downloadFileName = `curated_art_backup_${timestamp}.${isEncrypted ? 'sqlite.enc' : 'sqlite'}`;
    const snapshotPath = path.join(BACKUPS_DIR, downloadFileName);

    if (isEncrypted) {
      const raw = fs.readFileSync(DB_PATH);
      const encrypted = encryptBuffer(raw);
      fs.writeFileSync(snapshotPath, encrypted);
    } else {
      fs.copyFileSync(DB_PATH, snapshotPath);
    }

    req.logAudit?.('DOWNLOAD_DATABASE_BACKUP', 'SYSTEM', null, {
      fileName: downloadFileName,
      isEncrypted,
    });

    res.download(snapshotPath, downloadFileName, (err) => {
      if (err) {
        console.error('Download live backup error:', err);
      }
    });
  } catch (err) {
    console.error('Download live backup error:', err);
    res.status(500).json({ error: 'Failed to download database: ' + err.message });
  }
});

// GET /api/backup/download/:fileName - Download a specific historical snapshot
router.get('/download/:fileName', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { fileName } = req.params;
    if (!isSafeFilename(fileName)) {
      return res.status(400).json({ error: 'Invalid backup filename.' });
    }

    const filePath = path.join(BACKUPS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file not found.' });
    }

    req.logAudit?.('DOWNLOAD_HISTORICAL_BACKUP', 'SYSTEM', null, { fileName });

    res.download(filePath, fileName);
  } catch (err) {
    console.error('Download historical backup error:', err);
    res.status(500).json({ error: 'Failed to download backup: ' + err.message });
  }
});

// POST /api/backup/restore - Restore database from a backup (.sqlite or .enc)
router.post('/restore', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { fileName } = req.body;
    if (!isSafeFilename(fileName)) {
      return res.status(400).json({ error: 'Valid backup file name is required.' });
    }

    const sourcePath = path.join(BACKUPS_DIR, fileName);
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: 'Backup file does not exist.' });
    }

    // Create safety snapshot of current DB first
    const safetySnapshot = path.join(BACKUPS_DIR, `safety_before_restore_${Date.now()}.sqlite`);
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, safetySnapshot);
    }

    if (fileName.endsWith('.enc')) {
      const encBuffer = fs.readFileSync(sourcePath);
      const decBuffer = decryptBuffer(encBuffer);
      if (!decBuffer) {
        return res.status(400).json({ error: 'Decryption failed: could not decrypt encrypted backup file.' });
      }
      fs.writeFileSync(DB_PATH, decBuffer);
    } else {
      fs.copyFileSync(sourcePath, DB_PATH);
    }

    req.logAudit?.('RESTORE_DATABASE', 'SYSTEM', null, { restoredFrom: fileName });

    res.json({
      success: true,
      message: `Database restored successfully from ${fileName}.`,
    });
  } catch (err) {
    console.error('Restore backup error:', err);
    res.status(500).json({ error: 'Database restore failed: ' + err.message });
  }
});

// DELETE /api/backup/:fileName - Delete an old snapshot from vault
router.delete('/:fileName', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { fileName } = req.params;
    if (!isSafeFilename(fileName)) {
      return res.status(400).json({ error: 'Invalid backup filename.' });
    }

    const filePath = path.join(BACKUPS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file not found.' });
    }

    fs.unlinkSync(filePath);

    req.logAudit?.('DELETE_DATABASE_BACKUP', 'SYSTEM', null, { fileName });

    res.json({
      success: true,
      message: `Backup ${fileName} deleted successfully.`,
    });
  } catch (err) {
    console.error('Delete backup error:', err);
    res.status(500).json({ error: 'Failed to delete backup: ' + err.message });
  }
});

module.exports = router;
