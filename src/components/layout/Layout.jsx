import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  BookOpen,
  Package,
  Menu,
} from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import { RouteErrorBoundary } from './ErrorBoundary';

export default function Layout() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F2 jumps to POS from any screen
      if (e.key === 'F2') {
        e.preventDefault();
        navigate('/pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const mobileNavItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'POS Desk', path: '/pos', icon: ShoppingBag },
    { name: 'Catalog', path: '/wholesale-catalog', icon: BookOpen },
    { name: 'Products', path: '/products', icon: Package },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-950 text-stone-100 print:h-auto print:w-auto print:overflow-visible print:bg-white print:text-black">
      {/* Sidebar with Desktop mode + Mobile Drawer mode */}
      <Sidebar
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden print:overflow-visible print:h-auto">
        <Header onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 bg-stone-950/90 print:p-0 print:overflow-visible print:bg-white">
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </main>

        {/* Mobile Bottom Navigation Bar (Hidden on Desktop & Print) */}
        <nav className="print:hidden md:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-900/95 border-t border-stone-800 backdrop-blur-lg flex items-center justify-around h-16 px-2 safe-area-pb">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                    isActive ? 'text-amber-400 font-bold' : 'text-stone-400 hover:text-stone-200'
                  }`
                }
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] tracking-tight">{item.name}</span>
              </NavLink>
            );
          })}

          {/* More / Menu Drawer Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 text-stone-400 hover:text-stone-200 transition-colors"
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
