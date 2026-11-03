const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const DB_PATH = path.resolve(__dirname, '../../database/curated_art.db');
const BACKUPS_DIR = path.resolve(__dirname, '../../database/backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// GET /api/backup/list - List existing database backups
router.get('/list', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.sqlite') || f.endsWith('.db'));
    const backups = files.map((fileName) => {
      const filePath = path.join(BACKUPS_DIR, fileName);
      const stat = fs.statSync(filePath);
      return {
        fileName,
        sizeKb: Math.round(stat.size / 1024),
        createdAt: stat.birthtime || stat.mtime,
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(backups);
  } catch (err) {
    console.error('List backups error:', err);
    res.status(500).json({ error: 'Failed to list backups.' });
  }
});

// POST /api/backup/create - Create immediate local database backup
router.post('/create', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ error: 'Source database file not found.' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `curated_art_backup_${timestamp}.sqlite`;
    const destinationPath = path.join(BACKUPS_DIR, backupFileName);

    // Copy file synchronously
    fs.copyFileSync(DB_PATH, destinationPath);
    const stat = fs.statSync(destinationPath);

    req.logAudit('BACKUP_DATABASE', 'SYSTEM', null, { fileName: backupFileName, sizeKb: Math.round(stat.size / 1024) });

    res.json({
      success: true,
      message: 'Local SQLite database backed up successfully.',
      backup: {
        fileName: backupFileName,
        sizeKb: Math.round(stat.size / 1024),
        createdAt: new Date(),
      },
    });
  } catch (err) {
    console.error('Create backup error:', err);
    res.status(500).json({ error: 'Database backup failed: ' + err.message });
  }
});

// POST /api/backup/restore - Restore database from a backup
router.post('/restore', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: 'Backup file name is required.' });

    const sourcePath = path.join(BACKUPS_DIR, fileName);
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: 'Backup file does not exist.' });
    }

    // Create safety snapshot of current DB first
    const safetySnapshot = path.join(BACKUPS_DIR, `safety_before_restore_${Date.now()}.sqlite`);
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, safetySnapshot);
    }

    // Overwrite active database file
    fs.copyFileSync(sourcePath, DB_PATH);

    req.logAudit('RESTORE_DATABASE', 'SYSTEM', null, { restoredFrom: fileName });

    res.json({
      success: true,
      message: `Database restored successfully from ${fileName}.`,
    });
  } catch (err) {
    console.error('Restore backup error:', err);
    res.status(500).json({ error: 'Database restore failed: ' + err.message });
  }
});

module.exports = router;

