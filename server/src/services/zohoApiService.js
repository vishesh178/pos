const axios = require('axios');
const { ZOHO_API_URL, getValidAccessToken } = require('./zohoAuthService');

/**
 * Execute authorized Zoho API request
 */
async function callZohoApi({ method, endpoint, params = {}, data = null, headers = {} }) {
  const { accessToken, organizationId } = await getValidAccessToken();

  if (!organizationId && !endpoint.includes('/organizations')) {
    throw new Error('No Zoho Organization ID configured. Please select your organization in Zoho Settings.');
  }

  const queryParams = { ...params };
  if (organizationId && !queryParams.organization_id) {
    queryParams.organization_id = organizationId;
  }

  const url = `${ZOHO_API_URL}${endpoint}`;

  const requestConfig = {
    method,
    url,
    params: queryParams,
    data,
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    timeout: 15000,
  };

  try {
    const response = await axios(requestConfig);
    return response.data;
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      const respData = err.response.data;

      // Rate limit backoff hint
      if (status === 429) {
        throw new Error('Zoho API rate limit reached (HTTP 429). Retry will be scheduled.');
      }

      const msg = respData?.message || respData?.error || err.message;
      throw new Error(`Zoho API Error (${status}): ${msg}`);
    }
    throw new Error(`Network error calling Zoho API: ${err.message}`);
  }
}

/**
 * Fetch linked organizations for user selection
 */
async function listOrganizations() {
  const res = await callZohoApi({
    method: 'GET',
    endpoint: '/books/v3/organizations',
  });
  return res.organizations || [];
}

/**
 * Duplicate Prevention: Check if invoice already exists by reference number
 */
async function findInvoiceByReference(referenceNumber) {
  try {
    const res = await callZohoApi({
      method: 'GET',
      endpoint: '/books/v3/invoices',
      params: { reference_number: referenceNumber },
    });
    return res.invoices?.[0] || null;
  } catch (err) {
    return null;
  }
}

/**
 * Duplicate Prevention: Check if item already exists by SKU
 */
async function findItemBySku(sku) {
  try {
    const res = await callZohoApi({
      method: 'GET',
      endpoint: '/books/v3/items',
      params: { sku },
    });
    return res.items?.[0] || null;
  } catch (err) {
    return null;
  }
}

/**
 * Duplicate Prevention: Check if contact already exists by mobile phone
 */
async function findContactByPhone(phone) {
  try {
    const res = await callZohoApi({
      method: 'GET',
      endpoint: '/books/v3/contacts',
      params: { phone },
    });
    return res.contacts?.[0] || null;
  } catch (err) {
    return null;
  }
}

/**
 * Sync Item to Zoho Books & Inventory
 */
async function syncItem(itemData, existingZohoId = null) {
  if (existingZohoId) {
    const res = await callZohoApi({
      method: 'PUT',
      endpoint: `/books/v3/items/${existingZohoId}`,
      data: itemData,
    });
    return res.item;
  } else {
    // Check duplicate by SKU first
    const existing = await findItemBySku(itemData.sku);
    if (existing) return existing;

    const res = await callZohoApi({
      method: 'POST',
      endpoint: '/books/v3/items',
      data: itemData,
    });
    return res.item;
  }
}

/**
 * Sync Contact (Customer or Vendor) to Zoho Books
 */
async function syncContact(contactData, existingZohoId = null) {
  if (existingZohoId) {
    const res = await callZohoApi({
      method: 'PUT',
      endpoint: `/books/v3/contacts/${existingZohoId}`,
      data: contactData,
    });
    return res.contact;
  } else {
    if (contactData.phone) {
      const existing = await findContactByPhone(contactData.phone);
      if (existing) return existing;
    }

    const res = await callZohoApi({
      method: 'POST',
      endpoint: '/books/v3/contacts',
      data: contactData,
    });
    return res.contact;
  }
}

const { getZohoStateCode } = require('../utils/gst');

/**
 * Sync Invoice to Zoho Books
 */
