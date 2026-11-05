const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../database/curated_art.db');
const BACKUPS_DIR = path.resolve(__dirname, '../../database/backups');
const MAX_BACKUP_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days retention
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // Check every 6 hours

/**
 * Perform automatic daily snapshot and retention cleanup
 */
function performDailyAutoBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) return;
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.sqlite') || f.endsWith('.db') || f.endsWith('.enc'));
    const now = Date.now();

    // Check if a backup was created in the last 24 hours
    let hasRecentBackup = false;
    for (const file of files) {
      try {
        const filePath = path.join(BACKUPS_DIR, file);
        const stat = fs.statSync(filePath);
        const age = now - (stat.birthtimeMs || stat.mtimeMs);
        if (age < 24 * 60 * 60 * 1000) {
          hasRecentBackup = true;
        }

        // Retention policy: automatically remove backups older than 30 days
        if (age > MAX_BACKUP_AGE_MS) {
          fs.unlinkSync(filePath);
          console.log(`[AutoBackup] Pruned expired backup: ${file}`);
        }
      } catch (e) {
        // Ignore single-file stat error
      }
    }

    // If no recent backup, create today's automated snapshot
    if (!hasRecentBackup) {
      const today = new Date().toISOString().slice(0, 10);
      const autoFileName = `curated_art_autobackup_${today}.sqlite`;
      const dest = path.join(BACKUPS_DIR, autoFileName);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(DB_PATH, dest);
        console.log(`[AutoBackup] Created scheduled daily snapshot: ${autoFileName}`);
      }
    }
  } catch (err) {
    console.error('[AutoBackup] Error in automated backup job:', err.message);
  }
}

/**
 * Start the daily backup scheduler
 */
function startBackupScheduler() {
  // Run initial check 30 seconds after server start
  setTimeout(performDailyAutoBackup, 30 * 1000);

  // Then recurring check every 6 hours
  const timer = setInterval(performDailyAutoBackup, CHECK_INTERVAL_MS);
  if (timer.unref) timer.unref(); // Allow Node to exit cleanly if needed
}

module.exports = {
  startBackupScheduler,
  performDailyAutoBackup,
};
