const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const prisma = require('../src/prisma');
const { callZohoApi } = require('../src/services/zohoApiService');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callWithRetry(apiOptions, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callZohoApi(apiOptions);
    } catch (err) {
      if (err.message && err.message.includes('429')) {
        console.log(`[Rate Limit 429] Cooling down for 15s (Attempt ${attempt}/${maxRetries})...`);
        await sleep(15000);
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Exceeded max retries for ${apiOptions.endpoint}`);
}

async function clearRemainingZohoData() {
  console.log('--- Resuming Zoho Books Cleanup with Rate-Limit Throttling ---');

  const config = await prisma.zohoConfig.findUnique({ where: { id: 'default' } });
  if (!config || config.organizationId !== '60094058962') {
    throw new Error(`Safety check failed: Expected organization 60094058962, found ${config?.organizationId}`);
  }

  // 1. Invoices
  console.log('\n[1/3] Deleting remaining Invoices...');
  let hasMoreInvoices = true;
  while (hasMoreInvoices) {
    const invRes = await callWithRetry({ method: 'GET', endpoint: '/books/v3/invoices' });
    const invoices = invRes.invoices || [];
    console.log(`Found ${invoices.length} invoice(s) remaining in Zoho.`);
    if (invoices.length === 0) {
      hasMoreInvoices = false;
      break;
    }

    for (const inv of invoices) {
      console.log(`Deleting Invoice ${inv.invoice_number} (${inv.invoice_id})...`);
      try {
        await callWithRetry({ method: 'DELETE', endpoint: `/books/v3/invoices/${inv.invoice_id}` });
      } catch (err) {
        console.warn(`Could not direct-delete ${inv.invoice_number}: ${err.message}. Voiding first...`);
        try {
          await callWithRetry({ method: 'POST', endpoint: `/books/v3/invoices/${inv.invoice_id}/status/void` });
          await callWithRetry({ method: 'DELETE', endpoint: `/books/v3/invoices/${inv.invoice_id}` });
        } catch (e2) {
          console.error(`Failed to void/delete ${inv.invoice_number}: ${e2.message}`);
        }
      }
      await sleep(1000); // 1s throttle
    }
  }

  // 2. Items
  console.log('\n[2/3] Deleting remaining Items...');
  try {
    const itemRes = await callWithRetry({ method: 'GET', endpoint: '/books/v3/items' });
    const items = itemRes.items || [];
    console.log(`Found ${items.length} item(s) in Zoho.`);
    for (const item of items) {
      console.log(`Deleting Item: ${item.name} (${item.item_id})...`);
      try {
        await callWithRetry({ method: 'DELETE', endpoint: `/books/v3/items/${item.item_id}` });
      } catch (err) {
        console.warn(`Could not delete item ${item.name}: ${err.message}`);
      }
      await sleep(1000);
    }
  } catch (err) {
    console.error('Error deleting items:', err.message);
  }

  // 3. Contacts
  console.log('\n[3/3] Deleting remaining Contacts...');
  try {
    const contRes = await callWithRetry({ method: 'GET', endpoint: '/books/v3/contacts' });
    const contacts = contRes.contacts || [];
    console.log(`Found ${contacts.length} contact(s) in Zoho.`);
    for (const c of contacts) {
      console.log(`Deleting Contact: ${c.contact_name} (${c.contact_id})...`);
      try {
        await callWithRetry({ method: 'DELETE', endpoint: `/books/v3/contacts/${c.contact_id}` });
      } catch (err) {
        console.warn(`Could not delete contact ${c.contact_name}: ${err.message}`);
      }
      await sleep(1000);
    }
  } catch (err) {
    console.error('Error deleting contacts:', err.message);
  }

  // Final verification
  console.log('\n[Verification] Querying Zoho Books for remaining data...');
  const [fInv, fCont, fItems] = await Promise.all([
    callWithRetry({ method: 'GET', endpoint: '/books/v3/invoices' }),
    callWithRetry({ method: 'GET', endpoint: '/books/v3/contacts' }),
    callWithRetry({ method: 'GET', endpoint: '/books/v3/items' }),
  ]);

  console.log('\nFinal Zoho Books State:');
  console.log(`- Invoices: ${fInv.invoices?.length || 0}`);
  console.log(`- Contacts: ${fCont.contacts?.length || 0}`);
  console.log(`- Items: ${fItems.items?.length || 0}`);
  console.log('=== Zoho Cleanup Complete ===');
}

clearRemainingZohoData()
  .catch((err) => console.error('Fatal cleanup error:', err))
  .finally(() => prisma.$disconnect());
