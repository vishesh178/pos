import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  Plus,
  Share2,
  Printer,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  Trash2,
  Eye,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePOS } from '../context/POSContext';
import EstimateModal from '../components/pos/EstimateModal';

export default function EstimatesPage() {
  const { token } = useAuth();
  const { loadEstimateIntoCart } = usePOS();
  const navigate = useNavigate();

  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selected Estimate for Modal
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [actionMessage, setActionMessage] = useState('');

  // Load business profile
  useEffect(() => {
    fetch('/api/business/profile')
      .then((r) => r.json())
      .then((b) => setBusinessProfile(b))
      .catch((e) => console.error(e));
  }, []);

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter !== 'all') q.set('status', statusFilter);
      if (search.trim()) q.set('search', search.trim());

      const res = await fetch(`/api/estimates?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setEstimates(data.estimates || []);
      }
    } catch (err) {
      console.error('Error fetching estimates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstimates();
  }, [statusFilter, search]);

  const handleOpenEstimateModal = (est) => {
    setSelectedEstimate(est);
    setIsModalOpen(true);
  };

  // Convert Estimate directly to Invoice
  const handleConvertToBill = async (est) => {
    try {
      const res = await fetch(`/api/estimates/${est.id}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paymentMethod: 'CASH' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Conversion failed');

      setActionMessage(`Estimate ${est.estimateNumber} successfully converted to Bill ${data.invoice.invoiceNumber}!`);
      setIsModalOpen(false);
      fetchEstimates();
      window.dispatchEvent(new CustomEvent('inventory-updated'));
      setTimeout(() => setActionMessage(''), 5000);
    } catch (err) {
      alert('Conversion failed: ' + err.message);
    }
  };

  // Load into POS cart so user can review/edit/choose payment method
  const handleOpenInPOS = (est) => {
    loadEstimateIntoCart(est);
    navigate('/pos');
  };

  const handleSyncToZoho = async (est) => {
    try {
      const res = await fetch(`/api/estimates/${est.id}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to queue sync');
      setActionMessage(`Estimate ${est.estimateNumber} queued for Zoho Quotes sync!`);
      fetchEstimates();
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err) {
      alert('Sync failed: ' + err.message);
    }
  };

  const handleDeleteEstimate = async (est) => {
    if (!window.confirm(`Are you sure you want to delete estimate ${est.estimateNumber}?`)) return;
    try {
      const res = await fetch(`/api/estimates/${est.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchEstimates();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete estimate');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Quick WhatsApp share from table row
  const handleQuickWhatsApp = (est) => {
    const lines = (est.items || []).map((it, idx) => {
      return `${idx + 1}. *${it.productName}* (${it.sku})\n   ${it.quantity} pc(s) @ ₹${it.unitPrice.toLocaleString('en-IN')} = ₹${it.totalAmount.toLocaleString('en-IN')}`;
    }).join('\n\n');

    const dateStr = new Date(est.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const text =
      `🏛️ *CURATED ART — Luxury Home Décor*\n` +
      `*Quotation / Estimate:* #${est.estimateNumber}\n` +
      `*Date:* ${dateStr}\n` +
      `*Client:* ${est.customerName}\n\n` +
      `📋 *Quoted Pieces:*\n${lines}\n\n` +
      `───────────────\n` +
      `*Grand Total: ₹${est.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*\n` +
      `───────────────\n\n` +
      `💬 *Reply to confirm your order or request modifications.*`;

    const cleanPhone = (est.customerMobile || '').replace(/\D/g, '');
    let url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (cleanPhone.length >= 10) {
      const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
    }
    window.open(url, '_blank');
  };

  // KPI Calculations
  const totalEstimatesCount = estimates.length;
  const pendingQuotes = estimates.filter((e) => e.status === 'PENDING');
  const pendingValue = pendingQuotes.reduce((acc, e) => acc + e.grandTotal, 0);
  const convertedQuotes = estimates.filter((e) => e.status === 'CONVERTED');
  const convertedValue = convertedQuotes.reduce((acc, e) => acc + e.grandTotal, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-500" />
            <span>Estimates & Quotations</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Send formal quotations to interior designers and wholesale buyers before final billing.
          </p>
        </div>

        <button
          onClick={() => navigate('/pos')}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs tracking-wide shadow-lg shadow-amber-950/40 flex items-center gap-2 transition-all cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Estimate (POS Desk)</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-stone-400 text-xs">
            <span>Total Quotations</span>
            <FileText className="w-4 h-4 text-amber-500" />
          </div>
          <p className="font-serif text-2xl font-bold text-stone-100 mt-2">
            {totalEstimatesCount}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">Across all periods</p>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-stone-400 text-xs">
            <span>Active Pending Pipeline</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="font-mono text-2xl font-bold text-amber-400 mt-2">
            ₹{pendingValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">{pendingQuotes.length} pending client approvals</p>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-stone-400 text-xs">
            <span>Converted to Sales</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="font-mono text-2xl font-bold text-emerald-400 mt-2">
            ₹{convertedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">{convertedQuotes.length} converted to final invoices</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-900/60 p-3 rounded-2xl border border-stone-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quote #, customer, mobile..."
            className="w-full pl-9 pr-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['all', 'PENDING', 'CONVERTED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/40'
                  : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              {st === 'all' ? 'All Estimates' : st.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Estimates Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950/80 text-[10px] uppercase tracking-wider text-stone-400 border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">Estimate #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-3 text-center">Items</th>
                <th className="py-3 px-4 text-right">Taxable</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Zoho Quote</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-stone-500">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading quotations...</span>
                  </td>
                </tr>
              ) : estimates.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-stone-500">
                    <FileText className="w-8 h-8 text-stone-600 mx-auto mb-2" />
                    <p className="font-semibold text-stone-300">No estimates found</p>
                    <p className="text-xs text-stone-500 mt-1">
                      Go to POS Desk and click "Save as Estimate" to create one.
                    </p>
                  </td>
                </tr>
              ) : (
                estimates.map((est) => (
                  <tr key={est.id} className="hover:bg-stone-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      {est.estimateNumber}
                    </td>
                    <td className="py-3 px-4 text-stone-400 whitespace-nowrap">
                      {new Date(est.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-stone-100">{est.customerName}</p>
                      {est.customerMobile && (
                        <p className="text-[11px] text-stone-500 font-mono">{est.customerMobile}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-300 text-[11px]">
                        {est.items?.length || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-stone-400">
                      ₹{est.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-stone-100">
                      ₹{est.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          est.status === 'CONVERTED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : est.status === 'CANCELLED'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {est.status}
                      </span>
                      {est.convertedInvoiceId && (
                        <p className="text-[9px] text-emerald-500 font-mono mt-0.5">
                          {est.convertedInvoiceId}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {est.zohoEstimateId ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/70 text-emerald-400 border border-emerald-800/80"
                          title={`Zoho Quote ID: ${est.zohoEstimateId}`}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Synced
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSyncToZoho(est)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-800 hover:bg-amber-950/60 text-stone-300 hover:text-amber-400 border border-stone-700 cursor-pointer transition-colors"
                          title="Push quote to Zoho Books"
                        >
                          <Clock className="w-2.5 h-2.5" />
                          Sync Quote
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEstimateModal(est)}
                          className="p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:text-amber-400 hover:bg-stone-700 transition-colors cursor-pointer"
                          title="View & Print Quotation"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleQuickWhatsApp(est)}
                          className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900 transition-colors cursor-pointer"
                          title="Send on WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        {est.status !== 'CONVERTED' && (
                          <button
                            onClick={() => handleOpenInPOS(est)}
                            className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-stone-950 font-semibold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                            title="Load items into POS Desk to bill"
                          >
                            <ShoppingBag className="w-3 h-3" />
                            <span>Bill in POS</span>
                          </button>
                        )}
                        {est.status !== 'CONVERTED' && (
                          <button
                            onClick={() => handleDeleteEstimate(est)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-stone-800 transition-colors cursor-pointer"
                            title="Delete Estimate"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Estimate Modal */}
      {isModalOpen && selectedEstimate && (
        <EstimateModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          estimate={selectedEstimate}
          businessProfile={businessProfile}
          onConvertToBill={handleConvertToBill}
        />
      )}
    </div>
  );
}

