import React, { useState } from 'react';
import { X, Printer, FileText, CheckCircle2, RotateCcw, ArrowRight } from 'lucide-react';

export default function ReceiptModal({ isOpen, onClose, invoice, businessProfile, onNewSale }) {
  const [layout, setLayout] = useState('thermal'); // 'thermal' or 'a4'

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const business = businessProfile || {
    businessName: 'Curated Art',
    legalName: 'Curated Art Luxury Decor Pvt Ltd',
    gstin: '24AAAAA0000A1Z5',
    address: 'Showroom #104, Design District, SG Highway, Ahmedabad, Gujarat - 380054',
    phone: '+91 98765 43210',
    email: 'contact@curatedart.in',
    termsAndConditions: '1. Goods once sold can only be exchanged within 7 days in original packing.\n2. Fragile items (glass, mirrors) must be inspected at the time of delivery.\n3. All disputes subject to Ahmedabad jurisdiction.',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-6">
        {/* Modal Top Actions */}
        <div className="px-6 py-3.5 border-b border-stone-800 flex items-center justify-between bg-stone-900/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm text-stone-100">
                Invoice {invoice.invoiceNumber} Generated
              </h3>
              <p className="text-[11px] text-emerald-400 font-medium">Sale completed successfully</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-stone-950 p-1 rounded-xl border border-stone-800 flex items-center text-xs">
              <button
                onClick={() => setLayout('thermal')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  layout === 'thermal'
                    ? 'bg-amber-500 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                80mm Thermal
              </button>
              <button
                onClick={() => setLayout('a4')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  layout === 'a4'
                    ? 'bg-amber-500 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                A4 Tax Invoice
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div className="p-6 bg-stone-950 max-h-[65vh] overflow-y-auto flex justify-center">
          {layout === 'thermal' ? (
            /* 80mm Thermal Receipt Layout */
            <div
              id="printable-receipt"
              className="w-[320px] bg-white text-black p-4 font-mono text-[11px] rounded-sm shadow-md border border-neutral-300 leading-tight"
            >
              {/* Thermal Header */}
              <div className="text-center pb-2 border-b border-dashed border-neutral-400 space-y-0.5">
                <div className="text-sm font-bold tracking-wider font-serif">CURATED ART</div>
                <div className="text-[9px] text-neutral-600 uppercase">Luxury Home Décor & Wall Art</div>
                <div className="text-[9px] text-neutral-700 leading-snug">{business.address}</div>
                <div className="text-[10px] font-bold mt-1">GSTIN: {business.gstin}</div>
                <div className="text-[9px]">Ph: {business.phone}</div>
              </div>

              {/* Meta */}
              <div className="py-2 border-b border-dashed border-neutral-400 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Invoice: {invoice.invoiceNumber}</span>
                  <span>
                    {new Date(invoice.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="truncate max-w-[180px]">Cust: {invoice.customerName}</span>
                  <span>
                    {new Date(invoice.createdAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {invoice.customerMobile && <div>Ph: {invoice.customerMobile}</div>}
                {invoice.customerGstin && <div>GSTIN: {invoice.customerGstin}</div>}
                {invoice.pricebookName && <div className="text-[9px] font-bold text-neutral-800">Tier: {invoice.pricebookName}</div>}
              </div>

              {/* Items Table */}
              <div className="py-2 border-b border-dashed border-neutral-400">
                <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-neutral-300">
                  <span className="w-36">Item</span>
                  <span className="w-10 text-center">Qty</span>
                  <span className="w-14 text-right">Price</span>
                  <span className="w-16 text-right">Total</span>
                </div>
                <div className="divide-y divide-neutral-100 text-[10px]">
                  {invoice.items.map((it, idx) => (
                    <div key={idx} className="py-1">
                      <div className="font-semibold truncate">{it.productName}</div>
                      <div className="flex justify-between text-neutral-600">
                        <span className="w-36 text-[9px]">{it.hsnCode ? `HSN:${it.hsnCode}` : ''}</span>
                        <span className="w-10 text-center">{it.quantity}</span>
                        <span className="w-14 text-right">{it.unitPrice.toFixed(2)}</span>
                        <span className="w-16 text-right font-bold text-black">{it.totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Breakdown */}
              <div className="py-2 border-b border-dashed border-neutral-400 text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{invoice.subtotal.toFixed(2)}</span>
                </div>
                {invoice.discountTotal > 0 && (
                  <div className="flex justify-between text-neutral-700">
                    <span>Discount:</span>
                    <span>-₹{invoice.discountTotal.toFixed(2)}</span>
                  </div>
                )}
                {!invoice.isInterState ? (
                  <>
                    <div className="flex justify-between text-neutral-600">
                      <span>CGST Total:</span>
                      <span>₹{invoice.cgstTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-600">
                      <span>SGST Total:</span>
                      <span>₹{invoice.sgstTotal.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-neutral-600">
                    <span>IGST Total:</span>
                    <span>₹{invoice.igstTotal.toFixed(2)}</span>
                  </div>
                )}
                {invoice.roundOff !== 0 && (
                  <div className="flex justify-between text-neutral-600">
                    <span>Round Off:</span>
                    <span>₹{invoice.roundOff > 0 ? `+${invoice.roundOff.toFixed(2)}` : invoice.roundOff.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-neutral-400">
                  <span>GRAND TOTAL:</span>
                  <span>₹{invoice.grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] font-semibold text-neutral-800">
                  <span>Amount Paid ({invoice.paymentMethod}):</span>
                  <span>₹{invoice.paidAmount.toFixed(2)}</span>
                </div>
                {invoice.balanceAmount > 0 && (
                  <div className="flex justify-between text-[10px] font-bold text-red-600 pt-0.5">
                    <span>BALANCE DUE:</span>
                    <span>₹{invoice.balanceAmount.toFixed(2)}</span>
                  </div>
                )}
                {invoice.paymentStatus && invoice.paymentStatus !== 'PAID' && (
                  <div className="text-center text-[9px] font-bold uppercase tracking-wider text-red-600 pt-1 border-t border-dashed border-red-300 mt-1">
                    *** {invoice.paymentStatus === 'PARTIAL' ? 'PARTIAL PAYMENT — BALANCE DUE' : 'UNPAID CREDIT BILL'} ***
                  </div>
                )}
              </div>

              {/* Terms & Footer */}
              <div className="pt-2 text-center text-[8px] text-neutral-600 space-y-1">
                <div className="font-semibold text-neutral-800">Thank you for visiting Curated Art!</div>
                <div>Goods once sold can be exchanged within 7 days.</div>
                <div className="text-[7px]">www.curatedart.in</div>
              </div>
            </div>
          ) : (
            /* A4 Full GST Tax Invoice Layout */
            <div
              id="printable-receipt"
              className="w-full max-w-2xl bg-white text-black p-8 font-sans text-xs rounded-sm shadow-md border border-neutral-300"
            >
              {/* A4 Header */}
              <div className="flex justify-between items-start border-b-2 border-neutral-900 pb-4">
                <div>
                  <h2 className="text-xl font-bold font-serif tracking-wider">{business.businessName}</h2>
                  <p className="text-[11px] text-neutral-700">{business.legalName}</p>
                  <p className="text-[10px] text-neutral-600 mt-1 max-w-sm">{business.address}</p>
                  <p className="text-[10px] font-semibold mt-1">GSTIN: {business.gstin}</p>
                  <p className="text-[10px] text-neutral-600">State: {business.state} (Code: 24)</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-neutral-900 text-white font-bold text-xs uppercase tracking-wider mb-2">
                    TAX INVOICE
                  </span>
                  <p className="font-bold text-sm">Invoice #: {invoice.invoiceNumber}</p>
                  <p className="text-neutral-600 text-[11px]">
                    Date: {new Date(invoice.createdAt).toLocaleDateString('en-IN')}
                  </p>
                  <p className="text-neutral-600 text-[11px]">Place of Supply: {invoice.placeOfSupply}</p>
                </div>
              </div>

              {/* Buyer / Bill To */}
              <div className="grid grid-cols-2 gap-4 py-4 border-b border-neutral-300">
                <div>
                  <p className="font-bold text-[11px] uppercase text-neutral-500 mb-1">Bill To / Customer:</p>
                  <p className="font-bold text-sm text-neutral-900">{invoice.customerName}</p>
                  {invoice.customerMobile && <p className="text-neutral-700">Phone: {invoice.customerMobile}</p>}
                  {invoice.customerGstin && <p className="font-semibold text-neutral-800">GSTIN: {invoice.customerGstin}</p>}
                  {invoice.pricebookName && <p className="text-[10px] text-neutral-700 font-semibold mt-0.5">Rate Tier: {invoice.pricebookName}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-[11px] uppercase text-neutral-500 mb-1">Payment Status:</p>
                  <p className="font-bold text-sm text-emerald-700">{invoice.paymentStatus} ({invoice.paymentMethod})</p>
                  <p className="text-neutral-700">Paid: ₹{invoice.paidAmount.toFixed(2)}</p>
                  {invoice.balanceAmount > 0 && <p className="text-rose-600 font-bold">Due: ₹{invoice.balanceAmount.toFixed(2)}</p>}
                </div>
              </div>

              {/* Items Table */}
              <div className="py-4">
                <table className="w-full text-left border border-neutral-300">
                  <thead className="bg-neutral-100 border-b border-neutral-300 text-[10px] uppercase font-bold text-neutral-700">
                    <tr>
                      <th className="p-2 border-r border-neutral-300">#</th>
                      <th className="p-2 border-r border-neutral-300">Description</th>
                      <th className="p-2 border-r border-neutral-300">HSN</th>
                      <th className="p-2 border-r border-neutral-300 text-center">Qty</th>
                      <th className="p-2 border-r border-neutral-300 text-right">Rate (₹)</th>
                      <th className="p-2 border-r border-neutral-300 text-right">Taxable (₹)</th>
                      <th className="p-2 border-r border-neutral-300 text-center">GST %</th>
                      <th className="p-2 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {invoice.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2 border-r border-neutral-200 text-center">{idx + 1}</td>
                        <td className="p-2 border-r border-neutral-200">
                          <p className="font-semibold text-neutral-900">{it.productName}</p>
                          <p className="text-[10px] text-neutral-500">{it.sku}</p>
                        </td>
                        <td className="p-2 border-r border-neutral-200 font-mono text-[11px]">{it.hsnCode}</td>
                        <td className="p-2 border-r border-neutral-200 text-center font-bold">{it.quantity}</td>
                        <td className="p-2 border-r border-neutral-200 text-right font-mono">{it.unitPrice.toFixed(2)}</td>
                        <td className="p-2 border-r border-neutral-200 text-right font-mono">{it.taxableAmount.toFixed(2)}</td>
                        <td className="p-2 border-r border-neutral-200 text-center font-mono">{it.taxRate}%</td>
                        <td className="p-2 text-right font-mono font-bold">{it.totalAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tax Summary & Grand Total */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-neutral-700">
                    <span>Taxable Amount:</span>
                    <span className="font-mono">₹{invoice.subtotal.toFixed(2)}</span>
                  </div>
                  {!invoice.isInterState ? (
                    <>
                      <div className="flex justify-between text-neutral-700">
                        <span>CGST:</span>
                        <span className="font-mono">₹{invoice.cgstTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-neutral-700">
                        <span>SGST:</span>
                        <span className="font-mono">₹{invoice.sgstTotal.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-neutral-700">
                      <span>IGST:</span>
                      <span className="font-mono">₹{invoice.igstTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.roundOff !== 0 && (
                    <div className="flex justify-between text-neutral-700">
                      <span>Round Off:</span>
                      <span className="font-mono">₹{invoice.roundOff.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm border-t-2 border-neutral-900 pt-1.5 text-neutral-900">
                    <span>Grand Total:</span>
                    <span className="font-mono">₹{invoice.grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-neutral-700 pt-1 border-t border-neutral-200">
                    <span>Amount Paid ({invoice.paymentMethod}):</span>
                    <span className="font-mono font-semibold">₹{invoice.paidAmount.toFixed(2)}</span>
                  </div>
                  {invoice.balanceAmount > 0 && (
                    <div className="flex justify-between font-bold text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200 mt-1">
                      <span>Balance Due (Outstanding):</span>
                      <span className="font-mono text-sm">₹{invoice.balanceAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Terms */}
              <div className="mt-8 pt-4 border-t border-neutral-300 text-[9px] text-neutral-600">
                <p className="font-bold uppercase text-neutral-800 mb-1">Terms & Conditions:</p>
                <p className="whitespace-pre-line leading-relaxed">{business.termsAndConditions}</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="px-6 py-4 border-t border-stone-800 flex items-center justify-between bg-stone-900">
          <button
            onClick={() => {
              onClose();
              if (onNewSale) onNewSale();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-800 text-stone-300 hover:text-stone-100 hover:bg-stone-700 text-xs font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Sale (F2)</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-all shadow-lg shadow-amber-950/40"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

