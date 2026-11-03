const prisma = require('../prisma');
const zohoApi = require('./zohoApiService');

let isWorkerRunning = false;
let syncIntervalId = null;

// Exponential backoff delays in milliseconds
const BACKOFF_DELAYS = [
  30 * 1000, // 30 seconds
  2 * 60 * 1000, // 2 minutes
  10 * 60 * 1000, // 10 minutes
  30 * 60 * 1000, // 30 minutes
  60 * 60 * 1000, // 1 hour
];

/**
 * Process a single sync job
 */
async function processJob(job) {
  const payload = JSON.parse(job.payload || '{}');
  let zohoRecordId = null;

  switch (job.entityType) {
    case 'PRODUCT': {
      const item = await zohoApi.syncItem(payload, job.zohoRecordId);
      zohoRecordId = item?.item_id || null;
      if (zohoRecordId && job.localRecordId) {
        await prisma.product.update({
          where: { id: job.localRecordId },
          data: {
            zohoItemId: String(zohoRecordId),
            zohoSyncStatus: 'SYNCED',
            zohoLastSyncedAt: new Date(),
          },
        });
      }
      break;
    }

    case 'CUSTOMER': {
      const contact = await zohoApi.syncContact(payload, job.zohoRecordId);
      zohoRecordId = contact?.contact_id || null;
      if (zohoRecordId && job.localRecordId) {
        await prisma.customer.update({
          where: { id: job.localRecordId },
          data: {
            zohoContactId: String(zohoRecordId),
            zohoSyncStatus: 'SYNCED',
          },
        });
      }
      break;
    }

    case 'SUPPLIER': {
      const contact = await zohoApi.syncContact(payload, job.zohoRecordId);
      zohoRecordId = contact?.contact_id || null;
      if (zohoRecordId && job.localRecordId) {
        await prisma.supplier.update({
          where: { id: job.localRecordId },
          data: {
            zohoContactId: String(zohoRecordId),
            zohoSyncStatus: 'SYNCED',
          },
        });
      }
      break;
    }

    case 'INVOICE': {
      const invoice = await zohoApi.syncInvoice(payload);
      zohoRecordId = invoice?.invoice_id || null;
      if (zohoRecordId && job.localRecordId) {
        await prisma.invoice.update({
          where: { id: job.localRecordId },
          data: {
            zohoInvoiceId: String(zohoRecordId),
            zohoSyncStatus: 'SYNCED',
          },
        });
      }
      break;
    }

    case 'ESTIMATE': {
      const estimate = await zohoApi.syncEstimate(payload);
      zohoRecordId = estimate?.estimate_id || null;
      if (zohoRecordId && job.localRecordId) {
        await prisma.estimate.update({
          where: { id: job.localRecordId },
          data: {
            zohoEstimateId: String(zohoRecordId),
            zohoSyncStatus: 'SYNCED',
          },
        });
      }
      break;
    }

    case 'BILL': {
      const bill = await zohoApi.syncBill(payload);
      zohoRecordId = bill?.bill_id || null;
      if (zohoRecordId && job.localRecordId) {
        await prisma.purchaseBill.update({
          where: { id: job.localRecordId },
          data: {
            zohoBillId: String(zohoRecordId),
            zohoSyncStatus: 'SYNCED',
          },
        });
      }
      break;
    }

    case 'EXPENSE': {
      const expense = await zohoApi.syncExpense(payload);
      zohoRecordId = expense?.expense_id || null;
      if (zohoRecordId && job.localRecordId) {
        await prisma.expense.update({
          where: { id: job.localRecordId },
          data: {
            zohoExpenseId: String(zohoRecordId),
            zohoSyncStatus: 'SYNCED',
          },
        });
      }
      break;
    }

    case 'CREDIT_NOTE': {
      const cn = await zohoApi.syncCreditNote(payload);
      zohoRecordId = cn?.creditnote_id || null;
      break;
    }

    case 'CUSTOMER_PAYMENT': {
      const payment = await zohoApi.syncCustomerPayment(payload);
      zohoRecordId = payment?.payment_id || null;
      if (zohoRecordId && job.localRecordId) {
        await prisma.payment.update({
          where: { id: job.localRecordId },
          data: {
            zohoPaymentId: String(zohoRecordId),
            zohoSyncStatus: 'SYNCED',
          },
        });
      }
      break;
    }

    case 'PRICEBOOK': {
      const pb = await zohoApi.syncPricebook(payload, job.zohoRecordId);
      zohoRecordId = pb?.pricebook_id || null;
      if (zohoRecordId && job.localRecordId) {
        await prisma.pricebook.update({
          where: { id: job.localRecordId },
          data: {
            zohoPricebookId: String(zohoRecordId),
            zohoSyncStatus: 'SYNCED',
          },
        });
      }
      break;
    }

    default:
      console.warn(`Unrecognized entityType in sync job: ${job.entityType}`);
  }

  return zohoRecordId;
}