async function syncInvoice(invoiceData) {
  // Idempotency: verify if already created by invoice_number
  const existing = await findInvoiceByReference(invoiceData.invoice_number);
  if (existing) {
    return existing;
  }

  const formattedPlaceOfSupply = getZohoStateCode(invoiceData.place_of_supply);

  // If customer_id is not already a Zoho contact ID, resolve or auto-create in Zoho Books
  let customerId = invoiceData.customer_id;
  if (!customerId) {
    const custName = invoiceData.customer_name || 'Walk-in Retail Customer';
    let contact = null;
    if (invoiceData.customer_phone) {
      contact = await findContactByPhone(invoiceData.customer_phone);
    }
    if (!contact) {
      contact = await syncContact({
        contact_name: custName,
        company_name: custName,
        contact_type: 'customer',
        phone: invoiceData.customer_phone || '',
        gst_no: invoiceData.customer_gstin || '',
        gst_treatment: invoiceData.customer_gstin ? 'business_gst' : 'consumer',
      });
    }
    customerId = contact?.contact_id;
  }

  const payload = {
    customer_id: customerId,
    invoice_number: invoiceData.invoice_number,
    date: invoiceData.date || new Date().toISOString().split('T')[0],
    place_of_supply: formattedPlaceOfSupply,
    line_items: (invoiceData.line_items || []).map((it) => ({
      name: it.name || it.productName || 'Luxury Home Décor Product',
      rate: parseFloat(it.rate || it.unitPrice || 0),
      quantity: parseFloat(it.quantity || 1),
      hsn_or_sac: it.hsn_or_sac || it.hsnCode || '9701',
      description: it.sku ? `SKU: ${it.sku}` : undefined,
    })),
  };

  const res = await callZohoApi({
    method: 'POST',
    endpoint: '/books/v3/invoices',
    data: payload,
  });
  return res.invoice;
}

/**
 * Sync Inward Bill to Zoho Books
 */
async function syncBill(billData) {
  const res = await callZohoApi({
    method: 'POST',
    endpoint: '/books/v3/bills',
    data: billData,
  });
  return res.bill;
}

/**
 * Sync Expense to Zoho Books
 */
async function syncExpense(expenseData) {
  const res = await callZohoApi({
    method: 'POST',
    endpoint: '/books/v3/expenses',
    data: expenseData,
  });
  return res.expense;
}

/**
 * Duplicate Prevention: Check if estimate already exists by estimate number
 */
async function findEstimateByNumber(estimateNumber) {
  try {
    const res = await callZohoApi({
      method: 'GET',
      endpoint: '/books/v3/estimates',
      params: { estimate_number: estimateNumber },
    });
    return res.estimates?.[0] || null;
  } catch (err) {
    return null;
  }
}

/**
 * Sync Estimate / Quote to Zoho Books
 */
async function syncEstimate(estimateData) {
  const existing = await findEstimateByNumber(estimateData.estimate_number);
  if (existing) {
    return existing;
  }

  const formattedPlaceOfSupply = getZohoStateCode(estimateData.place_of_supply);

  let customerId = estimateData.customer_id;
  if (!customerId) {
    const custName = estimateData.customer_name || 'Walk-in Retail Customer';
    let contact = null;
    if (estimateData.customer_phone) {
      contact = await findContactByPhone(estimateData.customer_phone);
    }
    if (!contact) {
      contact = await syncContact({
        contact_name: custName,
        company_name: custName,
        contact_type: 'customer',
        phone: estimateData.customer_phone || '',
        gst_no: estimateData.customer_gstin || '',
        gst_treatment: estimateData.customer_gstin ? 'business_gst' : 'consumer',
      });
    }
    customerId = contact?.contact_id;
  }

  const payload = {
    customer_id: customerId,
    estimate_number: estimateData.estimate_number,
    reference_number: estimateData.estimate_number,
    date: estimateData.date || new Date().toISOString().split('T')[0],
    expiry_date: estimateData.expiry_date || undefined,
    place_of_supply: formattedPlaceOfSupply,
    line_items: (estimateData.line_items || []).map((it) => ({
      name: it.name || it.productName || 'Luxury Home Décor Product',
      rate: parseFloat(it.rate || it.unitPrice || 0),
      quantity: parseFloat(it.quantity || 1),
      hsn_or_sac: it.hsn_or_sac || it.hsnCode || '9701',
      description: it.sku ? `SKU: ${it.sku}` : undefined,
    })),
    notes: estimateData.notes || 'Formal quotation generated from Curated Art Showroom POS',
    terms: estimateData.terms || '1. Quotation valid for 15 days.\n2. Prices subject to physical stock confirmation.',
  };

  const res = await callZohoApi({
    method: 'POST',
    endpoint: '/books/v3/estimates',
    data: payload,
  });
  return res.estimate;
}

/**
 * Sync Credit Note to Zoho Books
 */
async function syncCreditNote(creditNoteData) {
  const res = await callZohoApi({
    method: 'POST',
    endpoint: '/books/v3/creditnotes',
    data: creditNoteData,
  });
  return res.creditnote;
}

/**
 * Get Contact by Zoho Contact ID (for live balance check)
 */
async function getContact(contactId) {
  try {
    const res = await callZohoApi({
      method: 'GET',
      endpoint: `/books/v3/contacts/${contactId}`,
    });
    return res.contact || null;
  } catch (err) {
    return null;
  }
}

/**
 * Sync Customer Payment / Settlement to Zoho Books (/books/v3/customerpayments)
 */
async function syncCustomerPayment(paymentData) {
  let customerId = paymentData.customer_id;
  if (!customerId) {
    if (paymentData.customer_phone) {
      const contact = await findContactByPhone(paymentData.customer_phone);
      customerId = contact?.contact_id;
    }
    if (!customerId && paymentData.customer_name) {
      const contact = await syncContact({
        contact_name: paymentData.customer_name,
        company_name: paymentData.customer_name,
        contact_type: 'customer',
        phone: paymentData.customer_phone || '',
      });
      customerId = contact?.contact_id;
    }
  }

  if (!customerId) {
    throw new Error('Unable to resolve Zoho contact ID for customer payment sync.');
  }

  // Map local payment method to Zoho payment mode string
  let paymentMode = 'Cash';
  const method = (paymentData.payment_mode || paymentData.paymentMethod || 'CASH').toUpperCase();
  if (method === 'UPI') paymentMode = 'UPI';
  else if (method === 'CARD') paymentMode = 'Credit Card';
  else if (method === 'BANK_TRANSFER') paymentMode = 'Bank Remittance';
  else if (method === 'CHEQUE') paymentMode = 'Cheque';

  const payload = {
    customer_id: customerId,
    payment_mode: paymentMode,
    amount: parseFloat(paymentData.amount || 0),
    date: paymentData.date || new Date().toISOString().split('T')[0],
    reference_number: paymentData.reference_number || undefined,
    description: paymentData.description || paymentData.notes || 'Customer credit ledger payment in Curated Art ERP',
  };

  // If specific Zoho invoice IDs are mapped, attach them
  if (Array.isArray(paymentData.invoices) && paymentData.invoices.length > 0) {
    payload.invoices = paymentData.invoices;
  }

  const res = await callZohoApi({
    method: 'POST',
    endpoint: '/books/v3/customerpayments',
    data: payload,
  });

  return res.payment;
}

/**
 * Fetch all pricebooks from Zoho Books
 */
async function listPricebooks() {
  const res = await callZohoApi({
    method: 'GET',
    endpoint: '/books/v3/pricebooks',
  });
  return res.pricebooks || [];
}

/**
 * Find existing pricebook by name
 */
async function findPricebookByName(name) {
  try {
    const list = await listPricebooks();
    return list.find((p) => p.pricebook_name?.toLowerCase() === name.toLowerCase()) || null;
  } catch (err) {
    return null;
  }
}

/**
 * Synchronize local Pricebook with Zoho Books
 */
async function syncPricebook(pricebookData, zohoPricebookId = null) {
  let targetId = zohoPricebookId;

  if (!targetId && pricebookData.name) {
    const existing = await findPricebookByName(pricebookData.name);
    if (existing) {
      targetId = existing.pricebook_id;
    }
  }

  const payload = {
    name: pricebookData.name,
    description: pricebookData.description || 'Tiered Pricebook for Curated Art ERP',
    pricing_scheme: 'percentage',
    pricing_type: 'discount',
    percentage: parseFloat(pricebookData.discountPercentage || 0),
    status: pricebookData.isActive === false ? 'inactive' : 'active',
  };

  if (targetId) {
    const res = await callZohoApi({
      method: 'PUT',
      endpoint: `/books/v3/pricebooks/${targetId}`,
      data: payload,
    });
    return res.pricebook;
  } else {
    const res = await callZohoApi({
      method: 'POST',
      endpoint: '/books/v3/pricebooks',
      data: payload,
    });
    return res.pricebook;
  }
}

module.exports = {
  callZohoApi,
  listOrganizations,
  findInvoiceByReference,
  findItemBySku,
  findContactByPhone,
  findEstimateByNumber,
  getContact,
  listPricebooks,
  findPricebookByName,
  syncPricebook,
  syncItem,
  syncContact,
  syncInvoice,
  syncEstimate,
  syncBill,
  syncExpense,
  syncCreditNote,
  syncCustomerPayment,
};

