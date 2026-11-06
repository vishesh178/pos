import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  FileText,
  X,
  CreditCard,
  AlertCircle,
  Wallet,
  CheckCircle2,
  Share2,
  Check,
  MessageCircle,
  Upload,
  Download,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CustomerLedgerModal from '../components/customers/CustomerLedgerModal';
import CustomerImportModal from '../components/customers/CustomerImportModal';
import { downloadExportFile } from '../utils/exportDownloader';

export default function CustomersPage() {
  const { token, hasPermission } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [pricebooks, setPricebooks] = useState([]);
  const [search, setSearch] = useState('');
  const [customerType, setCustomerType] = useState('all');
  const [filterOnlyDue, setFilterOnlyDue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    billingAddress: '',
    shippingAddress: '',
    pincode: '',
    gstin: '',
    gstDate: '',
    panNo: '',
    msmeNo: '',
    state: 'Gujarat',
    stateCode: '24',
    customerType: 'RETAIL',
    pricebookId: '',
    openingBalance: 0,
  });
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Credit Ledger Statement Modal State
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [selectedLedgerCustomerId, setSelectedLedgerCustomerId] = useState(null);

  // Quick Collect Payment Modal State (for Mobile & Desktop)
  const [isQuickPayOpen, setIsQuickPayOpen] = useState(false);
  const [quickPayCustomer, setQuickPayCustomer] = useState(null);
  const [quickPayAmount, setQuickPayAmount] = useState('');
  const [quickPayMethod, setQuickPayMethod] = useState('UPI');
  const [quickPayRef, setQuickPayRef] = useState('');
  const [quickPayNotes, setQuickPayNotes] = useState('');
  const [quickPaySubmitting, setQuickPaySubmitting] = useState(false);
  const [quickPaySuccess, setQuickPaySuccess] = useState(null);

  useEffect(() => {
    fetch('/api/pricebooks')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setPricebooks(d))
      .catch((e) => console.error('Failed to load pricebooks:', e));
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (customerType !== 'all') params.append('customerType', customerType);

      const res = await fetch(`/api/customers?${params.toString()}`);
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(fetchCustomers, 200);
    return () => clearTimeout(delay);
  }, [search, customerType]);

  // Calculations for quick metrics
  const totalOutstandingDue = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.currentBalance > 0 ? c.currentBalance : 0), 0);
  }, [customers]);

  const dueCustomersCount = useMemo(() => {
    return customers.filter((c) => c.currentBalance > 0).length;
  }, [customers]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filteredCustomers = useMemo(() => {
    if (!filterOnlyDue) return customers;
    return customers.filter((c) => c.currentBalance > 0);
  }, [customers, filterOnlyDue]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, customerType, filterOnlyDue]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / (pageSize === 'all' ? filteredCustomers.length || 1 : pageSize)));

  const paginatedCustomers = useMemo(() => {
    if (pageSize === 'all') return filteredCustomers;
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      mobile: '',
      email: '',
      billingAddress: '',
      shippingAddress: '',
      pincode: '',
      gstin: '',
      gstDate: '',
      panNo: '',
      msmeNo: '',
      state: 'Gujarat',
      stateCode: '24',
      customerType: 'RETAIL',
      pricebookId: pricebooks.find((p) => p.isDefault)?.id || '',
      openingBalance: 0,
    });
    setModalError('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (c) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name || '',
      mobile: c.mobile || '',
      email: c.email || '',
      billingAddress: c.billingAddress || '',
      shippingAddress: c.shippingAddress || '',
      pincode: c.pincode || '',
      gstin: c.gstin || '',
      gstDate: c.gstDate || '',
      panNo: c.panNo || '',
      msmeNo: c.msmeNo || '',
      state: c.state || 'Gujarat',
      stateCode: c.stateCode || '24',
      customerType: c.customerType || 'RETAIL',
      pricebookId: c.pricebookId || '',
      openingBalance: c.openingBalance || 0,
    });
    setModalError('');
    setIsModalOpen(true);
  };

  // Open Ledger Modal
  const handleOpenLedger = (c) => {
    setSelectedLedgerCustomerId(c.id);
    setIsLedgerOpen(true);
  };

  // Open Quick Collect Due Payment Modal
  const handleOpenQuickPay = (c) => {
    setQuickPayCustomer(c);
    setQuickPayAmount(c.currentBalance > 0 ? c.currentBalance.toString() : '');
    setQuickPayMethod('UPI');
    setQuickPayRef('');
    setQuickPayNotes('Customer Khata Settlement');
    setQuickPaySuccess(null);
    setIsQuickPayOpen(true);
  };

  // Submit Add/Edit Customer
  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setSubmitting(true);

    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        name: formData.name.trim(),
        mobile: formData.mobile?.trim() || '-',
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save customer');

      setIsModalOpen(false);
      fetchCustomers();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Quick Collect Payment
  const handleQuickPaySubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(quickPayAmount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid payment amount greater than zero.');
      return;
    }

    setQuickPaySubmitting(true);
    try {
      const res = await fetch(`/api/customers/${quickPayCustomer.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amt,
          paymentMethod: quickPayMethod,
          referenceNumber: quickPayRef ? quickPayRef.trim() : null,
          notes: quickPayNotes ? quickPayNotes.trim() : 'Payment settlement',
          autoApplyToInvoices: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');

      const remainingBal = Math.max(0, (quickPayCustomer.currentBalance || 0) - amt);
      setQuickPaySuccess({
        amount: amt,
        customerName: quickPayCustomer.name,
        mobile: quickPayCustomer.mobile,
        remainingBalance: remainingBal,
        paymentMethod: quickPayMethod,
        referenceNumber: quickPayRef,
      });

      fetchCustomers();
    } catch (err) {
      alert('Error recording payment: ' + err.message);
    } finally {
      setQuickPaySubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold font-serif text-stone-100 flex items-center gap-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 shrink-0" />
            <span>Customer Directory & Khata</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-stone-400 mt-0.5">
            Client accounts, designer pricing tiers, outstanding credit balances & mobile payment collection
          </p>
        </div>

        {hasPermission(['ADMIN', 'MANAGER', 'BILLING']) && (
          <div className="self-start sm:self-auto flex items-center gap-2">
            <button
              onClick={async () => {
                setIsExporting(true);
                await downloadExportFile(
                  '/api/export/customers?format=xlsx',
                  'CURATED_ART-Account_List.xlsx',
                  token
                );
                setIsExporting(false);
              }}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-500/50 text-stone-200 hover:text-amber-400 text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Export categorized account list to Excel (.xlsx)"
            >
              <Download className={`w-3.5 h-3.5 text-amber-500 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
            </button>
            <button
              onClick={async () => {
                setIsExporting(true);
                await downloadExportFile(
                  '/api/export/customers?format=csv',
                  'CURATED_ART-Account_List.csv',
                  token
                );
                setIsExporting(false);
              }}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-500/50 text-stone-400 hover:text-stone-200 text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Export categorized account list to CSV (.csv)"
            >
              <span>CSV</span>
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-500/50 text-stone-200 hover:text-amber-400 text-xs font-semibold transition-all shadow-sm cursor-pointer"
              title="Import Customers from Excel (.xlsx)"
            >
              <Upload className="w-3.5 h-3.5 text-amber-500" />
              <span>Import</span>
            </button>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-all shadow-md shadow-amber-950/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
          </div>
        )}
      </div>

      {/* Quick Receivables KPI Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="p-3 sm:p-4 bg-stone-900/90 border border-stone-800 rounded-xl sm:rounded-2xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Total Directory</p>
          <p className="text-xl sm:text-2xl font-bold text-stone-100 font-mono mt-0.5">
            {customers.length} <span className="text-xs text-amber-500 font-normal">Clients</span>
          </p>
          <p className="text-[10px] text-stone-500 mt-0.5">Active retail & designers</p>
        </div>

        <div className="p-3 sm:p-4 bg-rose-950/20 border border-rose-900/50 rounded-xl sm:rounded-2xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Total Receivables Due</p>
          <p className="text-xl sm:text-2xl font-black text-rose-400 font-mono mt-0.5">
            ₹{totalOutstandingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-rose-300/80 mt-0.5">
            {dueCustomersCount} client{dueCustomersCount === 1 ? '' : 's'} with pending balance
          </p>
        </div>

        <div className="hidden sm:block p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Settlement Status</p>
          <p className="text-2xl font-bold text-emerald-400 font-mono mt-0.5">
            {customers.length - dueCustomersCount} / {customers.length}
          </p>
          <p className="text-[10px] text-stone-500 mt-0.5">Accounts fully cleared</p>
        </div>
      </div>

      {/* Search & Quick Filters */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email, or GSTIN..."
              className="w-full pl-10 pr-8 py-2 bg-stone-900/90 border border-stone-800 rounded-xl text-stone-100 text-xs focus:outline-none focus:border-amber-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-stone-500 hover:text-stone-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value)}
            className="px-3 py-2 bg-stone-900/90 border border-stone-800 rounded-xl text-stone-300 text-xs focus:border-amber-500 focus:outline-none cursor-pointer"
          >
            <option value="all">All Customer Types</option>
            <option value="RETAIL">Retail Customers</option>
            <option value="WHOLESALE">Wholesale & Trade Partners</option>
            <option value="INTERIOR_DESIGNER">Interior Designers & Architects</option>
            <option value="CORPORATE">Corporate & Hospitality</option>
          </select>
        </div>

        {/* Khata / Due Quick Toggle Segment */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-900/90 border border-stone-800 rounded-xl">
          <button
            type="button"
            onClick={() => setFilterOnlyDue(false)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              !filterOnlyDue
                ? 'bg-amber-500 text-stone-950 font-bold shadow'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            All Clients ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterOnlyDue(true)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              filterOnlyDue
                ? 'bg-rose-500 text-white font-bold shadow'
                : 'text-rose-400 hover:text-rose-300'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Pending Dues Only ({dueCustomersCount})</span>
          </button>
        </div>
      </div>

      {/* MOBILE-FIRST VIEW: Touch-Friendly Customer Cards (< 768px) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-stone-400 bg-stone-900 border border-stone-800 rounded-2xl">
            <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading customer directory...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-stone-400 bg-stone-900 border border-stone-800 rounded-2xl text-xs">
            {filterOnlyDue
              ? 'No customers currently have pending due balances!'
              : `No customers found matching "${search}".`}
          </div>
        ) : (
          filteredCustomers.map((c) => {
            const hasDue = c.currentBalance > 0;
            return (
              <div
                key={c.id}
                className={`p-4 bg-stone-900 border rounded-2xl shadow-lg transition-all ${
                  hasDue ? 'border-amber-500/50 bg-stone-900/95' : 'border-stone-800'
                }`}
              >
                {/* Card Top: Name & Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-serif font-bold text-base text-stone-100 leading-snug">
                      {c.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          c.customerType === 'WHOLESALE'
                            ? 'bg-purple-950 text-purple-400 border border-purple-800'
                            : c.customerType === 'INTERIOR_DESIGNER'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : c.customerType === 'CORPORATE'
                            ? 'bg-blue-950 text-blue-400 border border-blue-800'
                            : 'bg-stone-800 text-stone-300'
                        }`}
                      >
                        {c.customerType.replace('_', ' ')}
                      </span>
                      {c.pricebook && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold font-mono">
                          {c.pricebook.name.split('(')[0]} ({c.pricebook.discountPercentage > 0 ? `-${c.pricebook.discountPercentage}%` : 'MRP'})
                        </span>
                      )}
                      {c.gstin && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-950 text-stone-300 font-mono border border-stone-800">
                          GST: {c.gstin}
                        </span>
                      )}
                      {c.panNo && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 font-mono border border-amber-800/60">
                          PAN: {c.panNo}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-stone-950 border border-stone-800 text-stone-400 shrink-0">
                    {c._count?.invoices || 0} Bills
                  </span>
                </div>

                {/* Contact Details & Quick Call/WhatsApp */}
                <div className="mt-3 pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-mono text-stone-300">
                    <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>{c.mobile || 'No phone'}</span>
                  </div>
                  {c.mobile && (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${c.mobile}`}
                        className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-semibold flex items-center gap-1"
                      >
                        <span>Call</span>
                      </a>
                      <a
                        href={`https://wa.me/91${c.mobile.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-[11px] font-semibold flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>Chat</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Balance Due Section */}
                <div
                  className={`mt-3 p-3 rounded-xl flex items-center justify-between border ${
                    hasDue
                      ? 'bg-rose-950/30 border-rose-800/70 text-rose-300'
                      : 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                  }`}
                >
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400">
                      {hasDue ? 'Pending Due Balance (Udhar)' : 'Current Balance'}
                    </p>
                    <p className={`text-xl font-black font-mono mt-0.5 ${hasDue ? 'text-rose-400' : 'text-emerald-400'}`}>
                      ₹{c.currentBalance.toFixed(2)}
                    </p>
                  </div>
                  {hasDue ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
                      Khata Due
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Cleared
                    </span>
                  )}
                </div>

                {/* Action Buttons Row */}
                <div className="mt-3 pt-2.5 border-t border-stone-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenQuickPay(c)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer ${
                      hasDue
                        ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-950/50'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{hasDue ? 'Collect Due Payment' : '+ Add Payment'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenLedger(c)}
                    className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400 font-semibold text-xs flex items-center gap-1 border border-stone-700 cursor-pointer"
                    title="View Statement & History"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Ledger</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(c)}
                    className="py-2 px-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 text-xs font-semibold cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP VIEW: Full Multi-Column Table (>= 768px) */}
      <div className="hidden md:block bg-stone-900/90 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-950/90 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400 tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Customer & Address</th>
                <th className="px-4 py-3.5">Contact Details</th>
                <th className="px-4 py-3.5">Tax & Tier</th>
                <th className="px-4 py-3.5">State (Code)</th>
                <th className="px-3 py-3.5 text-center">Invoices</th>
                <th className="px-4 py-3.5 text-right">Balance Due</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/70 text-stone-300">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-stone-400">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-xs">Loading customer directory...</span>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-stone-400">
                    No customers found matching filter.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-800/40 transition-colors">
                    {/* Customer Name & Address */}
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleOpenLedger(c)}
                        className="text-left font-bold text-stone-100 hover:text-amber-400 font-serif text-sm tracking-wide transition-colors cursor-pointer group block"
                      >
                        <span className="group-hover:underline">{c.name}</span>
                      </button>
                      {c.billingAddress ? (
                        <p className="text-[11px] text-stone-400 truncate max-w-sm flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-stone-500 shrink-0" />
                          <span title={c.billingAddress}>{c.billingAddress}</span>
                        </p>
                      ) : (
                        <span className="text-[10px] text-stone-600 italic">No address on file</span>
                      )}
                    </td>

                    {/* Contact Details */}
                    <td className="px-4 py-3">
                      {c.mobile && c.mobile !== '-' ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <Phone className="w-3 h-3 text-stone-500 shrink-0" />
                            <a
                              href={`tel:${c.mobile}`}
                              className="text-stone-200 hover:text-amber-400 font-medium transition-colors"
                            >
                              {c.mobile}
                            </a>
                            <a
                              href={`https://wa.me/91${c.mobile.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Chat on WhatsApp"
                              className="text-stone-500 hover:text-emerald-400 transition-colors ml-0.5"
                            >
                              <MessageCircle className="w-3 h-3" />
                            </a>
                          </div>
                          {c.email && (
                            <div className="flex items-center gap-1 text-[11px] text-stone-400">
                              <Mail className="w-3 h-3 text-stone-500 shrink-0" />
                              <span className="truncate max-w-[140px]">{c.email}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-600 font-mono text-xs pl-1">—</span>
                      )}
                    </td>

                    {/* Tax & Tier */}
                    <td className="px-4 py-3">
                      {c.gstin ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-purple-950/80 border border-purple-800/80 text-purple-300">
                              GST: {c.gstin}
                            </span>
                            {c.panNo && (
                              <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-stone-950 border border-stone-800 text-amber-400 font-medium">
                                PAN: {c.panNo}
                              </span>
                            )}
                          </div>
                          {c.msmeNo && (
                            <p className="font-mono text-[9px] text-stone-500">MSME: {c.msmeNo}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-stone-950 border border-stone-800 text-stone-400">
                            {c.customerType === 'WHOLESALE'
                              ? 'Wholesale'
                              : c.customerType === 'INTERIOR_DESIGNER'
                              ? 'Designer'
                              : c.customerType === 'CORPORATE'
                              ? 'Corporate'
                              : 'Retail'}
                          </span>
                          {c.panNo && (
                            <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-stone-950 border border-stone-800 text-amber-400 font-medium">
                              PAN: {c.panNo}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* State & Code */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-stone-200 text-xs font-medium">{c.state || 'Gujarat'}</span>
                        <span className="px-1.5 py-0.5 rounded bg-stone-950 border border-stone-800 text-stone-400 font-mono text-[10px] font-bold">
                          {c.stateCode || '24'}
                        </span>
                      </div>
                    </td>

                    {/* Invoices Count */}
                    <td className="px-3 py-3 text-center font-mono text-xs font-semibold text-stone-400">
                      {c._count?.invoices || 0}
                    </td>

                    {/* Balance Due */}
                    <td className="px-4 py-3 text-right">
                      {c.currentBalance > 0 ? (
                        <button
                          onClick={() => handleOpenLedger(c)}
                          className="font-mono font-bold text-xs text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                          title="Click to view balance ledger"
                        >
                          ₹{c.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </button>
                      ) : (
                        <span className="font-mono text-xs text-stone-500">₹0.00</span>
                      )}
                    </td>

                    {/* Actions Button Group */}
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenQuickPay(c)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            c.currentBalance > 0
                              ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-sm'
                              : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                          }`}
                          title="Record payment or settle due balance"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>{c.currentBalance > 0 ? 'Collect ₹' : 'Payment'}</span>
                        </button>
                        <button
                          onClick={() => handleOpenLedger(c)}
                          className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-amber-400 border border-stone-700/60 transition-colors cursor-pointer"
                          title="View Credit Ledger & Statement"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 text-xs font-semibold border border-stone-700/60 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3 border-t border-stone-800 bg-stone-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-400">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Showing <strong className="text-stone-200">{filteredCustomers.length === 0 ? 0 : (currentPage - 1) * (pageSize === 'all' ? filteredCustomers.length : pageSize) + 1}</strong> – <strong className="text-stone-200">{pageSize === 'all' ? filteredCustomers.length : Math.min(currentPage * pageSize, filteredCustomers.length)}</strong> of <strong className="text-stone-200">{filteredCustomers.length}</strong> accounts
            </span>
            <span className="text-stone-600">|</span>
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="px-2 py-0.5 bg-stone-900 border border-stone-800 rounded text-stone-200 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>

          {pageSize !== 'all' && totalPages > 1 && (
            <div className="flex items-center gap-1 self-end sm:self-auto">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 hover:text-stone-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-mono text-stone-300 font-semibold text-xs">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 hover:text-stone-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* QUICK COLLECT DUE PAYMENT MODAL / SHEET (Mobile & Desktop) */}
      {isQuickPayOpen && quickPayCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md shadow-2xl p-5 sm:p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-100">
                    Collect Due Payment
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    {quickPayCustomer.name} • {quickPayCustomer.mobile || 'No phone'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickPayOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {quickPaySuccess ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 space-y-2 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-900/80 border border-emerald-700 text-emerald-300 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-serif font-bold text-sm text-stone-100">Payment Recorded Successfully!</h4>
                  <p className="text-2xl font-black font-mono text-emerald-400">
                    ₹{quickPaySuccess.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-stone-400">
                    Remaining Balance Due:{' '}
                    <span className="font-bold font-mono text-stone-100">
                      ₹{quickPaySuccess.remainingBalance.toFixed(2)}
                    </span>
                  </p>
                </div>

                {quickPaySuccess.mobile && (
                  <button
                    type="button"
                    onClick={() => {
                      const text =
                        `🏛️ *CURATED ART — Luxury Home Décor*\n` +
                        `🧾 *Payment Receipt Confirmation*\n\n` +
                        `*Client:* ${quickPaySuccess.customerName}\n` +
                        `*Amount Received:* ₹${quickPaySuccess.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
                        `*Payment Mode:* ${quickPaySuccess.paymentMethod}\n` +
                        (quickPaySuccess.referenceNumber ? `*Ref / UTR:* ${quickPaySuccess.referenceNumber}\n` : '') +
                        `*Remaining Balance Due:* ₹${quickPaySuccess.remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
                        `*Date:* ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\n\n` +
                        `Thank you for your payment!`;
                      const clean = quickPaySuccess.mobile.replace(/\D/g, '');
                      const phone = clean.length === 10 ? `91${clean}` : clean;
                      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Send WhatsApp Receipt to Client</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsQuickPayOpen(false)}
                  className="w-full py-2 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleQuickPaySubmit} className="space-y-4 text-xs">
                {/* Outstanding Balance Banner */}
                <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl flex items-center justify-between">
                  <span className="text-stone-400 text-xs">Current Outstanding:</span>
                  <span
                    className={`text-base font-bold font-mono ${
                      quickPayCustomer.currentBalance > 0 ? 'text-rose-400' : 'text-stone-300'
                    }`}
                  >
                    ₹{quickPayCustomer.currentBalance.toFixed(2)}
                  </span>
                </div>

                {/* Quick Amount Fill Chips */}
                {quickPayCustomer.currentBalance > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-400 mb-1.5">
                      Quick Amount Select
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQuickPayAmount(quickPayCustomer.currentBalance.toString())}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-400 font-mono text-[11px] font-bold cursor-pointer"
                      >
                        Full (₹{quickPayCustomer.currentBalance.toFixed(2)})
                      </button>
                      {quickPayCustomer.currentBalance > 1000 && (
                        <button
                          type="button"
                          onClick={() => setQuickPayAmount('1000')}
                          className="px-2.5 py-1 rounded-lg bg-stone-800 text-stone-300 font-mono text-[11px] cursor-pointer"
                        >
                          ₹1,000
                        </button>
                      )}
                      {quickPayCustomer.currentBalance > 2000 && (
                        <button
                          type="button"
                          onClick={() => setQuickPayAmount('2000')}
                          className="px-2.5 py-1 rounded-lg bg-stone-800 text-stone-300 font-mono text-[11px] cursor-pointer"
                        >
                          ₹2,000
                        </button>
                      )}
                      {quickPayCustomer.currentBalance > 5000 && (
                        <button
                          type="button"
                          onClick={() => setQuickPayAmount('5000')}
                          className="px-2.5 py-1 rounded-lg bg-stone-800 text-stone-300 font-mono text-[11px] cursor-pointer"
                        >
                          ₹5,000
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Amount Input */}
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    Payment Amount (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-stone-400 font-mono font-bold text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      autoFocus
                      value={quickPayAmount}
                      onChange={(e) => setQuickPayAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-base font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Payment Mode Pills */}
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Payment Method *
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'UPI', label: 'UPI / GPay' },
                      { id: 'CASH', label: 'Cash' },
                      { id: 'BANK_TRANSFER', label: 'Bank (NEFT)' },
                      { id: 'CARD', label: 'Card' },
                      { id: 'CHEQUE', label: 'Cheque' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setQuickPayMethod(m.id)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-semibold text-center border transition-all cursor-pointer ${
                          quickPayMethod === m.id
                            ? 'bg-amber-500 text-stone-950 border-amber-400 font-bold shadow'
                            : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reference Number */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                    Reference / UTR / Cheque # (Optional)
                  </label>
                  <input
                    type="text"
                    value={quickPayRef}
                    onChange={(e) => setQuickPayRef(e.target.value)}
                    placeholder="e.g. UTR / Transaction ID..."
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-800">
                  <button
                    type="button"
                    onClick={() => setIsQuickPayOpen(false)}
                    className="px-4 py-2 rounded-xl text-stone-400 hover:text-stone-200 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={quickPaySubmitting}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-950/40 disabled:opacity-50 cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>
                      {quickPaySubmitting
                        ? 'Recording...'
                        : `Record ₹${parseFloat(quickPayAmount || 0).toLocaleString('en-IN')}`}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ADD / EDIT CUSTOMER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 sm:p-6 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-serif font-bold text-lg text-stone-100">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="my-3 p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-300 mb-1">
                  Full Name / Firm Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Studio Vista Architecture"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">Mobile Phone (Optional)</label>
                  <input
                    type="text"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@client.com"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">Customer Category</label>
                  <select
                    value={formData.customerType}
                    onChange={(e) => {
                      const t = e.target.value;
                      const next = { ...formData, customerType: t };
                      if (t === 'WHOLESALE') {
                        const pb = pricebooks.find((p) => p.code === 'WHOLESALE');
                        if (pb) next.pricebookId = pb.id;
                      } else if (t === 'INTERIOR_DESIGNER') {
                        const pb = pricebooks.find((p) => p.code === 'DESIGNER');
                        if (pb) next.pricebookId = pb.id;
                      }
                      setFormData(next);
                    }}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs focus:border-amber-500 focus:outline-none"
                  >
                    <option value="RETAIL">Retail Showroom Customer</option>
                    <option value="WHOLESALE">Wholesale & Trade Partner (35% Off)</option>
                    <option value="INTERIOR_DESIGNER">Interior Designer / Architect (20% Off)</option>
                    <option value="CORPORATE">Corporate / Hotel Decor</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">Assigned Pricing Tier</label>
                  <select
                    value={formData.pricebookId}
                    onChange={(e) => setFormData({ ...formData, pricebookId: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs text-amber-400 font-medium focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Default Retail Tier</option>
                    {pricebooks.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.discountPercentage > 0 ? `-${p.discountPercentage}%` : 'MRP'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => {
                      const g = e.target.value.toUpperCase();
                      const next = { ...formData, gstin: g };
                      if (!formData.panNo && g.length === 15) {
                        next.panNo = g.substring(2, 12);
                      }
                      setFormData(next);
                    }}
                    placeholder="24AAAAA0000A1Z5"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">GST Reg Date</label>
                  <input
                    type="text"
                    value={formData.gstDate}
                    onChange={(e) => setFormData({ ...formData, gstDate: e.target.value })}
                    placeholder="DD/MM/YYYY"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">PAN No.</label>
                  <input
                    type="text"
                    value={formData.panNo}
                    onChange={(e) => setFormData({ ...formData, panNo: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">MSME No. / Udyam</label>
                  <input
                    type="text"
                    value={formData.msmeNo}
                    onChange={(e) => setFormData({ ...formData, msmeNo: e.target.value })}
                    placeholder="UDYAM-GJ-01-XXXX"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-stone-300 mb-1">Billing Address</label>
                  <textarea
                    rows={2}
                    value={formData.billingAddress}
                    onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                    placeholder="Showroom / Residence address"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="395006"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-300 hover:bg-stone-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Credit Ledger & Statement Modal */}
      <CustomerLedgerModal
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        customerId={selectedLedgerCustomerId}
        onBalanceUpdated={fetchCustomers}
      />

      {/* Customer / Account Bulk Import Modal (Excel, TSV, CSV & Curated Art Master) */}
      <CustomerImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImported={fetchCustomers}
      />
    </div>
  );
}