/**
 * Execute a pass over the SyncJob queue
 */
async function runSyncPass() {
  if (isWorkerRunning) return { skipped: true, reason: 'Worker is already processing.' };
  isWorkerRunning = true;

  try {
    // Check if Zoho is connected
    const config = await prisma.zohoConfig.findUnique({ where: { id: 'default' } });
    if (!config || !config.isConnected || !config.autoSyncEnabled) {
      isWorkerRunning = false;
      return { skipped: true, reason: 'Zoho auto-sync is disabled or not connected.' };
    }

    const now = new Date();

    // Query pending or eligible retry jobs
    const jobs = await prisma.syncJob.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          {
            status: 'RETRY_SCHEDULED',
            lastAttemptedAt: {
              lte: new Date(now.getTime() - 30 * 1000), // Check if backoff window has passed
            },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    if (jobs.length === 0) {
      isWorkerRunning = false;
      return { processed: 0 };
    }

    let successCount = 0;
    let failCount = 0;

    for (const job of jobs) {
      await prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: 'PROCESSING',
          lastAttemptedAt: new Date(),
        },
      });

      try {
        const zohoRecordId = await processJob(job);

        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: 'SYNCED',
            zohoRecordId: zohoRecordId ? String(zohoRecordId) : job.zohoRecordId,
            errorMessage: null,
            completedAt: new Date(),
          },
        });
        successCount++;
      } catch (err) {
        failCount++;
        const isRateLimit = err.message && (err.message.includes('429') || err.message.toLowerCase().includes('rate limit'));
        const newRetryCount = isRateLimit ? job.retryCount : job.retryCount + 1;
        const willRetry = newRetryCount < job.maxRetries;

        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: willRetry ? 'RETRY_SCHEDULED' : 'FAILED',
            retryCount: newRetryCount,
            errorMessage: err.message,
            lastAttemptedAt: new Date(),
          },
        });

        if (isRateLimit) {
          console.warn('[Zoho Sync] Rate limit encountered, pausing remaining jobs in this pass.');
          break;
        }
      }

      // Throttling: 350ms interval between calls to respect Zoho India DC rate limits
      await new Promise((r) => setTimeout(r, 350));
    }

    // Update last sync time
    await prisma.zohoConfig.update({
      where: { id: 'default' },
      data: { lastSyncAt: new Date() },
    });

    isWorkerRunning = false;
    return { successCount, failCount, total: jobs.length };
  } catch (err) {
    console.error('Sync worker pass error:', err.message);
    isWorkerRunning = false;
    return { error: err.message };
  }
}

/**
 * Start the background polling interval (e.g. every 30 seconds)
 */
function startSyncScheduler(intervalMs = 30000) {
  if (syncIntervalId) clearInterval(syncIntervalId);
  syncIntervalId = setInterval(async () => {
    try {
      await runSyncPass();
    } catch (e) {
      // Background runner error suppressed
    }
  }, intervalMs);
  if (syncIntervalId.unref) {
    syncIntervalId.unref();
  }
  console.log(`Zoho Background Outbox Sync Worker started (interval: ${intervalMs / 1000}s)`);
}

function stopSyncScheduler() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}

module.exports = {
  processJob,
  runSyncPass,
  startSyncScheduler,
  stopSyncScheduler,
};
