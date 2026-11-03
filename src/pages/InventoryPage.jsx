import React, { useState, useEffect } from 'react';
import {
  Boxes,
  TrendingUp,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  PlusCircle,
  FileSpreadsheet,
  X,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function InventoryPage() {
  const { token, hasPermission, user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [overview, setOverview] = useState(null);
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    productId: '',
    type: 'DAMAGE_OUTWARD',
    quantity: 1,
    notes: '',
  });
  const [adjustError, setAdjustError] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/inventory/overview', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setOverview(data);
    } catch (err) {
      console.error('Failed to fetch inventory overview:', err);
    }
  };

  const fetchMovements = async () => {
    try {
      const res = await fetch('/api/inventory/movements?limit=100', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setMovements(data);
    } catch (err) {
      console.error('Failed to fetch stock movements:', err);
    }
  };

  const fetchProductsList = async () => {
    try {
      const res = await fetch('/api/products', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error('Failed to fetch products for adjustment:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchOverview(), fetchMovements(), fetchProductsList()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const handleInv = () => loadData();
    window.addEventListener('inventory-updated', handleInv);
    return () => window.removeEventListener('inventory-updated', handleInv);
  }, []);

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setAdjustError('');
    setAdjustSubmitting(true);

    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(adjustForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Adjustment failed');

      setIsAdjustModalOpen(false);
      setAdjustForm({ productId: '', type: 'DAMAGE_OUTWARD', quantity: 1, notes: '' });
      loadData();
      window.dispatchEvent(new CustomEvent('inventory-updated'));
    } catch (err) {
      setAdjustError(err.message);
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const getMovementBadge = (type) => {
    switch (type) {
      case 'SALE':
        return <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 font-semibold text-[10px]">SALE OUTWARD</span>;
      case 'PURCHASE':
        return <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold text-[10px]">PURCHASE INWARD</span>;
      case 'RETURN_INWARD':
        return <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 font-semibold text-[10px]">CUSTOMER RETURN</span>;
      case 'DAMAGE_OUTWARD':
        return <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 font-semibold text-[10px]">DAMAGED / WRITE-OFF</span>;
      case 'ADJUSTMENT_ADD':
        return <span className="px-2 py-0.5 rounded bg-teal-950 text-teal-400 font-semibold text-[10px]">AUDIT INCREASE</span>;
      case 'ADJUSTMENT_SUBTRACT':
        return <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 font-semibold text-[10px]">AUDIT DECREASE</span>;
      case 'OPENING':
        return <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 font-semibold text-[10px]">OPENING STOCK</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-400 font-semibold text-[10px]">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-serif text-stone-100 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-amber-500" />
            <span>Showroom Inventory & Movement Ledger</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Real-time stock tracking, physical audit count reconciliations, and damages logging
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            title="Refresh Ledger"
            className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-amber-400 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {hasPermission(['ADMIN', 'MANAGER', 'INVENTORY']) && (
            <button
              onClick={() => {
                setAdjustForm({
                  productId: products[0]?.id || '',
                  type: 'DAMAGE_OUTWARD',
                  quantity: 1,
                  notes: '',
                });
                setIsAdjustModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-all shadow-lg shadow-amber-950/40"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Stock Adjustment</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
          <p className="text-[11px] font-semibold uppercase text-stone-400 tracking-wider">Total Stock Quantity</p>
          <p className="text-2xl font-bold text-stone-100 font-mono mt-1">
            {typeof overview?.totalStockUnits === 'number' ? overview.totalStockUnits : '...'} <span className="text-xs text-amber-500 font-normal">Units</span>
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">Across {overview?.totalProducts || 0} unique pieces</p>
        </div>

        {isAdmin ? (
          <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
            <p className="text-[11px] font-semibold uppercase text-stone-400 tracking-wider">Valuation (At Cost)</p>
            <p className="text-2xl font-bold text-stone-100 font-mono mt-1">
              ₹{typeof overview?.totalValuationCost === 'number' ? overview.totalValuationCost.toLocaleString('en-IN') : '...'}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5">Cost of inventory on hand</p>
          </div>
        ) : (
          <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
            <p className="text-[11px] font-semibold uppercase text-stone-400 tracking-wider">Active Catalog</p>
            <p className="text-2xl font-bold text-stone-100 font-mono mt-1">
              {overview?.totalProducts || 0} <span className="text-xs text-amber-500 font-normal">Products</span>
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5">Showroom active items</p>
          </div>
        )}

        <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
          <p className="text-[11px] font-semibold uppercase text-stone-400 tracking-wider">Valuation (At Retail)</p>
          <p className="text-2xl font-bold text-amber-400 font-mono mt-1">
            ₹{typeof overview?.totalValuationRetail === 'number' ? overview.totalValuationRetail.toLocaleString('en-IN') : '...'}
          </p>
          <p className="text-[10px] text-emerald-400 mt-0.5">
            {isAdmin && typeof overview?.potentialProfit === 'number'
              ? `Est. Margin: ₹${overview.potentialProfit.toLocaleString('en-IN')}`
              : 'Showroom retail inventory value'}
          </p>
        </div>

        <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
          <p className="text-[11px] font-semibold uppercase text-stone-400 tracking-wider">Stock Alerts</p>
          <div className="flex items-center gap-3 mt-1">
            <div>
              <span className="text-lg font-bold text-amber-400 font-mono">{overview?.lowStockCount || 0}</span>
              <span className="text-[10px] text-stone-400 ml-1">Low</span>
            </div>
            <div className="h-4 w-px bg-stone-700" />
            <div>
              <span className="text-lg font-bold text-rose-400 font-mono">{overview?.outOfStockCount || 0}</span>
              <span className="text-[10px] text-stone-400 ml-1">Out of Stock</span>
            </div>
          </div>
          <p className="text-[10px] text-stone-400 mt-0.5">Below minimum threshold</p>
        </div>
      </div>

      {/* Movement Ledger Table */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between">
          <h3 className="font-serif font-bold text-sm text-stone-100">Immutable Stock Movement Ledger</h3>
          <span className="text-xs text-stone-400">Showing last {movements.length} transactions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-4 py-3">Product Name & SKU</th>
                <th className="px-4 py-3">Movement Type</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Balance After</th>
                <th className="px-4 py-3">Notes & Reference</th>
                <th className="px-5 py-3 text-right">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800 text-stone-300">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-stone-400">
                    Loading stock ledger...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-stone-400">
                    No movements recorded yet.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-stone-800/40">
                    <td className="px-5 py-3 font-mono text-[11px] text-stone-400">
                      {new Date(m.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-stone-100">{m.product?.name}</div>
                      <div className="font-mono text-[10px] text-amber-500">{m.product?.sku}</div>
                    </td>
                    <td className="px-4 py-3">{getMovementBadge(m.type)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      <span className={m.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-stone-200">
                      {m.balanceAfter}
                    </td>
                    <td className="px-4 py-3 text-stone-400 max-w-xs truncate">
                      {m.notes || m.referenceType || '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-stone-400">
                      {m.createdBy || 'System'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Stock Adjustment Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800">
              <h3 className="font-serif font-bold text-lg text-stone-100">Manual Stock Adjustment</h3>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {adjustError && (
              <div className="my-4 p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-300 mb-1">Select Product *</label>
                <select
                  required
                  value={adjustForm.productId}
                  onChange={(e) => setAdjustForm({ ...adjustForm, productId: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Select a décor product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Stock: {p.currentStock}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-300 mb-1">Adjustment Type *</label>
                <select
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
                >
                  <option value="DAMAGE_OUTWARD">Damage / Breakage Outward (Deduct)</option>
                  <option value="ADJUSTMENT_SUBTRACT">Physical Audit Shortage (Deduct)</option>
                  <option value="ADJUSTMENT_ADD">Physical Audit Surplus (Add)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-300 mb-1">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-300 mb-1">Reason / Notes</label>
                <textarea
                  rows={2}
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  placeholder="e.g. Mirror cracked during transit or physical stock count reconciliation"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-stone-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-300 hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold tracking-wide disabled:opacity-50"
                >
                  {adjustSubmitting ? 'Updating...' : 'Commit Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

