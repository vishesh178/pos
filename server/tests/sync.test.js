const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/prisma');

test('SyncJob table records outbox jobs with proper status and payload serialization', async () => {
  const payload = {
    invoice_number: 'CA-TEST-999',
    customer_name: 'Test Interior Designer',
    total: 12500,
  };

  const job = await prisma.syncJob.create({
    data: {
      entityType: 'INVOICE',
      localRecordId: 'local-test-inv-01',
      operation: 'CREATE',
      payload: JSON.stringify(payload),
      status: 'PENDING',
    },
  });

  assert.ok(job.id);
  assert.equal(job.entityType, 'INVOICE');
  assert.equal(job.status, 'PENDING');
  assert.equal(job.retryCount, 0);

  const parsed = JSON.parse(job.payload);
  assert.equal(parsed.invoice_number, 'CA-TEST-999');
  assert.equal(parsed.total, 12500);

  // Clean up
  await prisma.syncJob.delete({ where: { id: job.id } });
});

test('SyncJob retry count increments and transitions to FAILED when max retries exceeded', async () => {
  const job = await prisma.syncJob.create({
    data: {
      entityType: 'PRODUCT',
      localRecordId: 'local-test-prod-01',
      operation: 'CREATE',
      payload: JSON.stringify({ sku: 'CA-TEST-01' }),
      status: 'PENDING',
      retryCount: 4,
      maxRetries: 5,
    },
  });

  const nextRetryCount = job.retryCount + 1;
  const isFailed = nextRetryCount >= job.maxRetries;

  const updated = await prisma.syncJob.update({
    where: { id: job.id },
    data: {
      status: isFailed ? 'FAILED' : 'RETRY_SCHEDULED',
      retryCount: nextRetryCount,
      errorMessage: 'Simulated API rate limit error',
    },
  });

  assert.equal(updated.status, 'FAILED');
  assert.equal(updated.retryCount, 5);
  assert.ok(updated.errorMessage.includes('rate limit'));

  // Clean up
  await prisma.syncJob.delete({ where: { id: job.id } });
});

