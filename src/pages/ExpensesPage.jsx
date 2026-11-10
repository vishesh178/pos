import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Calendar,
  Tag,
  DollarSign,
  FileText,
  X,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ExpensesPage() {
  const { token, hasPermission } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  // Add Expense Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Showroom Rent',
    title: '',
    description: '',
    amount: '',
    paymentMethod: 'BANK_TRANSFER',
    expenseDate: new Date().toISOString().split('T')[0],
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const categories = [
    'Showroom Rent',
    'Electricity & Utilities',
    'Staff Salaries & Incentives',
    'Freight & Transportation',
    'Packaging Materials',
    'Advertising & Marketing',
    'Store Maintenance',
    'Miscellaneous',
  ];

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const url =
        selectedCategory !== 'all'
          ? `/api/expenses?category=${encodeURIComponent(selectedCategory)}`
          : '/api/expenses';
      const res = await fetch(url);
      const data = await res.json();
      setExpenses(data);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedCategory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save expense');

      setIsModalOpen(false);
      setFormData({
        category: 'Showroom Rent',
        title: '',
        description: '',
        amount: '',
        paymentMethod: 'BANK_TRANSFER',
        expenseDate: new Date().toISOString().split('T')[0],
      });
      fetchExpenses();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense entry?')) return;
    try {
      await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchExpenses();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-serif text-stone-100 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-amber-500" />
            <span>Showroom Operational Expenses</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Track rent, staff salaries, packaging, freight, and utility costs
          </p>
        </div>

        {hasPermission(['ADMIN', 'MANAGER']) && (
          <button
            onClick={() => {
              setFormError('');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-all shadow-lg shadow-amber-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        )}
      </div>

      {/* KPI Cards & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-stone-900 border border-stone-800 rounded-2xl">
        <div className="flex items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-300 text-xs focus:border-amber-500 focus:outline-none"
          >
            <option value="all">All Expense Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400 uppercase font-semibold">Total Filtered:</span>
          <span className="text-xl font-black font-mono text-rose-400">
            ₹{totalExpense.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* MOBILE EXPENSE CARDS (< 768px, zero horizontal scrolling) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-stone-400 bg-stone-900 border border-stone-800 rounded-2xl">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading expenses...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-stone-400 bg-stone-900 border border-stone-800 rounded-2xl text-xs">
            No expense records found.
          </div>
        ) : (
          expenses.map((e) => (
            <div
              key={e.id}
              className="p-4 bg-stone-900 border border-stone-800 rounded-2xl shadow space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-amber-400 font-semibold uppercase tracking-wider">
                    {e.category}
                  </span>
                  <h4 className="font-serif font-bold text-sm text-stone-100 mt-1">{e.title}</h4>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-base text-rose-400">
                    ₹{e.amount.toFixed(2)}
                  </span>
                  <p className="text-[10px] text-stone-500 uppercase">{e.paymentMethod}</p>
                </div>
              </div>

              {e.description && (
                <p className="text-xs text-stone-400 bg-stone-950 p-2 rounded-xl border border-stone-850">
                  {e.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-stone-800/60 text-[11px] text-stone-500">
                <span className="font-mono">{new Date(e.expenseDate).toLocaleDateString('en-IN')}</span>
                {hasPermission('ADMIN') && (
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-400 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                    title="Delete Expense"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP TABLE VIEW (>= 768px) */}
      <div className="hidden md:block bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
              <tr>
                <th className="px-5 py-3">Expense Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Expense Title & Description</th>
                <th className="px-4 py-3">Payment Mode</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800 text-stone-300">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-stone-400">
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-stone-400">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-stone-800/40">
                    <td className="px-5 py-3 font-mono text-stone-400 text-[11px]">
                      {new Date(e.expenseDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-amber-400 font-semibold">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-stone-100 font-serif">{e.title}</div>
                      {e.description && (
                        <div className="text-[11px] text-stone-400 mt-0.5">{e.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-300">{e.paymentMethod}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-400 text-sm">
                      ₹{e.amount.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {hasPermission('ADMIN') && (
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="p-1 text-stone-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-serif font-bold text-lg text-stone-100">Record Showroom Expense</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="my-3 p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-300 mb-1">Expense Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-300 mb-1">Expense Title / Payee *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. October Showroom Electricity Bill"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="5000"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm font-mono font-bold text-rose-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    <option value="UPI">UPI</option>
                    <option value="CASH">Petty Cash</option>
                    <option value="CARD">Debit / Credit Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-300 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.expenseDate}
                  onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-300 mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Payment reference, transaction number, etc."
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100"
                />
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-300 hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold"
                >
                  {submitting ? 'Recording...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

