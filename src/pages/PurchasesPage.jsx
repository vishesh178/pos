import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  FileText,
  Boxes,
  Users,
  Search,
  CheckCircle,
  X,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PurchasesPage() {
  const { token, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('bills'); // 'bills', 'orders', 'suppliers'

  const [bills, setBills] = useState([]);
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);

  // Supplier Form
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    mobile: '',
    email: '',
    gstin: '',
    address: '',
    state: 'Gujarat',
    stateCode: '24',
  });

  // Bill Form
  const [billForm, setBillForm] = useState({
    supplierId: '',
    supplierBillNumber: '',
    purchaseOrderId: '',
    paidAmount: 0,
    notes: '',
    items: [{ productId: '', quantity: 1, unitCost: 1000, taxRate: 18 }],
  });

  // PO Form
  const [poForm, setPoForm] = useState({
    supplierId: '',
    expectedDate: '',
    notes: '',
    items: [{ productId: '', quantity: 5, unitCost: 1000, taxRate: 18 }],
  });

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [resBills, resOrders, resSuppliers, resProducts] = await Promise.all([
        fetch('/api/purchases/bills'),
        fetch('/api/purchases/orders'),
        fetch('/api/purchases/suppliers'),
        fetch('/api/products'),
      ]);

      const [dataBills, dataOrders, dataSuppliers, dataProducts] = await Promise.all([
        resBills.json(),
        resOrders.json(),
        resSuppliers.json(),
        resProducts.json(),
      ]);

      setBills(dataBills);
      setOrders(dataOrders);
      setSuppliers(dataSuppliers);
      setProducts(dataProducts);
    } catch (err) {
      console.error('Failed to load purchases data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/purchases/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(supplierForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create supplier');

      setIsSupplierModalOpen(false);
      setSupplierForm({
        name: '',
        contactPerson: '',
        mobile: '',
        email: '',
        gstin: '',
        address: '',
        state: 'Gujarat',
        stateCode: '24',
      });
      loadAll();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateBill = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/purchases/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(billForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record purchase bill');

      setIsBillModalOpen(false);
      setBillForm({
        supplierId: '',
        supplierBillNumber: '',
        purchaseOrderId: '',
        paidAmount: 0,
        notes: '',
        items: [{ productId: products[0]?.id || '', quantity: 1, unitCost: 1000, taxRate: 18 }],
      });
      loadAll();
      window.dispatchEvent(new CustomEvent('inventory-updated'));
      alert(`Inward Stock Recorded: Bill ${data.billNumber}`);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePo = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/purchases/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(poForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create PO');

      setIsPoModalOpen(false);
      loadAll();
      alert(`Purchase Order ${data.poNumber} Created`);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-serif text-stone-100 flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-500" />
            <span>Supplier Inward & Purchase Management</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Purchase Orders, Supplier Invoices with automatic stock inward, and vendor ledgers
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission(['ADMIN', 'MANAGER', 'INVENTORY']) && (
            <>
              <button
                onClick={() => {
                  setFormError('');
                  setIsSupplierModalOpen(true);
                }}
                className="px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-stone-100 text-xs font-semibold"
              >
                + Add Supplier
              </button>
              <button
                onClick={() => {
                  setPoForm({
                    supplierId: suppliers[0]?.id || '',
                    expectedDate: '',
                    notes: '',
                    items: [{ productId: products[0]?.id || '', quantity: 5, unitCost: 1000, taxRate: 18 }],
                  });
                  setFormError('');
                  setIsPoModalOpen(true);
                }}
                className="px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-stone-100 text-xs font-semibold"
              >
                + Create PO
              </button>
              <button
                onClick={() => {
                  setBillForm({
                    supplierId: suppliers[0]?.id || '',
                    supplierBillNumber: '',
                    purchaseOrderId: '',
                    paidAmount: 0,
                    notes: '',
                    items: [{ productId: products[0]?.id || '', quantity: 2, unitCost: 1000, taxRate: 18 }],
                  });
                  setFormError('');
                  setIsBillModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-lg shadow-amber-950/40"
              >
                + Record Inward Bill (Add Stock)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-800 pb-2">
        <button
          onClick={() => setActiveTab('bills')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'bills'
              ? 'bg-amber-500 text-stone-950'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          Inward Purchase Bills ({bills.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'orders'
              ? 'bg-amber-500 text-stone-950'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          Purchase Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'suppliers'
              ? 'bg-amber-500 text-stone-950'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          Suppliers Directory ({suppliers.length})
        </button>
      </div>

      {/* TAB 1: INWARD BILLS */}
      {activeTab === 'bills' && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                <tr>
                  <th className="px-5 py-3">Bill Number</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Bill Date</th>
                  <th className="px-4 py-3">Supplier Ref #</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-center">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800 text-stone-300">
                {bills.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-10 text-stone-400">
                      No purchase bills recorded yet. Click "Record Inward Bill" to receive vendor stock.
                    </td>
                  </tr>
                ) : (
                  bills.map((b) => (
                    <tr key={b.id} className="hover:bg-stone-800/40">
                      <td className="px-5 py-3 font-mono font-bold text-stone-100">{b.billNumber}</td>
                      <td className="px-4 py-3 font-semibold text-stone-200">{b.supplier?.name}</td>
                      <td className="px-4 py-3 text-stone-400 font-mono text-[11px]">
                        {new Date(b.billDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-mono text-stone-400">{b.supplierBillNumber || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">
                        ₹{b.grandTotal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-stone-300">
                        ₹{b.paidAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            b.paymentStatus === 'PAID'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {b.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PURCHASE ORDERS */}
      {activeTab === 'orders' && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                <tr>
                  <th className="px-5 py-3">PO Number</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Order Date</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3 text-right">Total (₹)</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800 text-stone-300">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-10 text-stone-400">
                      No purchase orders issued yet.
                    </td>
                  </tr>
                ) : (
                  orders.map((po) => (
                    <tr key={po.id} className="hover:bg-stone-800/40">
                      <td className="px-5 py-3 font-mono font-bold text-amber-500">{po.poNumber}</td>
                      <td className="px-4 py-3 font-semibold text-stone-100">{po.supplier?.name}</td>
                      <td className="px-4 py-3 text-stone-400 font-mono text-[11px]">
                        {new Date(po.orderDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-stone-300">{po.items?.length || 0} line items</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-stone-100">
                        ₹{po.grandTotal.toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            po.status === 'RECEIVED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SUPPLIERS */}
      {activeTab === 'suppliers' && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                <tr>
                  <th className="px-5 py-3">Supplier Name</th>
                  <th className="px-4 py-3">Contact Person & Mobile</th>
                  <th className="px-4 py-3">GSTIN</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3 text-center">Bills Inward</th>
                  <th className="px-5 py-3 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800 text-stone-300">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-10 text-stone-400">
                      No suppliers added yet.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-stone-800/40">
                      <td className="px-5 py-3 font-semibold text-stone-100 font-serif">{s.name}</td>
                      <td className="px-4 py-3 text-stone-300">
                        <div>{s.contactPerson || '—'}</div>
                        <div className="font-mono text-[11px] text-stone-400">{s.mobile}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-stone-400">{s.gstin || '—'}</td>
                      <td className="px-4 py-3 text-stone-300">{s.state} ({s.stateCode})</td>
                      <td className="px-4 py-3 text-center font-bold font-mono">{s._count?.purchaseBills || 0}</td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-rose-400">
                        ₹{s.currentBalance.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: RECORD INWARD PURCHASE BILL */}
      {isBillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-serif font-bold text-lg text-stone-100">
                Record Inward Supplier Bill & Add Stock
              </h3>
              <button
                onClick={() => setIsBillModalOpen(false)}
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

            <form onSubmit={handleCreateBill} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">Supplier *</label>
                  <select
                    required
                    value={billForm.supplierId}
                    onChange={(e) => setBillForm({ ...billForm, supplierId: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">Supplier Invoice #</label>
                  <input
                    type="text"
                    value={billForm.supplierBillNumber}
                    onChange={(e) => setBillForm({ ...billForm, supplierBillNumber: e.target.value })}
                    placeholder="e.g. INV-2026-99"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div>
                <label className="block font-semibold text-stone-300 mb-1">Received Products & Costs</label>
                <div className="space-y-2">
                  {billForm.items.map((it, idx) => (
                    <div key={idx} className="p-3 bg-stone-950 border border-stone-800 rounded-xl grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <select
                          required
                          value={it.productId}
                          onChange={(e) => {
                            const next = [...billForm.items];
                            next[idx].productId = e.target.value;
                            setBillForm({ ...billForm, items: next });
                          }}
                          className="w-full px-2 py-1.5 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 text-xs"
                        >
                          <option value="">Select Product to Inward</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => {
                            const next = [...billForm.items];
                            next[idx].quantity = parseInt(e.target.value, 10) || 1;
                            setBillForm({ ...billForm, items: next });
                          }}
                          placeholder="Qty"
                          className="w-full px-2 py-1.5 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 text-xs text-center font-bold"
                        />
                      </div>

                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          value={it.unitCost}
                          onChange={(e) => {
                            const next = [...billForm.items];
                            next[idx].unitCost = parseFloat(e.target.value) || 0;
                            setBillForm({ ...billForm, items: next });
                          }}
                          placeholder="Cost Price"
                          className="w-full px-2 py-1.5 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 text-xs font-mono text-right"
                        />
                      </div>

                      <div className="col-span-2 text-right">
                        <span className="font-mono font-bold text-amber-400">
                          ₹{(it.quantity * it.unitCost * 1.18).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBillModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-300 hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold"
                >
                  {submitting ? 'Recording Inward...' : 'Confirm Inward Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-serif font-bold text-base text-stone-100">Add Art & Frame Supplier</h3>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-300 mb-1">Company / Studio Name *</label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="e.g. Royal Brass Handicrafts Moradabad"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    placeholder="Owner name"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">Mobile Phone *</label>
                  <input
                    type="text"
                    required
                    value={supplierForm.mobile}
                    onChange={(e) => setSupplierForm({ ...supplierForm, mobile: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-300 mb-1">GSTIN</label>
                <input
                  type="text"
                  value={supplierForm.gstin}
                  onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value.toUpperCase() })}
                  placeholder="24AAAAA0000A1Z5"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm"
                />
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-300 hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold"
                >
                  {submitting ? 'Saving...' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

