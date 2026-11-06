import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Search,
  AlertCircle,
  CheckCircle,
  FileText,
  PackageCheck,
  PackageX,
  CreditCard,
  Banknote,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SalesReturnsPage() {
  const { token } = useAuth();
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [nearestMatches, setNearestMatches] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);

  // Return items selection: map of productId -> { selected, quantity, condition, refundAmount }
  const [selectedItems, setSelectedItems] = useState({});
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [reason, setReason] = useState('Customer exchange / return within 7 days');
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);

  // Load recent invoices on page mount for one-click selection
  useEffect(() => {
    fetchRecentInvoices();
  }, []);

  const fetchRecentInvoices = async () => {
    try {
      const res = await fetch('/api/pos/invoices?limit=5');
      if (res.ok) {
        const data = await res.json();
        setRecentInvoices(data || []);
      }
    } catch (err) {
      console.warn('Failed to fetch recent invoices for returns:', err);
    }
  };

  const executeInvoiceLookup = async (lookupQuery) => {
    const q = (lookupQuery || invoiceQuery || '').trim();
    if (!q) return;

    setLoading(true);
    setSearchError('');
    setNearestMatches([]);
    setInvoice(null);
    setSuccessResult(null);

    try {
      const res = await fetch(`/api/pos/invoices/${encodeURIComponent(q)}`);
      const data = await res.json();

      if (!res.ok) {
        setSearchError(data.error || 'Invoice not found.');
        if (data.nearestMatches && data.nearestMatches.length > 0) {
          setNearestMatches(data.nearestMatches);
        }
        return;
      }

      setInvoice(data.invoice);
      setInvoiceQuery(data.invoice.invoiceNumber);

      // Initialize selected items state
      const initialMap = {};
      data.invoice.items.forEach((it) => {
        initialMap[it.productId] = {
          selected: false,
          quantity: 1,
          maxQuantity: it.quantity,
          condition: 'RESTOCKABLE',
          unitPrice: it.unitPrice,
          refundAmount: it.unitPrice,
        };
      });
      setSelectedItems(initialMap);
    } catch (err) {
      setSearchError(err.message || 'Failed to search invoice.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchInvoice = (e) => {
    if (e) e.preventDefault();
    executeInvoiceLookup(invoiceQuery);
  };

  const handleSelectInvoice = (invNum) => {
    setInvoiceQuery(invNum);
    executeInvoiceLookup(invNum);
  };

  const toggleItemSelect = (productId) => {
    setSelectedItems((prev) => {
      const curr = prev[productId];
      return {
        ...prev,
        [productId]: { ...curr, selected: !curr.selected },
      };
    });
  };

  const updateItemQty = (productId, qty) => {
    const q = parseInt(qty, 10) || 1;
    setSelectedItems((prev) => {
      const curr = prev[productId];
      const validQty = Math.min(curr.maxQuantity, Math.max(1, q));
      return {
        ...prev,
        [productId]: {
          ...curr,
          quantity: validQty,
          refundAmount: validQty * curr.unitPrice,
        },
      };
    });
  };

  const updateItemCondition = (productId, condition) => {
    setSelectedItems((prev) => {
      const curr = prev[productId];
      return {
        ...prev,
        [productId]: { ...curr, condition },
      };
    });
  };

  const totalRefund = Object.values(selectedItems)
    .filter((it) => it.selected)
    .reduce((sum, it) => sum + it.refundAmount, 0);

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    const returnItems = Object.entries(selectedItems)
      .filter(([_, it]) => it.selected)
      .map(([prodId, it]) => ({
        productId: prodId,
        quantity: it.quantity,
        refundAmount: it.refundAmount,
        condition: it.condition,
      }));

    if (returnItems.length === 0) {
      alert('Please select at least one item to return.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/pos/returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          reason,
          refundMethod,
          items: returnItems,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process return');

      setSuccessResult(data);
      setInvoice(null);
      window.dispatchEvent(new CustomEvent('inventory-updated'));
    } catch (err) {
      alert('Return error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold font-serif text-stone-100 flex items-center gap-2">
          <RotateCcw className="w-6 h-6 text-amber-500" />
          <span>Sales Returns & Credit Notes Management</span>
        </h1>
        <p className="text-xs text-stone-400 mt-1">
          Issue customer refunds, credit notes, and route restockable or damaged décor inventory
        </p>
      </div>

      {/* Invoice Search Box */}
      <div className="p-6 bg-stone-900 border border-stone-800 rounded-2xl shadow-xl space-y-4">
        <form onSubmit={handleSearchInvoice} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              required
              value={invoiceQuery}
              onChange={(e) => setInvoiceQuery(e.target.value)}
              placeholder="Enter Invoice Number (e.g. CA-1028 or just 1028)..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm focus:border-amber-500 focus:outline-none font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs tracking-wide transition-all disabled:opacity-50"
          >
            {loading ? 'Finding...' : 'Find Invoice'}
          </button>
        </form>

        {/* Quick Recent Invoices Picker */}
        {recentInvoices.length > 0 && !invoice && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-stone-400 flex items-center gap-1 text-[11px]">
              <Clock className="w-3 h-3 text-stone-400" />
              Recent:
            </span>
            {recentInvoices.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => handleSelectInvoice(inv.invoiceNumber)}
                className="px-2.5 py-1 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/50 text-stone-300 hover:text-amber-400 font-mono text-[11px] transition-all flex items-center gap-1.5"
              >
                <span className="font-semibold">{inv.invoiceNumber}</span>
                <span className="text-stone-500">•</span>
                <span className="text-amber-400 font-sans">₹{inv.grandTotal?.toFixed(0)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Search Error Alert */}
        {searchError && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Nearest Matches Suggestion Cards */}
        {nearestMatches.length > 0 && (
          <div className="p-4 bg-stone-950/90 border border-amber-500/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Nearest Matching Invoices:
              </span>
              <span className="text-[11px] text-stone-400">Click to select and issue return</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {nearestMatches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectInvoice(m.invoiceNumber)}
                  className="text-left p-3 rounded-lg bg-stone-900 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/80 transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400 group-hover:text-amber-300 text-xs">
                        {m.invoiceNumber}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">
                        {m.paymentMethod || 'PAID'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-300 truncate max-w-[160px] mt-0.5">
                      {m.customerName || 'Walk-in Retail Customer'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-xs text-stone-100">
                      ₹{m.grandTotal?.toFixed(2)}
                    </span>
                    <p className="text-[10px] text-amber-500 group-hover:text-amber-400 font-semibold flex items-center justify-end gap-0.5 mt-0.5">
                      Select <ArrowRight className="w-3 h-3" />
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Success Notification */}
      {successResult && (
        <div className="p-6 bg-emerald-950/60 border border-emerald-800 rounded-2xl text-emerald-300 space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
            <div>
              <h3 className="font-serif font-bold text-lg text-emerald-100">
                Credit Note Issued: {successResult.salesReturn.returnNumber}
              </h3>
              <p className="text-xs text-emerald-400">
                Refund of ₹{successResult.salesReturn.totalRefundAmount.toFixed(2)} recorded successfully.
              </p>
            </div>
          </div>
          <p className="text-xs text-stone-300">
            Stock movements and inventory adjustments were logged. Outbox sync job enqueued for Zoho Books.
          </p>
        </div>
      )}

      {/* Invoice Details & Return Form */}
      {invoice && (
        <form onSubmit={handleSubmitReturn} className="p-6 bg-stone-900 border border-stone-800 rounded-2xl shadow-xl space-y-6">
          <div className="flex justify-between items-start pb-4 border-b border-stone-800 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500">
                Original Invoice
              </span>
              <h3 className="text-lg font-bold font-serif text-stone-100 mt-0.5">
                {invoice.invoiceNumber}
              </h3>
              <p className="text-stone-400 mt-0.5">
                Customer: <span className="text-stone-200 font-semibold">{invoice.customerName}</span>
                {invoice.customerMobile && ` (${invoice.customerMobile})`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-stone-400">Date: {new Date(invoice.createdAt).toLocaleDateString('en-IN')}</p>
              <p className="text-stone-400">Original Total: ₹{invoice.grandTotal.toFixed(2)}</p>
              <p className="text-emerald-400 font-semibold">{invoice.paymentStatus} ({invoice.paymentMethod})</p>
            </div>
          </div>

          {/* Select Items Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-300 mb-3">
              Select Items to Return:
            </h4>
            <div className="space-y-3">
              {invoice.items.map((it) => {
                const state = selectedItems[it.productId] || {};
                return (
                  <div
                    key={it.id}
                    className={`p-3.5 rounded-xl border transition-colors ${
                      state.selected
                        ? 'bg-amber-500/5 border-amber-500/60'
                        : 'bg-stone-950 border-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!state.selected}
                          onChange={() => toggleItemSelect(it.productId)}
                          className="w-4 h-4 rounded text-amber-500 bg-stone-900 border-stone-700"
                        />
                        <div>
                          <p className="text-sm font-semibold text-stone-100 font-serif">
                            {it.productName}
                          </p>
                          <p className="text-[11px] font-mono text-stone-400">
                            {it.sku} • Invoiced Qty: {it.quantity} @ ₹{it.unitPrice.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {state.selected && (
                        <div className="flex items-center gap-4 text-xs">
                          {/* Qty */}
                          <div className="flex items-center gap-2">
                            <span className="text-stone-400">Return Qty:</span>
                            <input
                              type="number"
                              min="1"
                              max={state.maxQuantity}
                              value={state.quantity}
                              onChange={(e) => updateItemQty(it.productId, e.target.value)}
                              className="w-16 px-2 py-1 bg-stone-900 border border-stone-700 rounded text-center font-mono font-bold text-stone-100"
                            />
                          </div>

                          {/* Condition Selector */}
                          <div className="flex items-center gap-1.5 bg-stone-900 p-1 rounded-lg border border-stone-800">
                            <button
                              type="button"
                              onClick={() => updateItemCondition(it.productId, 'RESTOCKABLE')}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                                state.condition === 'RESTOCKABLE'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'text-stone-400 hover:text-stone-200'
                              }`}
                            >
                              <PackageCheck className="w-3 h-3" />
                              <span>Restock</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItemCondition(it.productId, 'DAMAGED')}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                                state.condition === 'DAMAGED'
                                  ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                  : 'text-stone-400 hover:text-stone-200'
                              }`}
                            >
                              <PackageX className="w-3 h-3" />
                              <span>Damaged</span>
                            </button>
                          </div>

                          <div className="font-mono font-bold text-amber-400 text-sm">
                            ₹{state.refundAmount.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Refund Method & Reason */}
          <div className="grid grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="block font-semibold text-stone-300 mb-1">Refund Method</label>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100"
              >
                <option value="CASH">Cash Refund</option>
                <option value="UPI">UPI Refund</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-stone-300 mb-1">Return Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100"
              />
            </div>
          </div>

          {/* Bottom Action */}
          <div className="pt-4 border-t border-stone-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-stone-400">Total Refund Amount:</span>
              <p className="text-2xl font-black font-mono text-amber-400">
                ₹{totalRefund.toFixed(2)}
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting || totalRefund === 0}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs tracking-wide transition-all shadow-lg shadow-amber-950/40 disabled:opacity-40"
            >
              {submitting ? 'Processing Return...' : 'Issue Credit Note & Refund'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

