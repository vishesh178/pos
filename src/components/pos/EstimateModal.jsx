import React, { useState } from 'react';
import {
  X,
  Printer,
  FileText,
  Share2,
  Copy,
  Check,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function EstimateModal({
  isOpen,
  onClose,
  estimate,
  businessProfile,
  onConvertToBill,
}) {
  const [layout, setLayout] = useState('a4'); // 'a4' or 'thermal'
  const [copied, setCopied] = useState(false);
  const [converting, setConverting] = useState(false);

  if (!isOpen || !estimate) return null;

  const business = businessProfile || {
    businessName: 'Curated Art',
    legalName: 'Curated Art Luxury Decor Pvt Ltd',
    gstin: '24AAAAA0000A1Z5',
    address: 'Showroom #104, Design District, SG Highway, Ahmedabad, Gujarat - 380054',
    phone: '+91 98765 43210',
    email: 'contact@curatedart.in',
  };

  const handlePrint = () => {
    window.print();
  };

  const estimateDate = new Date(estimate.createdAt || Date.now());
  const dateFormatted = estimateDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const validUntilDate = new Date(estimateDate.getTime() + (estimate.validityDays || 15) * 86400000);
  const validUntilFormatted = validUntilDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Generate WhatsApp message text
  const generateWhatsAppText = () => {
    const lines = (estimate.items || []).map((it, idx) => {
      return `${idx + 1}. *${it.productName}* (${it.sku})\n   ${it.quantity} pc(s) @ ₹${it.unitPrice.toLocaleString('en-IN')} = ₹${it.totalAmount.toLocaleString('en-IN')}`;
    }).join('\n\n');

    return (
      `🏛️ *CURATED ART — Luxury Home Décor*\n` +
      `*Quotation / Estimate:* #${estimate.estimateNumber}\n` +
      `*Date:* ${dateFormatted} (Valid for ${estimate.validityDays || 15} days)\n` +
      `*Client:* ${estimate.customerName}\n\n` +
      `📋 *Quoted Pieces:*\n${lines}\n\n` +
      `───────────────\n` +
      `*Subtotal:* ₹${estimate.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
      (estimate.discountTotal > 0 ? `*Discount:* -₹${estimate.discountTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` : '') +
      `*GST:* ₹${estimate.taxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
      `*Grand Total: ₹${estimate.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*\n` +
      `───────────────\n\n` +
      `📍 *Showroom:* ${business.address}\n` +
      `📞 *Phone:* ${business.phone}\n\n` +
      `💬 *Reply to this message to confirm your order or request custom adjustments!*`
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
    const cleanPhone = (estimate.customerMobile || '').replace(/\D/g, '');
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
      await onConvertToBill(estimate);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
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
                  Estimate / Quotation {estimate.estimateNumber}
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    estimate.status === 'CONVERTED'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : estimate.status === 'CANCELLED'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}
                >
                  {estimate.status || 'PENDING'}
                </span>
                {estimate.zohoEstimateId && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-sky-950 text-sky-400 border border-sky-800">
                    Zoho Quote Synced
                  </span>
                )}
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
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  layout === 'a4'
                    ? 'bg-amber-500 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                A4 Quotation
              </button>
              <button
                onClick={() => setLayout('thermal')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
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

        {/* Printable View Container */}
        <div className="p-6 bg-stone-950 max-h-[65vh] overflow-y-auto flex justify-center">
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
                  <span>Quote No:</span>
                  <span className="font-bold">{estimate.estimateNumber}</span>
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
                  <span className="font-bold">{estimate.customerName}</span>
                </div>
                {estimate.customerMobile && (
                  <div className="flex justify-between">
                    <span>Mobile:</span>
                    <span>{estimate.customerMobile}</span>
                  </div>
                )}
                {estimate.customerGstin && (
                  <div className="flex justify-between">
                    <span>GSTIN:</span>
                    <span>{estimate.customerGstin}</span>
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
                  {(estimate.items || []).map((it, idx) => (
                    <div key={idx} className="flex justify-between items-start">
                      <div className="w-1/2">
                        <p className="font-bold">{it.productName}</p>
                        <p className="text-[8px] text-neutral-500">
                          {it.sku} • HSN:{it.hsnCode} (GST {it.taxRate}%)
                        </p>
                      </div>
                      <div className="w-1/4 text-center">
                        {it.quantity} x ₹{it.unitPrice.toFixed(2)}
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
                  <span>Taxable Subtotal:</span>
                  <span>₹{estimate.subtotal.toFixed(2)}</span>
                </div>
                {estimate.discountTotal > 0 && (
                  <div className="flex justify-between text-neutral-700">
                    <span>Discount:</span>
                    <span>-₹{estimate.discountTotal.toFixed(2)}</span>
                  </div>
                )}
                {!estimate.isInterState ? (
                  <>
                    <div className="flex justify-between">
                      <span>CGST:</span>
                      <span>₹{estimate.cgstTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST:</span>
                      <span>₹{estimate.sgstTotal.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>IGST (Inter-State):</span>
                    <span>₹{estimate.igstTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold pt-1 border-t border-neutral-400">
                  <span>ESTIMATE TOTAL:</span>
                  <span>₹{estimate.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Estimate Note */}
              <div className="pt-2 text-center text-[9px] text-neutral-600 space-y-1">
                <p className="font-bold">Prices valid for {estimate.validityDays || 15} days from quote date.</p>
                <p>Not a Tax Invoice • For Quotation Purposes Only</p>
              </div>
            </div>
          ) : (
            /* A4 Formal Quotation Layout */
            <div
              id="printable-estimate"
              className="w-[720px] bg-white text-stone-900 p-8 font-sans text-xs shadow-xl rounded-sm border border-stone-200"
            >
              {/* Header with Luxury Brand Banner */}
              <div className="flex justify-between items-start pb-6 border-b-2 border-amber-600">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-stone-950 text-amber-500 font-serif font-black flex items-center justify-center text-sm shadow">
                      CA
                    </div>
                    <h1 className="font-serif text-2xl font-black text-stone-950 tracking-wider">
                      {business.businessName.toUpperCase()}
                    </h1>
                  </div>
                  <p className="text-[11px] text-stone-600 font-medium mt-1">{business.legalName}</p>
                  <p className="text-[10px] text-stone-500 max-w-sm mt-0.5 leading-tight">{business.address}</p>
                  <p className="text-[10px] text-stone-600 mt-1">
                    <span className="font-semibold">GSTIN:</span> {business.gstin} |{' '}
                    <span className="font-semibold">Phone:</span> {business.phone}
                  </p>
                  <p className="text-[10px] text-stone-600">
                    <span className="font-semibold">Email:</span> {business.email}
                  </p>
                </div>

                <div className="text-right">
                  <div className="inline-block px-3 py-1 rounded bg-amber-100 text-amber-900 font-bold uppercase tracking-wider text-xs border border-amber-300">
                    ESTIMATE / QUOTATION
                  </div>
                  <div className="mt-3 space-y-1 text-right font-mono text-[11px]">
                    <p>
                      <span className="text-stone-500">Estimate No:</span>{' '}
                      <span className="font-bold text-stone-950">{estimate.estimateNumber}</span>
                    </p>
                    <p>
                      <span className="text-stone-500">Date:</span> {dateFormatted}
                    </p>
                    <p>
                      <span className="text-stone-500">Valid Until:</span>{' '}
                      <span className="font-semibold text-amber-800">{validUntilFormatted}</span>
                    </p>
                    <p>
                      <span className="text-stone-500">Place of Supply:</span>{' '}
                      <span>{estimate.placeOfSupply || '24-Gujarat'}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Info Box */}
              <div className="my-5 p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Quotation Prepared For:</p>
                  <p className="font-bold text-sm text-stone-900 mt-0.5">{estimate.customerName}</p>
                  {estimate.customerMobile && (
                    <p className="text-[11px] text-stone-600">Phone: {estimate.customerMobile}</p>
                  )}
                  {estimate.customerGstin && (
                    <p className="text-[11px] font-mono text-stone-700">GSTIN: {estimate.customerGstin}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Quotation Status:</p>
                  <span className="inline-block mt-1 font-bold text-xs uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    {estimate.status}
                  </span>
                  {estimate.convertedInvoiceId && (
                    <p className="text-[10px] text-emerald-700 font-mono mt-1">
                      Converted to Bill: {estimate.convertedInvoiceId}
                    </p>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border-collapse my-4">
                <thead>
                  <tr className="bg-stone-900 text-amber-400 text-[10px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 rounded-l">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-2">HSN</th>
                    <th className="py-2.5 px-2 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-2 text-center">GST</th>
                    <th className="py-2.5 px-3 text-right">Taxable (₹)</th>
                    <th className="py-2.5 px-3 text-right rounded-r">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-[11px]">
                  {(estimate.items || []).map((it, idx) => (
                    <tr key={idx} className="hover:bg-stone-50">
                      <td className="py-2.5 px-3 text-stone-500">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-stone-900">{it.productName}</p>
                        <p className="text-[9px] text-stone-500 font-mono">SKU: {it.sku}</p>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-stone-600">{it.hsnCode}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-stone-900">{it.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono">₹{it.unitPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-stone-600">{it.taxRate}%</td>
                      <td className="py-2.5 px-3 text-right font-mono">₹{it.taxableAmount.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900">
                        ₹{it.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Summary */}
              <div className="flex justify-between items-start pt-3 border-t border-stone-200">
                <div className="w-1/2 space-y-2 text-[10px] text-stone-600">
                  <p className="font-bold uppercase tracking-wider text-stone-800">Bank & Payment Details for Order Confirmation:</p>
                  <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200 font-mono space-y-0.5 text-[9px]">
                    <p><span className="text-stone-500">Bank:</span> HDFC Bank Ltd | A/C No: 50200012345678</p>
                    <p><span className="text-stone-500">IFSC:</span> HDFC0001234 | Branch: SG Highway, Ahmedabad</p>
                    <p><span className="text-stone-500">UPI ID:</span> curatedart@hdfcbank</p>
                  </div>
                  {estimate.notes && (
                    <p className="italic text-stone-500 mt-2">
                      <span className="font-semibold text-stone-700">Notes:</span> {estimate.notes}
                    </p>
                  )}
                </div>

                <div className="w-5/12 space-y-1.5 font-mono text-[11px] text-right">
                  <div className="flex justify-between text-stone-600">
                    <span>Taxable Subtotal:</span>
                    <span>₹{estimate.subtotal.toFixed(2)}</span>
                  </div>
                  {estimate.discountTotal > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Discount:</span>
                      <span>-₹{estimate.discountTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {!estimate.isInterState ? (
                    <>
                      <div className="flex justify-between text-stone-600">
                        <span>CGST:</span>
                        <span>₹{estimate.cgstTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>SGST:</span>
                        <span>₹{estimate.sgstTotal.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-stone-600">
                      <span>IGST (Inter-State):</span>
                      <span>₹{estimate.igstTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {estimate.roundOff !== 0 && (
                    <div className="flex justify-between text-stone-500 text-[10px]">
                      <span>Round Off:</span>
                      <span>{estimate.roundOff > 0 ? `+₹${estimate.roundOff.toFixed(2)}` : `-₹${Math.abs(estimate.roundOff).toFixed(2)}`}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-stone-950 pt-2 border-t-2 border-stone-900 font-serif">
                    <span>ESTIMATE TOTAL:</span>
                    <span className="font-mono text-base text-amber-700">₹{estimate.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Quotation Terms & Signature */}
              <div className="mt-8 pt-4 border-t border-stone-200 flex justify-between items-end">
                <div className="w-2/3 text-[9px] text-stone-500 space-y-0.5">
                  <p className="font-bold text-stone-800 uppercase tracking-wider">Quotation Terms & Conditions:</p>
                  <p>1. This estimate is valid for {estimate.validityDays || 15} days from the date of issue.</p>
                  <p>2. Physical stock availability is re-confirmed at the time of final booking / payment.</p>
                  <p>3. Fragile luxury décor is carefully quality-checked and packaged prior to handover.</p>
                  <p>4. This document is a formal quotation, not a tax invoice. Final GST Tax Invoice issued upon billing.</p>
                </div>
                <div className="text-right">
                  <div className="h-10"></div>
                  <p className="text-[10px] font-bold text-stone-900">For CURATED ART</p>
                  <p className="text-[9px] text-stone-500">Authorized Signatory</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions Bar */}
        <div className="px-6 py-4 border-t border-stone-800 bg-stone-900 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print Quotation</span>
            </button>
            <button
              onClick={handleOpenWhatsApp}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs flex items-center gap-2 transition-colors shadow-md shadow-emerald-950/40 cursor-pointer"
              title="Open WhatsApp chat with formatted estimate"
            >
              <Share2 className="w-4 h-4" />
              <span>Send on WhatsApp</span>
            </button>
            <button
              onClick={handleCopyWhatsApp}
              className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copy WhatsApp text to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {estimate.status !== 'CONVERTED' && onConvertToBill && (
              <button
                onClick={handleConvertClick}
                disabled={converting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs tracking-wide flex items-center gap-2 shadow-lg shadow-amber-950/50 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{converting ? 'Converting...' : 'Convert to Final Bill'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

