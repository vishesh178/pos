import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  FileText,
  FileDown,
  FileSpreadsheet,
  Share2,
  Copy,
  Check,
  Tag,
  ArrowRight,
  Package,
  Edit3,
  Save,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { downloadExportFile } from '../../utils/exportDownloader';

export default function EstimateModal({
  isOpen,
  onClose,
  estimate,
  businessProfile,
  onConvertToBill,
}) {
  const { token } = useAuth();
  const [currentEstimate, setCurrentEstimate] = useState(estimate);
  const [layout, setLayout] = useState('a4'); // 'a4' or 'thermal'
  const [copied, setCopied] = useState(false);
  const [converting, setConverting] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Discount editor state
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [modalBillDiscMode, setModalBillDiscMode] = useState('rupee'); // 'rupee' or 'percent'
  const [billDiscountInput, setBillDiscountInput] = useState(0);
  const [billDiscPercentInput, setBillDiscPercentInput] = useState('');
  const [modalItemDiscModes, setModalItemDiscModes] = useState({});
  const [itemDiscountsInput, setItemDiscountsInput] = useState({});
  const [itemDiscPercentInputs, setItemDiscPercentInputs] = useState({});
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountError, setDiscountError] = useState('');

  useEffect(() => {
    setCurrentEstimate(estimate);
    if (estimate) {
      setBillDiscountInput(estimate.discountTotal || 0);
      const map = {};
      (estimate.items || []).forEach((it) => {
        map[it.id] = it.discountAmount || 0;
      });
      setItemDiscountsInput(map);
    }
  }, [estimate]);

  const handleModalBillDiscModeChange = (mode) => {
    if (mode === modalBillDiscMode) return;
    setModalBillDiscMode(mode);
    if (mode === 'percent') {
      const pct =
        currentEstimate.subtotal > 0 && billDiscountInput > 0
          ? Math.round(((billDiscountInput / currentEstimate.subtotal) * 100) * 100) / 100
          : '';
      setBillDiscPercentInput(pct !== '' ? pct.toString() : '');
    } else {
      setBillDiscPercentInput('');
    }
  };

  const handleModalBillDiscChange = (val) => {
    if (modalBillDiscMode === 'percent') {
      setBillDiscPercentInput(val);
      const pct = parseFloat(val) || 0;
      const calculated = Math.round(((currentEstimate.subtotal * pct) / 100) * 100) / 100;
      setBillDiscountInput(calculated);
    } else {
      setBillDiscountInput(parseFloat(val) || 0);
    }
  };

  const handleModalItemDiscModeToggle = (it) => {
    const currentMode = modalItemDiscModes[it.id] || 'rupee';
    const nextMode = currentMode === 'rupee' ? 'percent' : 'rupee';
    setModalItemDiscModes((prev) => ({ ...prev, [it.id]: nextMode }));

    const itemTotal = it.unitPrice * it.quantity;
    if (nextMode === 'percent') {
      const currentDisc = itemDiscountsInput[it.id] || 0;
      const pct =
        itemTotal > 0 && currentDisc > 0
          ? Math.round(((currentDisc / itemTotal) * 100) * 100) / 100
          : '';
      setItemDiscPercentInputs((prev) => ({ ...prev, [it.id]: pct ? pct.toString() : '' }));
    } else {
      setItemDiscPercentInputs((prev) => ({ ...prev, [it.id]: '' }));
    }
  };

  const handleModalItemDiscChange = (it, val) => {
    const mode = modalItemDiscModes[it.id] || 'rupee';
    if (mode === 'percent') {
      setItemDiscPercentInputs((prev) => ({ ...prev, [it.id]: val }));
      const pct = parseFloat(val) || 0;
      const itemTotal = it.unitPrice * it.quantity;
      const calculated = Math.round(((itemTotal * pct) / 100) * 100) / 100;
      setItemDiscountsInput((prev) => ({ ...prev, [it.id]: calculated }));
    } else {
      setItemDiscountsInput((prev) => ({ ...prev, [it.id]: parseFloat(val) || 0 }));
    }
  };

  if (!isOpen || !currentEstimate) return null;

  const business = businessProfile || {
    businessName: 'Curated Art',
    legalName: 'Curated Art Luxury Decor Pvt Ltd',
    gstin: '24AAAAA0000A1Z5',
    address: 'Showroom #104, Design District, SG Highway, Ahmedabad, Gujarat - 380054',
    phone: '+91 98765 43210',
    email: 'contact@curatedart.in',
  };

  const generateCleanEstimateHtml = (targetLayout = layout) => {
    const isThermal = targetLayout === 'thermal';
    if (isThermal) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Estimate_${currentEstimate.estimateNumber || 'QUOTATION'}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: monospace;
      font-size: 11px;
      line-height: 1.3;
      margin: 0;
      padding: 4px;
      background: #fff;
      color: #000;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { border-bottom: 1px solid #000; text-align: left; padding: 2px 0; }
    td { padding: 3px 0; vertical-align: top; }
  </style>
</head>
<body>
  <div class="text-center">
    <div class="bold" style="font-size: 14px; letter-spacing: 1px;">${business.businessName.toUpperCase()}</div>
    <div style="font-size: 9px; color: #555;">${business.legalName || ''}</div>
    <div style="font-size: 9px;">${business.address || ''}</div>
    <div style="font-size: 9px;">Ph: ${business.phone || ''}</div>
    <div style="font-size: 9px; font-weight: bold; margin-top: 2px;">GSTIN: ${business.gstin || ''}</div>
    <div style="margin: 6px 0; padding: 2px; border: 1px solid #000; font-weight: bold; font-size: 10px;">
      *** ESTIMATE / QUOTATION ***
    </div>
  </div>

  <div style="font-size: 10px; line-height: 1.4;">
    <div class="row"><span>Doc #:</span><span class="bold">${currentEstimate.estimateNumber}</span></div>
    <div class="row"><span>Date:</span><span>${dateFormatted}</span></div>
    <div class="row"><span>Valid Until:</span><span>${validUntilFormatted}</span></div>
    <div class="row"><span>Customer:</span><span class="bold">${currentEstimate.customerName || 'Walk-in Retail Customer'}</span></div>
    ${currentEstimate.customerMobile ? `<div class="row"><span>Mobile:</span><span>${currentEstimate.customerMobile}</span></div>` : ''}
    ${currentEstimate.customerGstin ? `<div class="row"><span>GSTIN:</span><span>${currentEstimate.customerGstin}</span></div>` : ''}
  </div>

  <div class="divider"></div>

  <table>
    <thead>
      <tr>
        <th style="width: 50%;">Item</th>
        <th style="width: 25%; text-align: center;">Qty x Rate</th>
        <th style="width: 25%; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${(currentEstimate.items || []).map((it) => `
        <tr>
          <td>
            <div class="bold">${it.productName}</div>
            <div style="font-size: 8px; color: #555;">${it.sku} &bull; GST ${it.taxRate}%</div>
          </td>
          <td style="text-align: center;">${it.quantity % 1 === 0 ? it.quantity : Number(it.quantity.toFixed(3))} x ₹${it.unitPrice.toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold;">₹${it.totalAmount.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="divider"></div>

  <div style="font-size: 10px; line-height: 1.5;">
    <div class="row"><span>SUBTOTAL:</span><span>₹${currentEstimate.subtotal.toFixed(2)}</span></div>
    ${currentEstimate.discountTotal > 0 ? `<div class="row" style="color: #444;"><span>Discount:</span><span>-₹${currentEstimate.discountTotal.toFixed(2)}</span></div>` : ''}
    ${currentEstimate.taxTotal > 0 ? `
      ${!currentEstimate.isInterState ? `
        <div class="row"><span>CGST:</span><span>₹${currentEstimate.cgstTotal.toFixed(2)}</span></div>
        <div class="row"><span>SGST:</span><span>₹${currentEstimate.sgstTotal.toFixed(2)}</span></div>
      ` : `
        <div class="row"><span>IGST:</span><span>₹${currentEstimate.igstTotal.toFixed(2)}</span></div>
      `}
    ` : ''}
    <div class="row bold" style="font-size: 12px; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px;">
      <span>FINAL PAYABLE:</span><span>₹${currentEstimate.grandTotal.toFixed(2)}</span>
    </div>
  </div>

  <div class="divider"></div>
  <div class="text-center" style="font-size: 9px; color: #555;">
    <div>Prices valid for ${currentEstimate.validityDays || 15} days from quote date.</div>
    <div>Not a Tax Invoice &bull; For Quotation Only</div>
  </div>
</body>
</html>`;
    }

    // A4 Portrait Quotation Layout
    const itemsHtml = (currentEstimate.items || []).map((it, idx) => {
      const imgSrc = it.product?.imageUrl || it.imageUrl;
      const imgTag = imgSrc
        ? `<img src="${imgSrc}" alt="${it.productName}" style="width: 48px; height: 48px; object-fit: contain; border-radius: 4px; border: 1px solid #e5e7eb; display: block; margin: 0 auto; background: #ffffff;" onerror="this.style.display='none';" />`
        : `<div style="width: 48px; height: 48px; border: 1px dashed #d1d5db; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #9ca3af; margin: 0 auto; text-align: center;">No Photo</div>`;

      return `
        <tr style="page-break-inside: avoid; break-inside: avoid;">
          <td style="border: 1px solid #000000; padding: 6px 4px; text-align: center; font-weight: bold; vertical-align: middle;">${idx + 1}</td>
          <td style="border: 1px solid #000000; padding: 6px 8px; vertical-align: middle;">
            <div style="font-weight: bold; font-size: 11px; line-height: 1.3; color: #000000;">${it.productName}</div>
            <div style="font-size: 9px; color: #555555; font-family: monospace; margin-top: 2px;">Code: ${it.sku || it.product?.sku || 'N/A'}</div>
          </td>
          <td style="border: 1px solid #000000; padding: 4px; text-align: center; vertical-align: middle;">
            ${imgTag}
          </td>
          <td style="border: 1px solid #000000; padding: 6px 4px; text-align: center; font-weight: bold; font-size: 11px; vertical-align: middle;">
            ${it.quantity % 1 === 0 ? it.quantity : Number(it.quantity.toFixed(3))}
          </td>
          <td style="border: 1px solid #000000; padding: 6px 6px; text-align: center; font-weight: bold; font-size: 11px; vertical-align: middle;">
            ₹${(it.mrp || it.unitPrice).toLocaleString('en-IN')}
          </td>
          <td style="border: 1px solid #000000; padding: 6px 6px; text-align: center; font-size: 11px; color: #374151; vertical-align: middle; font-family: monospace;">
            ${it.discountAmount > 0 ? `₹${it.discountAmount.toLocaleString('en-IN')}` : '-'}
          </td>
          <td style="border: 1px solid #000000; padding: 6px 8px; text-align: right; font-weight: bold; font-size: 11px; vertical-align: middle;">
            ₹${it.totalAmount.toLocaleString('en-IN')}
          </td>
        </tr>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Estimate_${currentEstimate.estimateNumber || 'QUOTATION'}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 8mm 8mm 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    .customer-box {
      width: 100%;
      border: 1px solid #000000;
      padding: 8px 12px;
      margin-bottom: 10px;
      border-radius: 2px;
    }
    .items-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      border: 1px solid #000000;
    }
    .items-table th {
      border: 1px solid #000000;
      background-color: #f3f4f6 !important;
      padding: 8px 4px;
      font-size: 11px;
      font-weight: bold;
      color: #000000;
      text-align: center;
    }
    .items-table td {
      border: 1px solid #000000;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .summary-td-label {
      border: 1px solid #000000;
      padding: 6px 12px;
      text-align: right;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.3px;
    }
    .summary-td-val {
      border: 1px solid #000000;
      padding: 6px 8px;
      text-align: right;
      font-weight: bold;
      font-size: 11px;
    }
    .terms-section {
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style>
</head>
<body>
  <!-- Top Header Table -->
  <table class="header-table">
    <tr>
      <td style="vertical-align: top;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;">
          ${business.businessName.toUpperCase()}
        </h1>
        <p style="margin: 4px 0 0 0; font-size: 10px; color: #4b5563;">
          Tel: ${business.phone || ''} &bull; GSTIN: ${business.gstin || ''}
        </p>
        <p style="margin: 2px 0 0 0; font-size: 10px; color: #4b5563;">
          ${business.address || ''}
        </p>
      </td>
      <td style="vertical-align: top; text-align: right; width: 220px;">
        <div style="display: inline-block; background: #000000; color: #ffffff; padding: 4px 10px; font-weight: bold; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase;">
          ESTIMATE / QUOTATION
        </div>
        <div style="margin-top: 6px; font-size: 11px; line-height: 1.4;">
          <div><strong>Doc #:</strong> <span style="font-family: monospace; font-weight: bold;">${currentEstimate.estimateNumber}</span></div>
          <div style="color: #4b5563;">Date: ${dateFormatted}</div>
          <div style="color: #4b5563;">Valid Until: ${validUntilFormatted}</div>
        </div>
      </td>
    </tr>
  </table>

  <div style="width: 100%; height: 2px; background: #000000; margin-bottom: 10px;"></div>

  <!-- Customer Box -->
  <div class="customer-box">
    <div style="font-size: 9px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
      CUSTOMER NAME:
    </div>
    <div style="font-size: 13px; font-weight: bold; color: #000000; margin-top: 2px;">
      ${currentEstimate.customerName || 'Walk-in Retail Customer'}
    </div>
    ${(currentEstimate.customerMobile || currentEstimate.customerGstin) ? `
      <div style="font-size: 10px; color: #4b5563; margin-top: 2px;">
        ${currentEstimate.customerMobile ? `Phone: ${currentEstimate.customerMobile}` : ''}
        ${currentEstimate.customerMobile && currentEstimate.customerGstin ? ' &bull; ' : ''}
        ${currentEstimate.customerGstin ? `GSTIN: ${currentEstimate.customerGstin}` : ''}
      </div>
    ` : ''}
  </div>

  <!-- Items Table (Guaranteed 100% width with fixed percentages) -->
  <table class="items-table">
    <colgroup>
      <col style="width: 5%;" />
      <col style="width: 32%;" />
      <col style="width: 14%;" />
      <col style="width: 8%;" />
      <col style="width: 13%;" />
      <col style="width: 12%;" />
      <col style="width: 16%;" />
    </colgroup>
    <thead>
      <tr>
        <th>#</th>
        <th style="text-align: left; padding-left: 8px;">Item Description</th>
        <th>Product Photo</th>
        <th>Qty</th>
        <th>Rate (MRP)</th>
        <th>Discount</th>
        <th style="text-align: right; padding-right: 8px;">Total (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}

      <!-- Subtotal -->
      <tr style="border-top: 2px solid #000000;">
        <td colspan="6" class="summary-td-label">BILLING AMOUNT (SUBTOTAL)</td>
        <td class="summary-td-val">₹${currentEstimate.subtotal.toLocaleString('en-IN')}</td>
      </tr>

      <!-- Total Discount Applied -->
      ${currentEstimate.discountTotal > 0 ? `
        <tr>
          <td colspan="6" class="summary-td-label" style="font-size: 10px; color: #065f46;">TOTAL DISCOUNT APPLIED</td>
          <td class="summary-td-val" style="color: #065f46;">-₹${currentEstimate.discountTotal.toLocaleString('en-IN')}</td>
        </tr>
      ` : ''}

      <!-- Taxes -->
      ${currentEstimate.taxTotal > 0 ? `
        <tr>
          <td colspan="6" class="summary-td-label" style="font-size: 10px; color: #4b5563;">
            ${!currentEstimate.isInterState ? 'GST (CGST + SGST)' : 'IGST (Inter-State)'}
          </td>
          <td class="summary-td-val" style="color: #374151;">₹${currentEstimate.taxTotal.toLocaleString('en-IN')}</td>
        </tr>
      ` : ''}

      <!-- Final Payable Amount -->
      <tr style="border-top: 2px solid #000000; background-color: #f9fafb;">
        <td colspan="6" class="summary-td-label" style="font-size: 12px; font-weight: 900; color: #000000;">
          FINAL PAYABLE AMOUNT (GRAND TOTAL)
        </td>
        <td class="summary-td-val" style="font-size: 13px; font-weight: 900; color: #000000;">
          ₹${currentEstimate.grandTotal.toLocaleString('en-IN')}
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Terms & Signature -->
  <div class="terms-section">
    <div style="width: 58%; font-size: 10px; color: #4b5563; line-height: 1.4;">
      <div style="font-weight: bold; color: #000000; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;">
        Notes &amp; Terms:
      </div>
      <div>1. This estimate is valid for ${currentEstimate.validityDays || 15} days from the date of issue.</div>
      <div>2. Subject to product availability at the time of final confirmation.</div>
      <div>3. Fragile luxury décor is quality-inspected prior to delivery.</div>
    </div>
    <div style="width: 38%; text-align: right;">
      <div style="height: 38px;"></div>
      <div style="width: 170px; margin-left: auto; border-bottom: 1px solid #000000; margin-bottom: 4px;"></div>
      <div style="font-size: 11px; font-weight: bold; color: #000000;">Authorized Signatory</div>
    </div>
  </div>
</body>
</html>`;
  };

  const printIsolatedIframe = () => {
    const cleanHtml = generateCleanEstimateHtml(layout);

    let iframe = document.getElementById('estimate-print-isolated-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'estimate-print-isolated-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(cleanHtml);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
    }, 400);
  };

  const handlePrint = () => {
    printIsolatedIframe();
  };

  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    try {
      if (window.electronAPI?.savePDF) {
        const filename = `Estimate_${currentEstimate.estimateNumber || 'QUOTATION'}.pdf`;
        const res = await window.electronAPI.savePDF({ filename });
        if (res?.success) {
          alert(`Estimate PDF saved successfully to:\n${res.filePath}`);
        } else if (!res?.canceled) {
          alert('Could not save PDF: ' + (res?.error || 'Unknown error'));
        }
      } else {
        printIsolatedIframe();
      }
    } catch (err) {
      console.error('PDF Download Error:', err);
      alert('Failed to download PDF: ' + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      const url = `/api/estimates/${currentEstimate.id}/export/excel`;
      const fallbackFilename = `Estimate_${currentEstimate.estimateNumber || 'QUOTATION'}.xlsx`;
      await downloadExportFile(url, fallbackFilename, token);
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleSaveDiscounts = async () => {
    setDiscountSaving(true);
    setDiscountError('');
    try {
      const payload = {
        invoiceDiscount: parseFloat(billDiscountInput) || 0,
        itemDiscounts: Object.entries(itemDiscountsInput).map(([itemId, discountAmount]) => ({
          itemId,
          discountAmount: parseFloat(discountAmount) || 0,
        })),
      };

      const res = await fetch(`/api/estimates/${currentEstimate.id}/discount`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update discount');

      setCurrentEstimate(data.estimate);
      setIsEditingDiscount(false);
    } catch (err) {
      setDiscountError(err.message);
    } finally {
      setDiscountSaving(false);
    }
  };

  const estimateDate = new Date(currentEstimate.createdAt || Date.now());
  const dateFormatted = estimateDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const validUntilDate = new Date(
    estimateDate.getTime() + (currentEstimate.validityDays || 15) * 86400000
  );
  const validUntilFormatted = validUntilDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Generate WhatsApp message text
  const generateWhatsAppText = () => {
    const lines = (currentEstimate.items || [])
      .map((it, idx) => {
        const discText = it.discountAmount > 0 ? ` (Disc: -₹${it.discountAmount})` : '';
        return `${idx + 1}. *${it.productName}* (${it.sku})\n   ${it.quantity} pc(s) @ ₹${(it.mrp || it.unitPrice).toLocaleString('en-IN')}${discText} = ₹${it.totalAmount.toLocaleString('en-IN')}`;
      })
      .join('\n\n');

    return (
      `🏛️ *${business.businessName.toUpperCase()} — Luxury Decor*\n` +
      `*Quotation / Estimate:* #${currentEstimate.estimateNumber}\n` +
      `*Date:* ${dateFormatted} (Valid for ${currentEstimate.validityDays || 15} days)\n` +
      `*Customer:* ${currentEstimate.customerName}\n\n` +
      `📋 *Quoted Pieces:*\n${lines}\n\n` +
      `───────────────\n` +
      `*Subtotal:* ₹${currentEstimate.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
      (currentEstimate.discountTotal > 0
        ? `*Total Discount:* -₹${currentEstimate.discountTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`
        : '') +
      (currentEstimate.taxTotal > 0
        ? `*GST:* ₹${currentEstimate.taxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`
        : '') +
      `*Grand Total: ₹${currentEstimate.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*\n` +
      `───────────────\n\n` +
      `📍 *Showroom:* ${business.address}\n` +
      `📞 *Phone:* ${business.phone}\n\n` +
      `💬 *Reply to this message to confirm your order!*`
    );
  };

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const text = generateWhatsAppText();
    const cleanPhone = (currentEstimate.customerMobile || '').replace(/\D/g, '');
    let url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (cleanPhone.length >= 10) {
      const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
    }
    window.open(url, '_blank');
  };

  const handleConvertClick = async () => {
    if (!onConvertToBill) return;
    setConverting(true);
    try {
      await onConvertToBill(currentEstimate);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Print Stylesheet for exact isolation and A4 scaling */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-estimate, #printable-estimate * {
            visibility: visible !important;
          }
          #printable-estimate {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 8mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>

      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-6">
        {/* Top Header & Actions Bar */}
        <div className="px-6 py-3.5 border-b border-stone-800 flex items-center justify-between bg-stone-900/90 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-sm text-stone-100">
                  Estimate / Quotation {currentEstimate.estimateNumber}
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    currentEstimate.status === 'CONVERTED'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : currentEstimate.status === 'CANCELLED'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}
                >
                  {currentEstimate.status || 'PENDING'}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 font-medium">
                Valid until {validUntilFormatted} (15 days) • Does not deduct inventory until billed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-stone-950 p-1 rounded-xl border border-stone-800 flex items-center text-xs">
              <button
                onClick={() => setLayout('a4')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  layout === 'a4'
                    ? 'bg-amber-500 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                A4 Quotation
              </button>
              <button
                onClick={() => setLayout('thermal')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  layout === 'thermal'
                    ? 'bg-amber-500 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                80mm Slip
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Discount Editor Panel (if toggled) */}
        {isEditingDiscount && (
          <div className="p-4 bg-stone-950 border-b border-stone-800 print:hidden space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                <Tag className="w-4 h-4" />
                <span>Add / Adjust Discounts for {currentEstimate.estimateNumber}</span>
              </div>
              <button
                onClick={() => setIsEditingDiscount(false)}
                className="text-stone-400 hover:text-stone-200 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {discountError && (
              <p className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-800">
                {discountError}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Overall Bill Discount */}
              <div className="bg-stone-900 p-3 rounded-xl border border-stone-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-stone-300 flex items-center gap-1.5">
                    <span>Overall Discount</span>
                    <div className="inline-flex bg-stone-950 border border-stone-700 rounded-md p-0.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => handleModalBillDiscModeChange('rupee')}
                        className={`px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                          modalBillDiscMode === 'rupee'
                            ? 'bg-amber-500 text-stone-950 shadow-sm'
                            : 'text-stone-400 hover:text-stone-200'
                        }`}
                        title="Flat Rupee discount"
                      >
                        ₹
                      </button>
                      <button
                        type="button"
                        onClick={() => handleModalBillDiscModeChange('percent')}
                        className={`px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                          modalBillDiscMode === 'percent'
                            ? 'bg-amber-500 text-stone-950 shadow-sm'
                            : 'text-stone-400 hover:text-stone-200'
                        }`}
                        title="Percentage discount"
                      >
                        %
                      </button>
                    </div>
                  </label>
                  {modalBillDiscMode === 'percent' && billDiscountInput > 0 && (
                    <span className="text-[10px] text-stone-400 font-mono">
                      (-₹{Number(billDiscountInput).toFixed(2)})
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  max={modalBillDiscMode === 'percent' ? 100 : undefined}
                  step="any"
                  value={modalBillDiscMode === 'percent' ? billDiscPercentInput : (billDiscountInput || '')}
                  onChange={(e) => handleModalBillDiscChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-amber-400 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Item Specific Discounts */}
              <div className="bg-stone-900 p-3 rounded-xl border border-stone-800 space-y-2 max-h-48 overflow-y-auto">
                <p className="text-[11px] font-medium text-stone-300">Line-Item Discounts</p>
                <div className="space-y-2">
                  {(currentEstimate.items || []).map((it) => {
                    const itemMode = modalItemDiscModes[it.id] || 'rupee';
                    const itemVal =
                      itemMode === 'percent'
                        ? (itemDiscPercentInputs[it.id] ?? '')
                        : (itemDiscountsInput[it.id] ?? '');
                    return (
                      <div key={it.id} className="flex items-center justify-between gap-2 text-xs">
                        <div className="truncate flex-1 min-w-0">
                          <p className="truncate text-stone-300 font-serif text-[11px] leading-tight">
                            {it.productName}
                          </p>
                          <p className="text-[10px] text-stone-500 font-mono">
                            {it.quantity} × ₹{it.unitPrice.toFixed(2)}
                            {itemMode === 'percent' && (itemDiscountsInput[it.id] > 0) && (
                              <span className="text-amber-400 ml-1">
                                (-₹{Number(itemDiscountsInput[it.id]).toFixed(2)})
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleModalItemDiscModeToggle(it)}
                            className="px-1.5 py-0.5 rounded bg-stone-950 border border-stone-700 hover:border-amber-500 text-amber-400 text-[10px] font-bold font-mono transition-colors cursor-pointer"
                            title="Click to toggle ₹ flat and % percentage"
                          >
                            {itemMode === 'percent' ? '%' : '₹'}
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={itemMode === 'percent' ? 100 : undefined}
                            step="any"
                            value={itemVal}
                            onChange={(e) => handleModalItemDiscChange(it, e.target.value)}
                            placeholder="0"
                            className="w-16 bg-stone-950 border border-stone-700 rounded px-2 py-0.5 text-right font-mono text-xs text-amber-400 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setIsEditingDiscount(false)}
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={handleSaveDiscounts}
                disabled={discountSaving}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{discountSaving ? 'Saving...' : 'Apply & Recalculate'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Printable View Container */}
        <div className="p-3 sm:p-6 bg-stone-950 max-h-[65vh] overflow-y-auto overflow-x-auto flex justify-center">
          {layout === 'thermal' ? (
            /* 80mm Slip Layout */
            <div
              id="printable-estimate"
              className="w-[320px] bg-white text-black p-4 font-mono text-[11px] rounded-sm shadow-md border border-neutral-300 leading-tight"
            >
              <div className="text-center pb-2 border-b border-black">
                <p className="font-bold text-sm tracking-widest">{business.businessName.toUpperCase()}</p>
                <p className="text-[9px] text-neutral-600">{business.legalName}</p>
                <p className="text-[9px] mt-0.5">{business.address}</p>
                <p className="text-[9px]">Ph: {business.phone}</p>
                <p className="text-[9px] font-bold mt-1">GSTIN: {business.gstin}</p>
                <div className="mt-2 py-0.5 bg-neutral-100 border border-neutral-400 font-bold uppercase text-[10px]">
                  *** ESTIMATE / QUOTATION ***
                </div>
              </div>

              <div className="py-2 border-b border-neutral-400 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Doc #:</span>
                  <span className="font-bold">{currentEstimate.estimateNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{dateFormatted}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valid Until:</span>
                  <span>{validUntilFormatted}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold">{currentEstimate.customerName}</span>
                </div>
                {currentEstimate.customerMobile && (
                  <div className="flex justify-between">
                    <span>Mobile:</span>
                    <span>{currentEstimate.customerMobile}</span>
                  </div>
                )}
                {currentEstimate.customerGstin && (
                  <div className="flex justify-between">
                    <span>GSTIN:</span>
                    <span>{currentEstimate.customerGstin}</span>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="py-2 border-b border-neutral-400">
                <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-neutral-300">
                  <span className="w-1/2">Item Description</span>
                  <span className="w-1/4 text-center">Qty x Rate</span>
                  <span className="w-1/4 text-right">Amount</span>
                </div>
                <div className="space-y-1.5 pt-1 text-[10px]">
                  {(currentEstimate.items || []).map((it, idx) => (
                    <div key={idx} className="flex justify-between items-start">
                      <div className="w-1/2">
                        <p className="font-bold">{it.productName}</p>
                        <p className="text-[8px] text-neutral-500">
                          {it.sku} • HSN:{it.hsnCode} (GST {it.taxRate}%)
                        </p>
                      </div>
                      <div className="w-1/4 text-center">
                        {it.quantity % 1 === 0 ? it.quantity : Number(it.quantity.toFixed(3))} x ₹{it.unitPrice.toFixed(2)}
                      </div>
                      <div className="w-1/4 text-right font-bold">
                        ₹{it.totalAmount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Totals */}
              <div className="py-2 border-b border-neutral-400 space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>BILLING AMOUNT (SUBTOTAL):</span>
                  <span>₹{currentEstimate.subtotal.toFixed(2)}</span>
                </div>
                {currentEstimate.discountTotal > 0 && (
                  <div className="flex justify-between text-neutral-700">
                    <span>Discount:</span>
                    <span>-₹{currentEstimate.discountTotal.toFixed(2)}</span>
                  </div>
                )}
                {currentEstimate.taxTotal > 0 && (!currentEstimate.isInterState ? (
                  <>
                    <div className="flex justify-between">
                      <span>CGST:</span>
                      <span>₹{currentEstimate.cgstTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST:</span>
                      <span>₹{currentEstimate.sgstTotal.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>IGST (Inter-State):</span>
                    <span>₹{currentEstimate.igstTotal.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-bold pt-1 border-t border-neutral-400">
                  <span>FINAL PAYABLE AMOUNT:</span>
                  <span>₹{currentEstimate.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Estimate Note */}
              <div className="pt-2 text-center text-[9px] text-neutral-600 space-y-1">
                <p className="font-bold">Prices valid for {currentEstimate.validityDays || 15} days from quote date.</p>
                <p>Not a Tax Invoice • For Quotation Purposes Only</p>
              </div>
            </div>
          ) : (
            /* A4 Estimate Layout - Guaranteed Full Margin Width */
            <div
              id="printable-estimate"
              className="w-full max-w-[740px] min-w-[580px] bg-white text-black p-4 sm:p-8 font-sans text-xs shadow-xl rounded-sm border border-neutral-300"
            >
              {/* Header Section */}
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-black text-black tracking-tight uppercase font-sans">
                    {business.businessName.toUpperCase()}
                  </h1>
                  <p className="text-[11px] text-neutral-600 mt-1">
                    Tel: {business.phone || ''} | GSTIN: {business.gstin || '24AAACA1234A1Z5'}
                  </p>
                </div>

                <div className="text-right">
                  <div className="bg-black text-white px-3.5 py-1 text-xs font-bold tracking-wider uppercase rounded-xs inline-block">
                    ESTIMATE / QUOTATION
                  </div>
                  <div className="mt-2 text-right text-[11px] space-y-0.5">
                    <p>
                      <span className="font-bold">Doc #:</span>{' '}
                      <span className="font-mono font-bold text-black">{currentEstimate.estimateNumber}</span>
                    </p>
                    <p className="text-neutral-600">
                      <span>Date:</span> <span>{dateFormatted}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Heavy Horizontal Divider */}
              <div className="w-full h-[2px] bg-black my-4" />

              {/* Customer Box */}
              <div className="w-full border border-neutral-800 p-3 mb-4 rounded-xs bg-white">
                <p className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                  CUSTOMER NAME:
                </p>
                <p className="text-sm font-bold text-black mt-0.5">
                  {currentEstimate.customerName || 'Walk-in Customer'}
                </p>
                {(currentEstimate.customerMobile || currentEstimate.customerGstin) && (
                  <p className="text-[11px] text-neutral-600 mt-0.5">
                    {currentEstimate.customerMobile && <span>Phone: {currentEstimate.customerMobile}</span>}
                    {currentEstimate.customerMobile && currentEstimate.customerGstin && <span> | </span>}
                    {currentEstimate.customerGstin && <span>GSTIN: {currentEstimate.customerGstin}</span>}
                  </p>
                )}
              </div>

              {/* Items Grid Table */}
              <table className="w-full table-fixed text-left border-collapse border border-black my-2">
                <colgroup>
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '16%' }} />
                </colgroup>
                <thead>
                  <tr className="bg-neutral-100 text-black text-[11px] font-bold">
                    <th className="border border-black py-2.5 px-1 text-center">#</th>
                    <th className="border border-black py-2.5 px-2">Item Description</th>
                    <th className="border border-black py-2.5 px-1 text-center">Product Photo</th>
                    <th className="border border-black py-2.5 px-1 text-center">Qty</th>
                    <th className="border border-black py-2.5 px-2 text-center">Rate (MRP)</th>
                    <th className="border border-black py-2.5 px-2 text-center">Discount</th>
                    <th className="border border-black py-2.5 px-2 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="text-[11px]">
                  {(currentEstimate.items || []).map((it, idx) => {
                    const imgSrc = it.product?.imageUrl || it.imageUrl;
                    return (
                      <tr key={idx} className="hover:bg-neutral-50/50">
                        {/* 1. Index # */}
                        <td className="border border-black py-3 px-1 text-center font-bold align-middle">
                          {idx + 1}
                        </td>

                        {/* 2. Item Description */}
                        <td className="border border-black py-3 px-2 align-middle break-words">
                          <p className="font-bold text-xs text-black leading-snug">
                            {it.productName}
                          </p>
                          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                            Code: {it.sku || it.product?.sku || 'N/A'}
                          </p>
                        </td>

                        {/* 3. Product Photo */}
                        <td className="border border-black py-2 px-1 text-center align-middle">
                          <div className="w-12 h-12 border border-neutral-300 rounded p-0.5 bg-white mx-auto flex items-center justify-center overflow-hidden">
                            {imgSrc ? (
                              <img
                                src={imgSrc}
                                alt={it.productName}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-neutral-400">
                                <Package className="w-4 h-4 stroke-1" />
                                <span className="text-[7px] mt-0.5">No Photo</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 4. Qty */}
                        <td className="border border-black py-3 px-1 text-center font-bold align-middle text-xs">
                          {it.quantity % 1 === 0 ? it.quantity : Number(it.quantity.toFixed(3))}
                        </td>

                        {/* 5. Rate (MRP) */}
                        <td className="border border-black py-3 px-2 text-center align-middle font-bold text-xs font-sans">
                          ₹{(it.mrp || it.unitPrice).toLocaleString('en-IN')}
                        </td>

                        {/* 6. Discount */}
                        <td className="border border-black py-3 px-2 text-center align-middle font-mono text-xs text-neutral-700">
                          {it.discountAmount > 0
                            ? `₹${it.discountAmount.toLocaleString('en-IN')}`
                            : '-'}
                        </td>

                        {/* 7. Total (₹) */}
                        <td className="border border-black py-3 px-2 text-right align-middle font-bold text-xs font-sans">
                          ₹{it.totalAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Summary Row 1: Subtotal */}
                  <tr className="border-t-2 border-black">
                    <td
                      colSpan={6}
                      className="border border-black py-2.5 px-3 text-right font-bold uppercase tracking-wider text-[11px] text-neutral-800"
                    >
                      BILLING AMOUNT (SUBTOTAL)
                    </td>
                    <td className="border border-black py-2.5 px-2 text-right font-bold text-xs font-sans">
                      ₹{currentEstimate.subtotal.toLocaleString('en-IN')}
                    </td>
                  </tr>

                  {/* Optional Breakdown: Discount & Taxes */}
                  {currentEstimate.discountTotal > 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="border border-black py-1.5 px-3 text-right font-semibold text-[10px] text-neutral-600 uppercase"
                      >
                        TOTAL DISCOUNT APPLIED
                      </td>
                      <td className="border border-black py-1.5 px-2 text-right font-bold text-[11px] text-emerald-800">
                        -₹{currentEstimate.discountTotal.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}

                  {currentEstimate.taxTotal > 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="border border-black py-1.5 px-3 text-right font-semibold text-[10px] text-neutral-600 uppercase"
                      >
                        {!currentEstimate.isInterState ? 'GST (CGST + SGST)' : 'IGST (Inter-State)'}
                      </td>
                      <td className="border border-black py-1.5 px-2 text-right font-bold text-[11px] text-neutral-700">
                        ₹{currentEstimate.taxTotal.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}

                  {/* Summary Row 2: Final Grand Total */}
                  <tr className="border-t-2 border-black bg-neutral-50/80">
                    <td
                      colSpan={6}
                      className="border border-black py-3 px-3 text-right font-black uppercase tracking-wider text-xs text-black"
                    >
                      FINAL PAYABLE AMOUNT (GRAND TOTAL)
                    </td>
                    <td className="border border-black py-3 px-2 text-right font-black text-sm text-black font-sans">
                      ₹{currentEstimate.grandTotal.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Notes & Terms + Signatory */}
              <div className="mt-8 pt-4 flex justify-between items-start">
                <div className="w-7/12 text-[10px] text-neutral-700 space-y-1">
                  <p className="font-bold text-black uppercase tracking-wider">Notes & Terms:</p>
                  <p>1. This estimate is valid for {currentEstimate.validityDays || 15} days from the date of issue.</p>
                  <p>2. Subject to product availability at the time of final confirmation.</p>
                </div>

                <div className="w-5/12 text-right">
                  <div className="h-10"></div>
                  <div className="w-48 ml-auto border-b border-black mb-1"></div>
                  <p className="text-[11px] font-bold text-black">Authorized Signatory</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions Bar */}
        <div className="px-6 py-4 border-t border-stone-800 bg-stone-900 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPdf}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-md"
              title="Download or save high-resolution PDF with images"
            >
              <FileDown className="w-4 h-4" />
              <span>{downloadingPdf ? 'Preparing PDF...' : 'Download PDF'}</span>
            </button>

            {/* Download Excel Button */}
            <button
              onClick={handleDownloadExcel}
              disabled={downloadingExcel}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-md"
              title="Download estimate line items, MRP, and discount in Excel format"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{downloadingExcel ? 'Exporting...' : 'Download Excel'}</span>
            </button>

            {/* Add / Edit Discount Button */}
            {currentEstimate.status !== 'CONVERTED' && (
              <button
                onClick={() => setIsEditingDiscount(!isEditingDiscount)}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isEditingDiscount
                    ? 'bg-amber-950 text-amber-400 border-amber-600'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
                }`}
                title="Add or update discount on this estimate"
              >
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>{isEditingDiscount ? 'Close Discount Editor' : 'Add / Edit Discount'}</span>
              </button>
            )}

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-stone-400" />
              <span>Print</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenWhatsApp}
              className="px-3 py-2 rounded-xl bg-emerald-950 border border-emerald-800 hover:bg-emerald-900 text-emerald-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Open WhatsApp chat with formatted estimate"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            {currentEstimate.status !== 'CONVERTED' && onConvertToBill && (
              <button
                onClick={handleConvertClick}
                disabled={converting}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs tracking-wide flex items-center gap-1.5 shadow-lg shadow-amber-950/50 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{converting ? 'Converting...' : 'Convert to Bill'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
