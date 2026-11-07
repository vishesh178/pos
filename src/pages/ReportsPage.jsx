import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Printer,
  TrendingUp,
  Package,
  PieChart,
  Users,
  CreditCard,
  Filter,
  Search,
  RefreshCw,
  Landmark,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ReceiptModal from '../components/pos/ReceiptModal';
import { downloadExportFile } from '../utils/exportDownloader';

// Native browser CSV export utility (zero dependencies, instant & reliable)
function exportToCsv(filename, rows) {
  if (!rows || !rows.length) return;
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const lines = rows.map((row) =>
    keys
      .map((k) => {
        let val = row[k] ?? '';
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      })
      .join(',')
  );
  const csvContent = [header, ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function ReportsPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState('sales-period');
  // Tabs: 'sales-period', 'product-margin', 'category-perf', 'outstandings', 'pnl', 'gst', 'invoices'

  const [loading, setLoading] = useState(true);

  // Data states
  const [dashData, setDashData] = useState(null);
  const [gstData, setGstData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [salesSummary, setSalesSummary] = useState(null);
  const [productMargins, setProductMargins] = useState([]);
  const [categorySales, setCategorySales] = useState(null);
  const [outstandings, setOutstandings] = useState(null);

  // Filters for Sales Summary
  const [period, setPeriod] = useState('month'); // 'today', 'week', 'month', 'year', 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Search filter for product profitability
  const [productSearch, setProductSearch] = useState('');

  // General Accounts (Chart of Accounts Ledger)
  const [generalAccounts, setGeneralAccounts] = useState([]);
  const [genAccountSearch, setGenAccountSearch] = useState('');
  const [genAccountGroupFilter, setGenAccountGroupFilter] = useState('ALL');
  const [loadingGenAccounts, setLoadingGenAccounts] = useState(false);

  const loadGeneralAccounts = async () => {
    setLoadingGenAccounts(true);
    try {
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/general-accounts', { headers: authHeaders });
      const data = await res.json();
      setGeneralAccounts(Array.isArray(data.accounts) ? data.accounts : []);
    } catch (err) {
      console.error('Failed to load general accounts:', err);
    } finally {
      setLoadingGenAccounts(false);
    }
  };

  // Reprint Receipt Modal State
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Load all baseline report data
  const loadInitialData = async () => {
    setLoading(true);
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [resDash, resGst, resInv, resProd, resCat, resOut] = await Promise.all([
        fetch('/api/reports/dashboard', { headers: authHeaders }),
        fetch('/api/reports/gst', { headers: authHeaders }),
        fetch('/api/pos/invoices?limit=100', { headers: authHeaders }),
        fetch('/api/reports/product-profitability', { headers: authHeaders }),
        fetch('/api/reports/category-sales', { headers: authHeaders }),
        fetch('/api/reports/outstandings', { headers: authHeaders }),
      ]);

      const [dataDash, dataGst, dataInv, dataProd, dataCat, dataOut] = await Promise.all([
        resDash.json(),
        resGst.json(),
        resInv.json(),
        resProd.json(),
        resCat.json(),
        resOut.json(),
      ]);

      setDashData(dataDash);
      setGstData(dataGst);
      setInvoices(dataInv);
      setProductMargins(Array.isArray(dataProd) ? dataProd : []);
      setCategorySales(dataCat);
      setOutstandings(dataOut);
      loadGeneralAccounts();
    } catch (err) {
      console.error('Failed to load initial reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load sales summary based on period filters
  const loadSalesSummary = async () => {
    try {
      let url = `/api/reports/sales-summary?period=${period}`;
      if (period === 'custom' && customStart && customEnd) {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setSalesSummary(data);
    } catch (err) {
      console.error('Failed to load sales summary:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadSalesSummary();
  }, [period]);

  const handleApplyCustomFilter = (e) => {
    e.preventDefault();
    if (customStart && customEnd) {
      loadSalesSummary();
    }
  };

  const handleReprint = (inv) => {
    setSelectedInvoice(inv);
    setIsReceiptOpen(true);
  };

  if (loading && !dashData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-stone-400 font-serif">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-3" />
        <span>Loading comprehensive financial & business reports...</span>
      </div>
    );
  }

  const grossMarginPercent =
    dashData?.totalRevenue > 0
      ? Math.round((dashData.grossProfit / dashData.totalRevenue) * 100)
      : 0;

  // Filtered product margins
  const filteredProducts = productMargins.filter((p) => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-serif text-stone-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-500" />
            <span>Curated Art — Executive Financial & Analytics Suite</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Realized gross profit, product margins, GST statutory summaries, sales registers & ledger outstandings
          </p>
        </div>

        <button
          onClick={() => {
            loadInitialData();
            loadSalesSummary();
            loadGeneralAccounts();
          }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-stone-800 bg-stone-900 text-stone-300 hover:text-amber-400 hover:border-amber-500/40 text-xs transition-colors self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh All Reports</span>
        </button>
      </div>

      {/* Report Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-800 pb-2 overflow-x-auto text-xs no-scrollbar">
        <button
          onClick={() => setActiveTab('sales-period')}
          className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'sales-period'
              ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/10'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Sales by Period</span>
        </button>

        <button
          onClick={() => setActiveTab('product-margin')}
          className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'product-margin'
              ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/10'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{isAdmin ? 'Product Margins & COGS' : 'Product Sales Performance'}</span>
        </button>

        <button
          onClick={() => setActiveTab('category-perf')}
          className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'category-perf'
              ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/10'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <PieChart className="w-3.5 h-3.5" />
          <span>Category Share</span>
        </button>

        <button
          onClick={() => setActiveTab('outstandings')}
          className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'outstandings'
              ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/10'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Outstandings Ledger</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('pnl')}
            className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'pnl'
                ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/10'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Profit & Loss</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('gst')}
          className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'gst'
              ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/10'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Indian GST (GSTR-1 & 3B)</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'invoices'
              ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/10'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Invoices Register ({invoices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('chart-of-accounts')}
          className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'chart-of-accounts'
              ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/10'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" />
          <span>Chart of Accounts {generalAccounts.length > 0 ? `(${generalAccounts.length})` : ''}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SALES BY PERIOD */}
      {/* ========================================================================= */}
      {activeTab === 'sales-period' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-stone-400 flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5 text-amber-500" />
                <span>Timeframe:</span>
              </span>
              {[
                { label: 'Today', val: 'today' },
                { label: 'Last 7 Days', val: 'week' },
                { label: 'This Month', val: 'month' },
                { label: 'This Year', val: 'year' },
                { label: 'Custom Date Range', val: 'custom' },
              ].map((p) => (
                <button
                  key={p.val}
                  onClick={() => setPeriod(p.val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    period === p.val
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-stone-800 text-stone-400 hover:text-stone-200 border border-transparent'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* CSV Export Button */}
            {salesSummary?.invoices && (
              <button
                onClick={() =>
                  exportToCsv(
                    `curated_art_sales_${period}_${new Date().toISOString().slice(0, 10)}.csv`,
                    salesSummary.invoices
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold text-xs transition-colors self-start md:self-auto shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Sales CSV</span>
              </button>
            )}
          </div>

          {/* Custom Date Range Picker */}
          {period === 'custom' && (
            <form
              onSubmit={handleApplyCustomFilter}
              className="p-4 bg-stone-900/80 border border-amber-500/30 rounded-2xl flex flex-wrap items-center gap-4 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="text-stone-400">From:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-stone-400">To:</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-lg transition-colors"
              >
                Apply Range
              </button>
            </form>
          )}

          {/* KPI Cards */}
          {salesSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                  Total Gross Sales
                </span>
                <p className="text-2xl font-black text-amber-400 font-mono mt-1">
                  ₹{salesSummary.totalRevenue.toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  Across {salesSummary.totalInvoices} invoice(s)
                </p>
              </div>

              <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                  Taxable Base Value
                </span>
                <p className="text-2xl font-black text-stone-200 font-mono mt-1">
                  ₹{salesSummary.totalTaxable.toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">Excludes GST components</p>
              </div>

              <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                  Total Tax Collected
                </span>
                <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
                  ₹{salesSummary.totalTax.toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  CGST: ₹{salesSummary.totalCgst} | SGST: ₹{salesSummary.totalSgst}
                </p>
              </div>

              <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                  Total Units Sold
                </span>
                <p className="text-2xl font-black text-blue-400 font-mono mt-1">
                  {salesSummary.totalQuantity} pcs
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  Discounts given: ₹{salesSummary.totalDiscount}
                </p>
              </div>
            </div>
          )}

          {/* Payment Method Breakdown */}
          {salesSummary && (
            <div className="p-5 bg-stone-900 border border-stone-800 rounded-2xl">
              <h3 className="font-serif font-bold text-sm text-stone-100 mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-500" />
                <span>Payment Mode Breakdown</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {['CASH', 'UPI', 'CARD', 'SPLIT'].map((m) => {
                  const amt = salesSummary.payments?.[m] || 0;
                  const count = salesSummary.paymentsCount?.[m] || 0;
                  const share =
                    salesSummary.totalRevenue > 0
                      ? Math.round((amt / salesSummary.totalRevenue) * 100)
                      : 0;
                  return (
                    <div key={m} className="p-3 bg-stone-800/60 rounded-xl border border-stone-700/60">
                      <div className="flex justify-between items-center text-stone-400 text-[10px] font-bold">
                        <span>{m}</span>
                        <span>{share}%</span>
                      </div>
                      <div className="text-base font-bold text-stone-100 font-mono mt-1">
                        ₹{amt.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">{count} transaction(s)</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Invoices List Table for this Period */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-stone-800 flex justify-between items-center">
              <div>
                <h3 className="font-serif font-bold text-sm text-stone-100">
                  Transactions in Selected Period ({salesSummary?.invoices?.length || 0})
                </h3>
                <p className="text-xs text-stone-400">Click any invoice to view or reprint receipt</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                  <tr>
                    <th className="px-5 py-3">Invoice #</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-center">Items</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3 text-right">Grand Total (₹)</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800 text-stone-300 font-mono">
                  {!salesSummary?.invoices || salesSummary.invoices.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-stone-400 font-sans">
                        No sales found for the selected date range.
                      </td>
                    </tr>
                  ) : (
                    salesSummary.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-stone-800/40">
                        <td className="px-5 py-3 font-bold text-amber-400">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3 font-sans text-stone-200">{inv.customerName}</td>
                        <td className="px-4 py-3 text-stone-400 text-[11px]">
                          {new Date(inv.date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-center">{inv.itemsCount}</td>
                        <td className="px-4 py-3 font-sans text-stone-300">{inv.paymentMethod}</td>
                        <td className="px-4 py-3 text-right font-bold text-stone-100">
                          ₹{inv.grandTotal.toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-right font-sans">
                          <button
                            onClick={() => handleReprint(inv)}
                            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-amber-400 text-[11px] font-semibold inline-flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Print</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PRODUCT PROFITABILITY & COGS */}
      {/* ========================================================================= */}
      {activeTab === 'product-margin' && (
        <div className="space-y-6">
          <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                placeholder="Search by product name, SKU or category..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl pl-9 pr-4 py-2 text-xs text-stone-200 placeholder-stone-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={() =>
                exportToCsv(
                  `curated_art_product_profitability_${new Date().toISOString().slice(0, 10)}.csv`,
                  productMargins
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold text-xs transition-colors self-start md:self-auto shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Product Margins CSV</span>
            </button>
          </div>

          <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-stone-800">
              <h3 className="font-serif font-bold text-sm text-stone-100">
                Item-Wise Gross Profit Margin & Cost of Goods Sold ({filteredProducts.length})
              </h3>
              <p className="text-xs text-stone-400">
                Direct supplier purchase cost versus realized retail revenue
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                  <tr>
                    <th className="px-5 py-3">Product / SKU</th>
                    <th className="px-4 py-3">Category</th>
                    {isAdmin && <th className="px-4 py-3 text-right">Cost (₹)</th>}
                    <th className="px-4 py-3 text-right">Price (₹)</th>
                    <th className="px-4 py-3 text-center">Stock</th>
                    <th className="px-4 py-3 text-center">Units Sold</th>
                    <th className="px-4 py-3 text-right">Revenue (₹)</th>
                    {isAdmin && <th className="px-4 py-3 text-right">COGS (₹)</th>}
                    {isAdmin && <th className="px-4 py-3 text-right">Gross Profit (₹)</th>}
                    {isAdmin && <th className="px-5 py-3 text-right">Margin (%)</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800 text-stone-300 font-mono">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 6} className="text-center py-8 text-stone-400 font-sans">
                        No products match your search query.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isHighMargin = (p.marginPercent || 0) >= 40;
                      return (
                        <tr key={p.id} className="hover:bg-stone-800/40">
                          <td className="px-5 py-3 font-sans">
                            <div className="font-bold text-stone-100">{p.name}</div>
                            <div className="text-[11px] font-mono text-stone-400">{p.sku}</div>
                          </td>
                          <td className="px-4 py-3 font-sans text-stone-400">{p.category}</td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right text-stone-400">
                              ₹{p.purchasePrice !== null && p.purchasePrice !== undefined ? p.purchasePrice.toFixed(2) : '0.00'}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-semibold text-stone-200">
                            ₹{(p.mrp || p.sellingPrice).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                                p.currentStock <= p.minStock
                                  ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                  : 'bg-stone-800 text-stone-300'
                              }`}
                            >
                              {p.currentStock}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-stone-100">
                            {p.unitsSold}
                          </td>
                          <td className="px-4 py-3 text-right text-amber-400 font-bold">
                            ₹{p.totalRevenue.toFixed(2)}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right text-rose-400">
                              ₹{p.totalCogs !== null && p.totalCogs !== undefined ? p.totalCogs.toFixed(2) : '0.00'}
                            </td>
                          )}
                          {isAdmin && (
                            <td className="px-4 py-3 text-right font-bold text-emerald-400">
                              ₹{p.grossProfit !== null && p.grossProfit !== undefined ? p.grossProfit.toFixed(2) : '0.00'}
                            </td>
                          )}
                          {isAdmin && (
                            <td className="px-5 py-3 text-right">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  isHighMargin
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                    : 'bg-stone-800 text-stone-300'
                                }`}
                              >
                                {p.marginPercent !== null && p.marginPercent !== undefined ? p.marginPercent : 0}%
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CATEGORY PERFORMANCE */}
      {/* ========================================================================= */}
      {activeTab === 'category-perf' && categorySales && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-serif font-bold text-base text-stone-100">
                Category Sales Distribution & Volume
              </h3>
              <p className="text-xs text-stone-400">
                Contribution of each art / decor collection to overall showroom revenue
              </p>
            </div>

            <button
              onClick={() =>
                exportToCsv(
                  `curated_art_category_performance_${new Date().toISOString().slice(0, 10)}.csv`,
                  categorySales.categories
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold text-xs transition-colors shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Categories CSV</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categorySales.categories.map((c) => (
              <div
                key={c.id}
                className="p-5 bg-stone-900 border border-stone-800 rounded-2xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-serif font-bold text-base text-stone-100">{c.name}</h4>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        {c.productsCount} catalog item(s) &bull; {c.unitsSold} unit(s) sold
                      </p>
                    </div>
                    <span className="text-sm font-black font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      {c.sharePercent}%
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-stone-400">Revenue:</span>
                      <span className="font-bold text-stone-100">₹{c.revenue.toLocaleString('en-IN')}</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(5, c.sharePercent))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: OUTSTANDINGS LEDGER (RECEIVABLES & PAYABLES) */}
      {/* ========================================================================= */}
      {activeTab === 'outstandings' && outstandings && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-stone-900 border border-stone-800 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                Total Customer Receivables (Dues)
              </span>
              <p className="text-2xl font-black text-amber-400 font-mono mt-1">
                ₹{outstandings.totalCustomerOutstanding.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">
                Owed by {outstandings.customers.length} customer(s)
              </p>
            </div>

            <div className="p-5 bg-stone-900 border border-stone-800 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                Total Supplier Payables (Liabilities)
              </span>
              <p className="text-2xl font-black text-rose-400 font-mono mt-1">
                ₹{outstandings.totalSupplierOutstanding.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">
                Owed to {outstandings.suppliers.length} supplier vendor(s)
              </p>
            </div>
          </div>

          {/* Customer Receivables Table */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-stone-800 flex justify-between items-center">
              <div>
                <h3 className="font-serif font-bold text-sm text-stone-100">
                  Customer Receivables Ledger ({outstandings.customers.length})
                </h3>
                <p className="text-xs text-stone-400">Unpaid credit balances from clients & designers</p>
              </div>

              {outstandings.customers.length > 0 && (
                <button
                  onClick={() =>
                    exportToCsv(
                      `curated_art_customer_receivables_${new Date().toISOString().slice(0, 10)}.csv`,
                      outstandings.customers
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold text-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Receivables CSV</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                  <tr>
                    <th className="px-5 py-3">Customer Name</th>
                    <th className="px-4 py-3">Mobile / Phone</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">GSTIN</th>
                    <th className="px-4 py-3 text-right">Lifetime Purchases (₹)</th>
                    <th className="px-5 py-3 text-right">Outstanding Due (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800 text-stone-300 font-mono">
                  {outstandings.customers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-stone-400 font-sans">
                        All customers are settled. Zero receivables outstanding!
                      </td>
                    </tr>
                  ) : (
                    outstandings.customers.map((c) => (
                      <tr key={c.id} className="hover:bg-stone-800/40">
                        <td className="px-5 py-3 font-sans font-bold text-stone-100">{c.name}</td>
                        <td className="px-4 py-3 text-stone-400">{c.mobile || '-'}</td>
                        <td className="px-4 py-3 font-sans">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-stone-300">
                            {c.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-400 text-[11px]">{c.gstin || 'B2C (None)'}</td>
                        <td className="px-4 py-3 text-right text-stone-300">
                          ₹{c.totalPurchases.toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-amber-400">
                          ₹{c.outstandingBalance.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Supplier Payables Table */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-stone-800 flex justify-between items-center">
              <div>
                <h3 className="font-serif font-bold text-sm text-stone-100">
                  Supplier Payables Ledger ({outstandings.suppliers.length})
                </h3>
                <p className="text-xs text-stone-400">Pending payments due to art studios and suppliers</p>
              </div>

              {outstandings.suppliers.length > 0 && (
                <button
                  onClick={() =>
                    exportToCsv(
                      `curated_art_supplier_payables_${new Date().toISOString().slice(0, 10)}.csv`,
                      outstandings.suppliers
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold text-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Payables CSV</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                  <tr>
                    <th className="px-5 py-3">Supplier Name</th>
                    <th className="px-4 py-3">Contact Person</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">GSTIN</th>
                    <th className="px-5 py-3 text-right">Outstanding Payable (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800 text-stone-300 font-mono">
                  {outstandings.suppliers.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-8 text-stone-400 font-sans">
                        All supplier accounts are settled. Zero payables pending!
                      </td>
                    </tr>
                  ) : (
                    outstandings.suppliers.map((s) => (
                      <tr key={s.id} className="hover:bg-stone-800/40">
                        <td className="px-5 py-3 font-sans font-bold text-stone-100">{s.name}</td>
                        <td className="px-4 py-3 font-sans text-stone-300">{s.contactPerson || '-'}</td>
                        <td className="px-4 py-3 text-stone-400">{s.phone || '-'}</td>
                        <td className="px-4 py-3 text-stone-400 text-[11px]">{s.gstin || '-'}</td>
                        <td className="px-5 py-3 text-right font-bold text-rose-400">
                          ₹{s.outstandingBalance.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PROFIT & LOSS */}
      {/* ========================================================================= */}
      {activeTab === 'pnl' && dashData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-stone-900 border border-stone-800 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                Gross Invoiced Revenue
              </span>
              <p className="text-2xl font-black text-stone-100 font-mono mt-1">
                ₹{dashData.totalRevenue.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">Total retail and designer sales</p>
            </div>

            <div className="p-5 bg-stone-900 border border-stone-800 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                Cost of Goods Sold (COGS)
              </span>
              <p className="text-2xl font-black text-rose-400 font-mono mt-1">
                ₹{(dashData.totalRevenue - dashData.grossProfit).toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">Direct supplier product costs</p>
            </div>

            <div className="p-5 bg-stone-900 border border-stone-800 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                Gross Profit Margin
              </span>
              <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
                ₹{dashData.grossProfit.toLocaleString('en-IN')}{' '}
                <span className="text-sm font-sans font-bold">({grossMarginPercent}%)</span>
              </p>
              <p className="text-[10px] text-emerald-400 mt-0.5">Realized trading margin</p>
            </div>
          </div>

          {/* Detailed Statement Table */}
          <div className="p-6 bg-stone-900 border border-stone-800 rounded-2xl shadow-xl max-w-2xl">
            <h3 className="font-serif font-bold text-base text-stone-100 mb-4 pb-2 border-b border-stone-800">
              Estimated Statement of Operational Income & Expense
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-stone-800 text-stone-300">
                <span className="font-semibold">Gross Sales Revenue:</span>
                <span className="font-mono font-bold text-stone-100">
                  ₹{dashData.totalRevenue.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-800 text-stone-400">
                <span>Less: Cost of Goods Sold (COGS):</span>
                <span className="font-mono text-rose-400">
                  -₹{(dashData.totalRevenue - dashData.grossProfit).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-stone-700 font-bold text-stone-200">
                <span>Gross Trading Profit:</span>
                <span className="font-mono text-emerald-400">
                  ₹{dashData.grossProfit.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-800 text-stone-400">
                <span>Less: Showroom Operating Expenses:</span>
                <span className="font-mono text-rose-400">
                  -₹{dashData.totalExpenses.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between py-2 border-t-2 border-stone-700 font-black text-sm text-stone-100">
                <span>Estimated Net Operating Profit:</span>
                <span className="font-mono text-amber-400 text-lg">
                  ₹{dashData.netProfitEstimate.toFixed(2)}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-stone-400 mt-4 leading-relaxed">
              * Note: Real-time estimate based on actual purchase costs and logged expenses. Formal financial statement requires final tax depreciation and CPA adjustments in Zoho Books.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: INDIAN GST REPORTS */}
      {/* ========================================================================= */}
      {activeTab === 'gst' && gstData && (
        <div className="space-y-6">
          {/* GSTR-3B Tax Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-stone-900 border border-stone-800 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                GSTR-3B Output Tax Liability
              </span>
              <p className="text-2xl font-black text-stone-100 font-mono mt-1">
                ₹{gstData.gstr3b.outputTaxLiability.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">Collected on customer sales</p>
            </div>

            <div className="p-5 bg-stone-900 border border-stone-800 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                Eligible Input Tax Credit (ITC)
              </span>
              <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
                ₹{gstData.gstr3b.inputTaxCredit.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">Paid on supplier purchase bills</p>
            </div>

            <div className="p-5 bg-stone-900 border border-stone-800 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                Net GST Payable
              </span>
              <p className="text-2xl font-black text-amber-400 font-mono mt-1">
                ₹{gstData.gstr3b.netTaxPayable.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-amber-400 mt-0.5">Output Tax minus ITC</p>
            </div>
          </div>

          {/* GSTR-1 HSN Summary Table */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-sm text-stone-100">
                  GSTR-1 Table 12: HSN-Wise Summary of Outward Supplies
                </h3>
                <p className="text-xs text-stone-400">Statutory summary for monthly GST filing</p>
              </div>

              {gstData.gstr1.hsnSummary.length > 0 && (
                <button
                  onClick={() =>
                    exportToCsv(
                      `curated_art_gstr1_hsn_${new Date().toISOString().slice(0, 10)}.csv`,
                      gstData.gstr1.hsnSummary
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold text-xs transition-colors shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export HSN CSV</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                  <tr>
                    <th className="px-5 py-3">HSN Code</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-center">Total Qty</th>
                    <th className="px-4 py-3 text-right">Taxable Value (₹)</th>
                    <th className="px-4 py-3 text-right">CGST (₹)</th>
                    <th className="px-4 py-3 text-right">SGST (₹)</th>
                    <th className="px-4 py-3 text-right">IGST (₹)</th>
                    <th className="px-5 py-3 text-right">Total Tax (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800 text-stone-300 font-mono">
                  {gstData.gstr1.hsnSummary.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-stone-400 font-sans">
                        No transactions recorded for HSN summary.
                      </td>
                    </tr>
                  ) : (
                    gstData.gstr1.hsnSummary.map((h, i) => (
                      <tr key={i} className="hover:bg-stone-800/40">
                        <td className="px-5 py-3 font-bold text-amber-400">{h.hsnCode}</td>
                        <td className="px-4 py-3 font-sans text-stone-200">{h.description}</td>
                        <td className="px-4 py-3 text-center font-bold">{h.totalQuantity}</td>
                        <td className="px-4 py-3 text-right text-stone-100 font-bold">
                          ₹{h.taxableValue.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-stone-400">₹{h.cgstAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-stone-400">₹{h.sgstAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-stone-400">₹{h.igstAmount.toFixed(2)}</td>
                        <td className="px-5 py-3 text-right text-amber-400 font-bold">
                          ₹{h.totalTax.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: SALES INVOICES REGISTER */}
      {/* ========================================================================= */}
      {activeTab === 'invoices' && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-stone-800 flex justify-between items-center">
            <div>
              <h3 className="font-serif font-bold text-sm text-stone-100">
                Complete Sales Invoices Register ({invoices.length})
              </h3>
              <p className="text-xs text-stone-400">Historical customer sales records & receipt reprinting</p>
            </div>

            {invoices.length > 0 && (
              <button
                onClick={() =>
                  exportToCsv(
                    `curated_art_all_invoices_${new Date().toISOString().slice(0, 10)}.csv`,
                    invoices
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold text-xs transition-colors shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export All Invoices CSV</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                <tr>
                  <th className="px-5 py-3">Invoice #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Payment Mode</th>
                  <th className="px-4 py-3 text-right">Taxable</th>
                  <th className="px-4 py-3 text-right">Tax</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800 text-stone-300 font-mono">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-10 text-stone-400 font-sans">
                      No invoices found.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-stone-800/40">
                      <td className="px-5 py-3 font-bold text-stone-100">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 font-sans font-semibold text-stone-200">
                        {inv.customerName}
                      </td>
                      <td className="px-4 py-3 text-stone-400 text-[11px]">
                        {new Date(inv.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-sans text-stone-300">{inv.paymentMethod}</td>
                      <td className="px-4 py-3 text-right text-stone-400">₹{inv.subtotal.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-stone-400">₹{inv.taxTotal.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-amber-400">
                        ₹{inv.grandTotal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-sans font-semibold">
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-sans">
                        <button
                          onClick={() => handleReprint(inv)}
                          className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-amber-400 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Reprint</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: CHART OF ACCOUNTS (GENERAL LEDGERS) */}
      {/* ========================================================================= */}
      {activeTab === 'chart-of-accounts' && (
        <div className="space-y-6">
          {/* Header & Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-serif font-bold text-stone-100 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-amber-500" />
                <span>Chart of Accounts (General Ledgers)</span>
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Bank accounts, cash books, partner capital, loans, liabilities and operating expense heads
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                type="button"
                onClick={async () => {
                  await downloadExportFile(
                    '/api/export/customers?format=xlsx',
                    'CURATED_ART-Account_List.xlsx',
                    token
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-colors shadow-md cursor-pointer"
                title="Export complete 25-category Master Account List to Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Master Account List (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await downloadExportFile(
                    '/api/export/customers?format=csv',
                    'CURATED_ART-Account_List.csv',
                    token
                  );
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-500/50 text-stone-400 hover:text-stone-200 font-semibold text-xs transition-colors shadow-md cursor-pointer"
                title="Export complete 25-category Master Account List to CSV (.csv)"
              >
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics KPI Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
              <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
                <span>Bank & Cash Heads</span>
                <Wallet className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {generalAccounts.filter((a) => a.accountGroup === 'Bank & Cash' || a.accountType === 'BANK' || a.accountType === 'CASH').length}
              </div>
              <p className="text-[10px] text-stone-400 mt-1">HDFC, SBI & Cash on Hand</p>
            </div>

            <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
              <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
                <span>Capital & Reserves</span>
                <Landmark className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold font-mono text-amber-400">
                {generalAccounts.filter((a) => a.accountGroup === 'Capital & Reserves' || a.accountType === 'CAPITAL').length}
              </div>
              <p className="text-[10px] text-stone-400 mt-1">Partners Capital & Reserves</p>
            </div>

            <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
              <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
                <span>Loans & Borrowings</span>
                <CreditCard className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-400">
                {generalAccounts.filter((a) => a.accountGroup === 'Loans & Borrowings' || a.accountType === 'LOAN').length}
              </div>
              <p className="text-[10px] text-stone-400 mt-1">Secured & Unsecured Loans</p>
            </div>

            <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
              <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
                <span>Total General Ledgers</span>
                <Layers className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-xl font-bold font-mono text-stone-100">
                {generalAccounts.length}
              </div>
              <p className="text-[10px] text-stone-400 mt-1">Distinct Accounting Heads</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-3 bg-stone-900/90 border border-stone-800 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={genAccountSearch}
                onChange={(e) => setGenAccountSearch(e.target.value)}
                placeholder="Search ledger by name, group, PAN, GSTIN..."
                className="w-full pl-9 pr-4 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={genAccountGroupFilter}
                onChange={(e) => setGenAccountGroupFilter(e.target.value)}
                className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-300 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Account Groups</option>
                <option value="Bank & Cash">🏦 Bank & Cash</option>
                <option value="Capital & Reserves">💰 Capital & Reserves</option>
                <option value="Loans & Borrowings">📜 Loans & Borrowings</option>
                <option value="Operating Expenses">📊 Operating & Trading Expenses</option>
                <option value="Current Assets">📦 Current Assets & Stock</option>
                <option value="Liabilities">⚖️ Liabilities & Duties</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-900/90 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Ledger Account Name</th>
                    <th className="px-4 py-3.5">Account Group</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Tally Section</th>
                    <th className="px-4 py-3.5 text-right">Opening Balance</th>
                    <th className="px-4 py-3.5 text-center">PAN / GSTIN</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/80 text-stone-300">
                  {loadingGenAccounts ? (
                    <tr>
                      <td colSpan="7" className="text-center py-12 text-stone-400 font-serif">
                        Loading Chart of Accounts...
                      </td>
                    </tr>
                  ) : generalAccounts.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-12 text-stone-400">
                        No general accounts found in the database. Use Master Excel Import to populate.
                      </td>
                    </tr>
                  ) : (
                    generalAccounts
                      .filter((a) => {
                        if (genAccountGroupFilter !== 'ALL' && a.accountGroup !== genAccountGroupFilter) {
                          return false;
                        }
                        if (genAccountSearch) {
                          const q = genAccountSearch.toLowerCase();
                          return (
                            a.name.toLowerCase().includes(q) ||
                            (a.accountGroup && a.accountGroup.toLowerCase().includes(q)) ||
                            (a.section && a.section.toLowerCase().includes(q)) ||
                            (a.panNo && a.panNo.toLowerCase().includes(q)) ||
                            (a.gstin && a.gstin.toLowerCase().includes(q))
                          );
                        }
                        return true;
                      })
                      .map((acc) => {
                        const isBankOrCash = acc.accountGroup === 'Bank & Cash' || acc.accountType === 'BANK' || acc.accountType === 'CASH';
                        const isCapital = acc.accountGroup === 'Capital & Reserves' || acc.accountType === 'CAPITAL';
                        const isLoan = acc.accountGroup === 'Loans & Borrowings' || acc.accountType === 'LOAN';
                        const isExpense = acc.accountGroup === 'Operating Expenses' || acc.accountType === 'EXPENSE';

                        return (
                          <tr key={acc.id} className="hover:bg-stone-800/40 transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-stone-100 font-serif">
                              {acc.name}
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                  isBankOrCash
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                    : isCapital
                                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                    : isLoan
                                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                    : isExpense
                                    ? 'bg-sky-950 text-sky-400 border border-sky-800'
                                    : 'bg-stone-800 text-stone-300'
                                }`}
                              >
                                {acc.accountGroup || 'General Ledger'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 font-mono text-[11px] text-stone-400">
                              {acc.accountType}
                            </td>
                            <td className="px-4 py-3.5 text-stone-400 text-[11px]">
                              {acc.section || '-'}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono font-semibold">
                              <span
                                className={
                                  acc.openingBalance < 0
                                    ? 'text-rose-400'
                                    : acc.openingBalance > 0
                                    ? 'text-emerald-400'
                                    : 'text-stone-400'
                                }
                              >
                                ₹{Math.abs(acc.openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                {acc.openingBalance < 0 ? ' (Dr)' : acc.openingBalance > 0 ? ' (Cr)' : ''}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono text-[10px] text-stone-400">
                              {acc.panNo || acc.gstin || '-'}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                                {acc.isActive ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reprint Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        invoice={selectedInvoice}
        businessProfile={null}
      />
    </div>
  );
}
