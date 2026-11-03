const prisma = require('../prisma');

/**
 * Helper function to create an AuditLog record asynchronously
 */
async function logAudit({ userId, userName, action, entityType, entityId, details, ipAddress }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        userName: userName || 'System',
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        ipAddress: ipAddress || null,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

/**
 * Express middleware helper to attach audit logger to req
 */
function auditMiddleware(req, res, next) {
  req.logAudit = (action, entityType, entityId, details) => {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    logAudit({
      userId: req.user ? req.user.id : null,
      userName: req.user ? req.user.name : 'Anonymous',
      action,
      entityType,
      entityId,
      details,
      ipAddress,
    });
  };
  next();
}

module.exports = {
  logAudit,
  auditMiddleware,
};

