import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  Search,
  Trash2,
  Printer,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Filter,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ReceiptModal from '../components/pos/ReceiptModal';

export default function InvoicesPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selected invoice for receipt preview/print
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [businessProfile, setBusinessProfile] = useState(null);

  // Invoice deletion modal
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchInvoices();
    fetchBusinessProfile();
  }, [statusFilter]);

  const fetchBusinessProfile = async () => {
    try {
      const res = await fetch('/api/settings/profile', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setBusinessProfile(data);
      }
    } catch (err) {
      console.warn('Failed to fetch business profile:', err);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('limit', '150');

      const res = await fetch(`/api/pos/invoices?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchInvoices();
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/pos/invoices/${encodeURIComponent(invoiceToDelete.id)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(res.status === 404 ? 'Delete endpoint not active on running server. Please restart the app.' : text.slice(0, 100));
      }

      if (!res.ok) throw new Error(data.error || 'Failed to delete invoice');

      setNotification({
        type: 'success',
        message: data.message || `Invoice ${invoiceToDelete.invoiceNumber} permanently deleted.`,
      });

      setInvoiceToDelete(null);
      // Refresh list
      fetchInvoices();
      window.dispatchEvent(new CustomEvent('inventory-updated'));
    } catch (err) {
      alert('Delete error: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Quick Stats
  const totalBilled = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const totalBalance = invoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);

  // Filter in memory for instantaneous search feedback
  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const invNum = (inv.invoiceNumber || '').toLowerCase();
    const cust = (inv.customerName || '').toLowerCase();
    const phone = (inv.customerMobile || '').toLowerCase();
    return invNum.includes(q) || cust.includes(q) || phone.includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-serif text-stone-100 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-amber-500" />
            <span>Tax Invoices & Billing Register</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Browse all customer invoices, reprint thermal receipts, manage returns, or permanently void bills
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/pos')}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs tracking-wide transition-all shadow-lg shadow-amber-950/40"
          >
            + Create New POS Bill
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="p-4 bg-emerald-950/70 border border-emerald-800 rounded-2xl text-emerald-300 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-stone-400 hover:text-stone-100 text-xs font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 shadow-lg">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Total Invoices</span>
          <p className="text-2xl font-black font-mono text-stone-100 mt-1">{invoices.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 shadow-lg">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Total Billed</span>
          <p className="text-2xl font-black font-mono text-amber-400 mt-1">₹{totalBilled.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 shadow-lg">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Total Collected</span>
          <p className="text-2xl font-black font-mono text-emerald-400 mt-1">₹{totalPaid.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 shadow-lg">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Balance Due</span>
          <p className="text-2xl font-black font-mono text-rose-400 mt-1">₹{totalBalance.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by invoice number (e.g. 1036 or CA-1036), customer name, or phone..."
            className="w-full pl-10 pr-4 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs focus:border-amber-500 focus:outline-none font-mono"
          />
        </form>

        <div className="flex items-center gap-2 overflow-x-auto">
          {['ALL', 'PAID', 'PARTIAL', 'UNPAID'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                statusFilter === st
                  ? 'bg-amber-500 text-stone-950 shadow-md'
                  : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              {st}
            </button>
          ))}
          <button
            onClick={fetchInvoices}
            title="Refresh Invoices"
            className="p-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-100 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Invoices List / Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-stone-400">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading billing register...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-16 text-center text-stone-400 space-y-2">
            <Receipt className="w-10 h-10 text-stone-600 mx-auto" />
            <p className="text-sm font-semibold text-stone-300">No invoices found</p>
            <p className="text-xs text-stone-500">Try adjusting your search query or status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-800 bg-stone-950/60 text-stone-400 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items Sold</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800 text-stone-200">
                {filteredInvoices.map((inv) => {
                  const itemCount = (inv.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);
                  const isReturned = inv.status === 'RETURNED' || (inv.salesReturns && inv.salesReturns.length > 0);

                  return (
                    <tr key={inv.id} className="hover:bg-stone-850/50 transition-colors group">
                      {/* Invoice Number */}
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {inv.invoiceNumber}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-stone-400 font-mono text-[11px]">
                        {new Date(inv.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                        <span className="block text-[10px] text-stone-500">
                          {new Date(inv.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <p className="font-semibold text-stone-100 truncate max-w-[160px]">
                          {inv.customerName || 'Walk-in Retail Customer'}
                        </p>
                        {inv.customerMobile && (
                          <span className="text-[10px] text-stone-400 font-mono">{inv.customerMobile}</span>
                        )}
                      </td>

                      {/* Items */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-stone-200">
                          {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </span>
                        <p className="text-[10px] text-stone-400 truncate max-w-[200px]">
                          {(inv.items || []).map((i) => `${i.productName} (x${i.quantity})`).join(', ')}
                        </p>
                      </td>

                      {/* Grand Total */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-100">
                        ₹{(inv.grandTotal || 0).toFixed(2)}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                            inv.paymentStatus === 'PAID'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                              : inv.paymentStatus === 'PARTIAL'
                              ? 'bg-amber-950/80 text-amber-400 border border-amber-800/80'
                              : 'bg-rose-950/80 text-rose-400 border border-rose-800/80'
                          }`}
                        >
                          {inv.paymentStatus}
                        </span>
                        {isReturned && (
                          <span className="block text-[9px] text-amber-400 font-semibold mt-0.5">
                            Returned
                          </span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-stone-300">
                        <span className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800">
                          {inv.paymentMethod}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print / View Receipt */}
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(inv)}
                            title="Print / View Receipt"
                            className="p-1.5 rounded-lg bg-stone-950 hover:bg-stone-800 text-stone-300 hover:text-amber-400 border border-stone-800 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Sales Return */}
                          <button
                            type="button"
                            onClick={() => navigate('/returns')}
                            title="Issue Return / Credit Note"
                            className="p-1.5 rounded-lg bg-stone-950 hover:bg-stone-800 text-stone-300 hover:text-emerald-400 border border-stone-800 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Invoice */}
                          <button
                            type="button"
                            onClick={() => setInvoiceToDelete(inv)}
                            title="Permanently Delete Invoice"
                            className="p-1.5 rounded-lg bg-stone-950 hover:bg-rose-950/80 text-stone-400 hover:text-rose-400 border border-stone-800 hover:border-rose-850 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt View & Print Modal */}
      {selectedInvoice && (
        <ReceiptModal
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          invoice={selectedInvoice}
          businessProfile={businessProfile}
        />
      )}

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-950/80 border border-rose-800 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-100 font-serif">
                  Permanently Delete Invoice?
                </h3>
                <p className="text-xs text-rose-400 font-mono font-semibold">
                  {invoiceToDelete.invoiceNumber} • ₹{(invoiceToDelete.grandTotal || 0).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 text-xs text-stone-300 space-y-2">
              <p>
                Customer: <span className="font-semibold text-stone-100">{invoiceToDelete.customerName}</span>
              </p>
              <p className="text-stone-400 text-[11px]">
                Items sold on this bill will be <span className="text-emerald-400 font-semibold">restored back to inventory stock</span>.
              </p>
              <div className="pt-2 border-t border-stone-800 text-amber-400 font-medium text-[11px] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Sequence Rollback: If this is the most recent bill, the next bill created will be number{' '}
                  <span className="font-mono font-bold underline">
                    {invoiceToDelete.invoiceNumber.replace(/[^\d]/g, '')}
                  </span>!
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setInvoiceToDelete(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteInvoice}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-950/40 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

