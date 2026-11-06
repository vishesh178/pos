import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  BookOpen,
  Boxes,
  Truck,
  Users,
  Receipt,
  BarChart3,
  RotateCcw,
  Settings,
  LogOut,
  Sparkles,
  X,
  FileText,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function SidebarContent({ onCloseMobile, handleLogout, user, hasPermission, navItems }) {
  return (
    <>
      <div>
        {/* Brand Banner */}
        <div className="p-5 border-b border-stone-800 flex items-center justify-between bg-stone-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-950/40 text-black font-serif font-black text-xl tracking-tighter">
              CA
            </div>
            <div>
              <h1 className="text-stone-100 font-serif text-lg tracking-wide font-bold flex items-center gap-1.5">
                CURATED ART
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-amber-500 font-medium">
                Luxury Home Décor ERP
              </p>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-210px)]">
          {navItems.map((item) => {
            if (!hasPermission(item.roles)) return null;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={() => {
                  if (onCloseMobile) onCloseMobile();
                }}
                className={({ isActive }) =>
                  `flex items-center px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-amber-500 text-stone-950 font-semibold shadow-md shadow-amber-950/30'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 mr-3 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Info & Quick Sign Out */}
      <div className="p-4 border-t border-stone-800 bg-stone-900/90">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xs uppercase">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-stone-200 truncate">{user?.name || 'Cashier'}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-amber-400 font-mono tracking-wider">
                {user?.role || 'BILLING'}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 text-stone-400 hover:text-rose-400 hover:bg-stone-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}

export default function Sidebar({ isOpenMobile, onCloseMobile }) {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'BILLING', 'INVENTORY'] },
    { name: 'POS Billing', path: '/pos', icon: ShoppingBag, roles: ['ADMIN', 'MANAGER', 'BILLING'] },
    { name: 'Invoices Register', path: '/invoices', icon: Receipt, roles: ['ADMIN', 'MANAGER', 'BILLING'] },
    { name: 'Estimates & Quotes', path: '/estimates', icon: FileText, roles: ['ADMIN', 'MANAGER', 'BILLING'] },
    { name: 'Products Catalog', path: '/products', icon: Package, roles: ['ADMIN', 'MANAGER', 'INVENTORY'] },
    { name: 'Wholesale Catalog', path: '/wholesale-catalog', icon: BookOpen, roles: ['ADMIN', 'MANAGER', 'BILLING', 'INVENTORY'] },
    { name: 'Inventory & Stock', path: '/inventory', icon: Boxes, roles: ['ADMIN', 'MANAGER', 'INVENTORY'] },
    { name: 'Purchases & Bills', path: '/purchases', icon: Truck, roles: ['ADMIN', 'MANAGER', 'INVENTORY'] },
    { name: 'Customer Directory', path: '/customers', icon: Users, roles: ['ADMIN', 'MANAGER', 'BILLING'] },
    { name: 'Sales Returns', path: '/returns', icon: RotateCcw, roles: ['ADMIN', 'MANAGER', 'BILLING'] },
    { name: 'Expense Tracker', path: '/expenses', icon: Wallet, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Financial & GST', path: '/reports', icon: BarChart3, roles: ['ADMIN', 'MANAGER'] },
    { name: 'System Settings', path: '/settings', icon: Settings, roles: ['ADMIN'] },
  ];

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="print:hidden hidden md:flex w-64 bg-stone-900 border-r border-stone-800 flex-col justify-between shrink-0 select-none">
        <SidebarContent
          handleLogout={handleLogout}
          user={user}
          hasPermission={hasPermission}
          navItems={navItems}
        />
      </aside>

      {/* Mobile Off-Canvas Drawer */}
      <div
        className={`print:hidden fixed inset-0 z-50 md:hidden flex transition-all duration-300 ${
          isOpenMobile ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        />
        <aside
          className={`relative w-72 max-w-[85vw] bg-stone-900 border-r border-stone-800 flex flex-col justify-between z-10 select-none transform transition-transform duration-300 ease-in-out shadow-2xl h-full ${
            isOpenMobile ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <SidebarContent
            onCloseMobile={onCloseMobile}
            handleLogout={handleLogout}
            user={user}
            hasPermission={hasPermission}
            navItems={navItems}
          />
        </aside>
      </div>
    </>
  );
}
