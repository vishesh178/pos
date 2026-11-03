import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  CreditCard,
  Package,
  AlertTriangle,
  Users,
  Truck,
  RotateCcw,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/reports/dashboard', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const handleInv = () => fetchDashboardData();
    window.addEventListener('inventory-updated', handleInv);
    return () => window.removeEventListener('inventory-updated', handleInv);
  }, []);

  const COLORS = ['#d97706', '#f59e0b', '#b45309', '#78350f', '#fbbf24', '#eab308'];

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400 font-serif">
        Loading showroom executive dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 bg-gradient-to-r from-stone-900 via-stone-900 to-amber-950/40 border border-stone-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-amber-500">
            Curated Art Luxury Showroom
          </span>
          <h1 className="text-2xl font-bold font-serif text-stone-100 tracking-wide mt-0.5">
            Welcome back, {user?.name?.split(' ')[0] || 'Viren'}
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Real-time offline ERP metrics, inventory valuation, and Indian GST accounting
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Zoho Cloud Status Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                data.syncHealth.status === 'HEALTHY'
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-amber-400'
              }`}
            />
            <span className="text-stone-300 font-semibold text-[11px]">
              Zoho Sync: {data.syncHealth.status}
            </span>
          </div>

          <button
            onClick={() => navigate('/pos')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-all shadow-lg shadow-amber-950/40"
          >
            <Zap className="w-4 h-4" />
            <span>Launch POS (F2)</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
          <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Today's Sales</p>
          <p className="text-xl font-black text-amber-400 font-mono mt-1">
            ₹{data.todaySales.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">Walk-in & B2B</p>
        </div>

        <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
          <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Monthly Sales</p>
          <p className="text-xl font-black text-stone-100 font-mono mt-1">
            ₹{data.monthlySales.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">Current month</p>
        </div>

        <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
          <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Total Revenue</p>
          <p className="text-xl font-black text-stone-100 font-mono mt-1">
            ₹{data.totalRevenue.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">All-time invoices</p>
        </div>

        {isAdmin && data.grossProfit !== null && (
          <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
            <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Gross Profit</p>
            <p className="text-xl font-black text-emerald-400 font-mono mt-1">
              ₹{data.grossProfit.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-emerald-400 mt-0.5">Revenue - COGS</p>
          </div>
        )}

        <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
          <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Operating Expenses</p>
          <p className="text-xl font-black text-rose-400 font-mono mt-1">
            ₹{data.totalExpenses.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">Rent, power, salaries</p>
        </div>

        {isAdmin && data.netProfitEstimate !== null && (
          <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl">
            <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Net Profit Estimate</p>
            <p className="text-xl font-black text-amber-500 font-mono mt-1">
              ₹{data.netProfitEstimate.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5">After all expenses</p>
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 p-5 bg-stone-900/90 border border-stone-800 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif font-bold text-sm text-stone-100">7-Day Sales Trajectory</h3>
              <p className="text-[11px] text-stone-400">Daily invoiced gross sales revenue in INR</p>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400">
              ₹{data.todaySales.toFixed(2)} Today
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.salesChart}>
                <defs>
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#78716c" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#78716c"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1c1917',
                    borderColor: '#44403c',
                    borderRadius: '0.75rem',
                    fontSize: '11px',
                    color: '#f5f5f4',
                  }}
                  formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Sales']}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#d97706"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#goldGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Breakdown Donut Chart */}
        <div className="p-5 bg-stone-900/90 border border-stone-800 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="font-serif font-bold text-sm text-stone-100">Expense Allocation</h3>
            <p className="text-[11px] text-stone-400">Distribution by operational category</p>
          </div>

          <div className="h-48 w-full my-auto flex items-center justify-center">
            {data.expenseChart.length === 0 ? (
              <p className="text-stone-400 text-xs">No operating expenses recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.expenseChart}
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data.expenseChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1c1917',
                      borderColor: '#44403c',
                      borderRadius: '0.75rem',
                      fontSize: '11px',
                      color: '#f5f5f4',
                    }}
                    formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Amount']}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-[10px] text-stone-300">
            {data.expenseChart.slice(0, 4).map((e, idx) => (
              <span key={idx} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span>{e.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Operational Highlights & Top Selling Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Showroom Invoices */}
        <div className="p-5 bg-stone-900/90 border border-stone-800 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif font-bold text-sm text-stone-100">Recent POS Billing Invoices</h3>
            <button
              onClick={() => navigate('/reports')}
              className="text-xs text-amber-500 hover:text-amber-400 font-semibold"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-stone-800 text-xs">
            {data.recentTransactions.length === 0 ? (
              <p className="text-stone-400 py-6 text-center">No sales completed yet.</p>
            ) : (
              data.recentTransactions.map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-stone-100">{tx.invoiceNumber}</span>
                    <p className="text-[11px] text-stone-400 truncate max-w-xs">{tx.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-amber-400">₹{tx.grandTotal.toFixed(2)}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">
                      {tx.paymentMethod}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top-Selling Décor Pieces */}
        <div className="p-5 bg-stone-900/90 border border-stone-800 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif font-bold text-sm text-stone-100">Top-Selling Décor Items</h3>
            <button
              onClick={() => navigate('/products')}
              className="text-xs text-amber-500 hover:text-amber-400 font-semibold"
            >
              Catalog
            </button>
          </div>

          <div className="divide-y divide-stone-800 text-xs">
            {data.topProducts.length === 0 ? (
              <p className="text-stone-400 py-6 text-center">No item sales recorded yet.</p>
            ) : (
              data.topProducts.map((p, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-stone-800 text-amber-400 flex items-center justify-center font-mono font-bold text-xs">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-stone-100 font-serif truncate max-w-xs">{p.name}</p>
                      <p className="text-[10px] font-mono text-stone-400">{p.sku}</p>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <p className="font-bold text-stone-200">{p.quantity} Sold</p>
                    <p className="text-[10px] text-amber-400">₹{p.revenue.toFixed(0)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

