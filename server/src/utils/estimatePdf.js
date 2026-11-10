const fs = require('fs');
const path = require('path');
let PDFDocument = null;
try {
  PDFDocument = require('pdfkit');
} catch (_) {}

function formatCurrency(amount) {
  const num = Math.round(Number(amount) || 0);
  return 'Rs.' + num.toLocaleString('en-IN') + '/-';
}

/**
 * Generate a clean, branded A4 Quotation/Estimate PDF Buffer
 */
async function generateEstimatePdf(estimate, business = {}) {
  if (!PDFDocument) {
    try {
      PDFDocument = require('pdfkit');
    } catch (_) {
      throw new Error('PDFKit module is not installed on this server.');
    }
  }

  const bizName = business.businessName || 'Curated Art';
  const bizLegal = business.legalName || 'Curated Art Luxury Decor Pvt Ltd';
  const bizGstin = business.gstin || '24AAAAA0000A1Z5';
  const bizAddress = business.address || 'Showroom #104, Design District, SG Highway, Ahmedabad, Gujarat - 380054';
  const bizPhone = business.phone || '+91 98765 43210';
  const bizEmail = business.email || 'contact@curatedart.in';

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        info: {
          Title: `Estimate ${estimate.estimateNumber || ''}`,
          Author: bizName,
          Subject: 'Commercial Quotation / Estimate',
        },
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const margin = 36;
      const contentWidth = 595.28 - margin * 2; // 523.28 pt
      let cursorY = margin;

      // 1. Header
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#b45309');
      doc.text(bizName.toUpperCase(), margin, cursorY);
      cursorY += 20;

      doc.font('Helvetica').fontSize(9).fillColor('#44403c');
      doc.text(bizAddress, margin, cursorY, { width: 320 });
      cursorY += 14;

      doc.font('Helvetica').fontSize(8.5).fillColor('#78716c');
      doc.text(`Ph: ${bizPhone}  •  Email: ${bizEmail}`, margin, cursorY);
      cursorY += 12;
      doc.text(`GSTIN: ${bizGstin}`, margin, cursorY);

      // Right Header - Document Title & Details
      const rightX = margin + contentWidth - 170;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#b45309');
      doc.text('ESTIMATE / QUOTATION', rightX, margin, { align: 'right', width: 170 });

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#1c1917');
      doc.text(`# ${estimate.estimateNumber || 'EST-DRAFT'}`, rightX, margin + 16, { align: 'right', width: 170 });

      const dateStr = estimate.createdAt
        ? new Date(estimate.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN');
      doc.font('Helvetica').fontSize(8.5).fillColor('#78716c');
      doc.text(`Date: ${dateStr}`, rightX, margin + 32, { align: 'right', width: 170 });

      if (estimate.validUntil) {
        const validStr = new Date(estimate.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        doc.text(`Valid Until: ${validStr}`, rightX, margin + 44, { align: 'right', width: 170 });
      }

      cursorY = Math.max(cursorY + 14, margin + 65);
      doc.strokeColor('#b45309').lineWidth(1.5).moveTo(margin, cursorY).lineTo(margin + contentWidth, cursorY).stroke();
      cursorY += 12;

      // 2. Customer Details Box
      doc.roundedRect(margin, cursorY, contentWidth, 42, 6)
        .lineWidth(0.8).strokeColor('#e7e5e4').fillAndStroke('#fafaf9', '#e7e5e4');

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#78716c');
      doc.text('PREPARED FOR:', margin + 10, cursorY + 8);

      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1c1917');
      doc.text(estimate.customerName || 'Walk-in Customer', margin + 10, cursorY + 20);

      if (estimate.customerMobile) {
        doc.font('Helvetica').fontSize(9).fillColor('#44403c');
        doc.text(`Mobile: ${estimate.customerMobile}`, margin + contentWidth - 180, cursorY + 20, { align: 'right', width: 170 });
      }

      cursorY += 52;

      // 3. Line Items Table Header
      const colWidths = {
        idx: 24,
        desc: 220,
        hsn: 45,
        qty: 35,
        rate: 65,
        disc: 55,
        total: 79.28,
      };

      doc.rect(margin, cursorY, contentWidth, 20).fill('#292524');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');

      let colX = margin + 6;
      doc.text('#', colX, cursorY + 6, { width: colWidths.idx });
      colX += colWidths.idx;
      doc.text('ITEM & DESCRIPTION', colX, cursorY + 6, { width: colWidths.desc });
      colX += colWidths.desc;
      doc.text('HSN', colX, cursorY + 6, { width: colWidths.hsn });
      colX += colWidths.hsn;
      doc.text('QTY', colX, cursorY + 6, { width: colWidths.qty, align: 'center' });
      colX += colWidths.qty;
      doc.text('RATE (₹)', colX, cursorY + 6, { width: colWidths.rate, align: 'right' });
      colX += colWidths.rate;
      doc.text('DISC (₹)', colX, cursorY + 6, { width: colWidths.disc, align: 'right' });
      colX += colWidths.disc;
      doc.text('TOTAL (₹)', colX, cursorY + 6, { width: colWidths.total, align: 'right' });

      cursorY += 20;

      // 4. Line Items Rows
      const items = estimate.items || [];
      items.forEach((it, idx) => {
        const rowHeight = 24;
        const bg = idx % 2 === 0 ? '#ffffff' : '#f5f5f4';
        doc.rect(margin, cursorY, contentWidth, rowHeight).fill(bg);

        doc.font('Helvetica').fontSize(8).fillColor('#1c1917');
        colX = margin + 6;
        doc.text(String(idx + 1), colX, cursorY + 7, { width: colWidths.idx });
        colX += colWidths.idx;

        const title = it.productName || it.product?.name || 'Item';
        const sku = it.sku || it.product?.sku ? ` [${it.sku || it.product?.sku}]` : '';
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1c1917');
        doc.text(`${title}${sku}`, colX, cursorY + 7, { width: colWidths.desc - 10, ellipsis: true });
        colX += colWidths.desc;

        doc.font('Helvetica').fontSize(8).fillColor('#78716c');
        doc.text(it.hsnCode || '9701', colX, cursorY + 7, { width: colWidths.hsn });
        colX += colWidths.hsn;

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1c1917');
        doc.text(String(it.quantity || 1), colX, cursorY + 7, { width: colWidths.qty, align: 'center' });
        colX += colWidths.qty;

        doc.font('Helvetica').fontSize(8).fillColor('#44403c');
        doc.text(Number(it.unitPrice || 0).toLocaleString('en-IN'), colX, cursorY + 7, { width: colWidths.rate, align: 'right' });
        colX += colWidths.rate;

        const disc = Number(it.discountAmount || 0);
        doc.text(disc > 0 ? `-${disc.toLocaleString('en-IN')}` : '0', colX, cursorY + 7, { width: colWidths.disc, align: 'right' });
        colX += colWidths.disc;

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1c1917');
        doc.text(Number(it.totalAmount || 0).toLocaleString('en-IN'), colX, cursorY + 7, { width: colWidths.total, align: 'right' });

        cursorY += rowHeight;
      });

      // Bottom border of table
      doc.strokeColor('#e7e5e4').lineWidth(1).moveTo(margin, cursorY).lineTo(margin + contentWidth, cursorY).stroke();
      cursorY += 12;

      // 5. Totals & Notes Section
      const summaryWidth = 200;
      const summaryX = margin + contentWidth - summaryWidth;

      doc.font('Helvetica').fontSize(8.5).fillColor('#44403c');
      doc.text('Subtotal:', summaryX, cursorY);
      doc.text(`₹${Number(estimate.subtotal || 0).toLocaleString('en-IN')}`, summaryX, cursorY, { align: 'right', width: summaryWidth });
      cursorY += 14;

      if (estimate.discountTotal > 0) {
        doc.font('Helvetica').fontSize(8.5).fillColor('#b45309');
        doc.text('Total Discount:', summaryX, cursorY);
        doc.text(`-₹${Number(estimate.discountTotal).toLocaleString('en-IN')}`, summaryX, cursorY, { align: 'right', width: summaryWidth });
        cursorY += 14;
      }

      if (estimate.taxTotal > 0) {
        doc.font('Helvetica').fontSize(8.5).fillColor('#44403c');
        doc.text('GST Tax Total:', summaryX, cursorY);
        doc.text(`₹${Number(estimate.taxTotal).toLocaleString('en-IN')}`, summaryX, cursorY, { align: 'right', width: summaryWidth });
        cursorY += 14;
      }

      if (estimate.roundOff && estimate.roundOff !== 0) {
        doc.font('Helvetica').fontSize(8).fillColor('#78716c');
        doc.text('Round Off:', summaryX, cursorY);
        doc.text(`₹${Number(estimate.roundOff).toFixed(2)}`, summaryX, cursorY, { align: 'right', width: summaryWidth });
        cursorY += 14;
      }

      // Grand Total Highlight
      doc.rect(summaryX - 6, cursorY - 2, summaryWidth + 6, 22).fill('#292524');
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff');
      doc.text('GRAND TOTAL:', summaryX, cursorY + 4);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#f59e0b');
      doc.text(formatCurrency(estimate.grandTotal), summaryX, cursorY + 3, { align: 'right', width: summaryWidth });

      cursorY += 36;

      // Terms & Signature
      const terms = business.termsAndConditions || '1. Goods once sold can only be exchanged within 7 days in original packing.\n2. Fragile items must be inspected at the time of delivery.\n3. All disputes subject to Ahmedabad jurisdiction.';
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#78716c');
      doc.text('TERMS & CONDITIONS:', margin, cursorY);
      doc.font('Helvetica').fontSize(7.5).fillColor('#78716c');
      doc.text(terms, margin, cursorY + 12, { width: 320 });

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1c1917');
      doc.text(`For ${bizName.toUpperCase()}`, margin + contentWidth - 160, cursorY + 20, { align: 'right', width: 160 });
      doc.font('Helvetica').fontSize(7.5).fillColor('#78716c');
      doc.text('Authorized Signatory', margin + contentWidth - 160, cursorY + 45, { align: 'right', width: 160 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateEstimatePdf };
