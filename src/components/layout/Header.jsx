import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sun,
  Moon,
  Wifi,
  CloudCheck,
  ShieldCheck,
  Zap,
  Menu,
  Smartphone,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import MobileConnectModal from './MobileConnectModal';

export default function Header({ onOpenMobileMenu }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const routeTitles = {
    '/': 'Executive Showroom Dashboard',
    '/pos': 'High-Speed POS & Billing Desk',
    '/products': 'Curated Home Décor Catalog',
    '/inventory': 'Real-Time Inventory & Movement Ledger',
    '/purchases': 'Supplier Inward & Purchase Orders',
    '/customers': 'Customer Directory & Accounts',
    '/returns': 'Sales Returns & Credit Notes',
    '/expenses': 'Showroom Operating Expenses',
    '/reports': 'Financial & Indian GST Reports',
    '/wholesale-catalog': 'Daily Wholesale Stock Catalog & Rate Sheet',
    '/zoho-sync': 'Zoho Outbox & Synchronization Center',
    '/settings': 'System & Business Configuration',
  };

  const mobileRouteTitles = {
    '/': 'Dashboard',
    '/pos': 'POS Desk',
    '/products': 'Catalog',
    '/inventory': 'Inventory',
    '/purchases': 'Purchases',
    '/customers': 'Customers',
    '/returns': 'Returns',
    '/expenses': 'Expenses',
    '/reports': 'Reports',
    '/wholesale-catalog': 'Wholesale',
    '/zoho-sync': 'Zoho Sync',
    '/settings': 'Settings',
  };

  const title = routeTitles[location.pathname] || 'Curated Art ERP';

  return (
    <>
      <header className="print:hidden h-16 bg-stone-900 border-b border-stone-800 px-4 md:px-6 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-3">
          {/* Mobile Hamburger Drawer Toggle */}
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h2 className="text-sm font-bold text-stone-100 tracking-wide flex items-center gap-2 font-serif truncate max-w-[200px] sm:max-w-none">
              <span className="sm:hidden">{mobileRouteTitles[location.pathname] || 'Curated Art'}</span>
              <span className="hidden sm:inline">{title}</span>
            </h2>
            <p className="text-[11px] text-stone-400 hidden sm:block">
              Showroom #104, Design District, SG Highway, Ahmedabad
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {/* Mobile App Connection Button (Desktop/Tablet only) */}
          <button
            onClick={() => setIsMobileModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500 hover:text-stone-950 text-xs font-semibold transition-all shadow-sm"
            title="Connect iPhone, Android, or Tablet"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Use on Mobile</span>
            <span className="md:hidden text-[10px]">Mobile</span>
          </button>

          {/* Quick POS action button if not already on POS */}
          {location.pathname !== '/pos' && (
            <button
              onClick={() => navigate('/pos')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 text-stone-300 hover:text-amber-400 text-xs font-semibold transition-all"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>POS (F2)</span>
            </button>
          )}

          {/* Local Offline-First Status */}
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-[11px] text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Local ERP: Active</span>
          </div>

          {/* Date & Time Clock in Indian Format */}
          <div className="text-right text-[11px] text-stone-400 hidden md:block">
            <p className="font-medium text-stone-300">
              {currentTime.toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
            <p className="font-mono text-[10px] text-amber-500">
              {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title="Toggle Light/Dark Theme"
            className="p-2 rounded-xl bg-stone-800 text-stone-300 hover:text-amber-400 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Pairing Modal */}
      <MobileConnectModal
        isOpen={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
      />
    </>
  );
}

