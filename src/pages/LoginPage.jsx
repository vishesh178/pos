import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const fillCredentials = (userEmail, userPass) => {
    setEmail(userEmail);
    setPassword(userPass);
    setError('');
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-stone-950 p-6 relative overflow-hidden">
      {/* Decorative luxury lighting */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-stone-900/90 border border-stone-800 rounded-2xl shadow-2xl p-8 backdrop-blur-xl relative z-10">
        {/* Brand identity header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 mx-auto flex items-center justify-center shadow-lg shadow-amber-950/50 text-stone-950 font-serif font-black text-2xl tracking-tighter mb-4">
            CA
          </div>
          <h1 className="text-2xl font-serif font-bold text-stone-100 tracking-wide">
            CURATED ART
          </h1>
          <p className="text-xs text-amber-500 tracking-widest uppercase font-medium mt-1">
            Luxury Décor ERP & Billing System
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@curatedart.in"
                className="w-full pl-10 pr-4 py-2.5 bg-stone-950/80 border border-stone-700 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-stone-950/80 border border-stone-700 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-bold text-sm tracking-wide hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
          >
            <span>{submitting ? 'Authenticating...' : 'Sign In to Showroom'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div className="mt-8 pt-6 border-t border-stone-800/80">
          <p className="text-[11px] text-stone-400 text-center font-medium mb-3">
            Quick Sign-In by Role:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillCredentials('admin@curatedart.in', 'admin123')}
              className="py-1.5 px-2 rounded-lg bg-stone-800/80 hover:bg-stone-800 text-[11px] text-stone-300 hover:text-amber-400 border border-stone-700/60 transition-colors text-center"
            >
              <div className="font-semibold">Admin</div>
              <div className="text-[9px] text-stone-400">admin123</div>
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('manager@curatedart.in', 'manager123')}
              className="py-1.5 px-2 rounded-lg bg-stone-800/80 hover:bg-stone-800 text-[11px] text-stone-300 hover:text-amber-400 border border-stone-700/60 transition-colors text-center"
            >
              <div className="font-semibold">Manager</div>
              <div className="text-[9px] text-stone-400">manager123</div>
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('cashier@curatedart.in', 'cashier123')}
              className="py-1.5 px-2 rounded-lg bg-stone-800/80 hover:bg-stone-800 text-[11px] text-stone-300 hover:text-amber-400 border border-stone-700/60 transition-colors text-center"
            >
              <div className="font-semibold">Billing</div>
              <div className="text-[9px] text-stone-400">cashier123</div>
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Local offline-ready encrypted database</span>
        </div>
      </div>
    </div>
  );
}

