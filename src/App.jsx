import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { POSProvider } from './context/POSContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import ProductsPage from './pages/ProductsPage';
import InventoryPage from './pages/InventoryPage';
import POSPage from './pages/POSPage';
import EstimatesPage from './pages/EstimatesPage';
import SalesReturnsPage from './pages/SalesReturnsPage';
import CustomersPage from './pages/CustomersPage';
import PurchasesPage from './pages/PurchasesPage';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import WholesaleCatalogPage from './pages/WholesaleCatalogPage';
import ExpensesPage from './pages/ExpensesPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-stone-950 text-amber-500 font-serif">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-stone-400">Loading Curated Art ERP...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !hasPermission(allowedRoles)) {
    return (
      <div className="p-8 text-center text-stone-400">
        <h3 className="text-lg font-bold text-stone-200">Access Denied</h3>
        <p className="text-xs mt-1">Your role ({user.role}) does not have permission to access this module.</p>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <POSProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="pos" element={<POSPage />} />
                <Route path="estimates" element={<EstimatesPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="wholesale-catalog" element={<WholesaleCatalogPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="purchases" element={<PurchasesPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="returns" element={<SalesReturnsPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="zoho-sync" element={<Navigate to="/settings" replace />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </POSProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
