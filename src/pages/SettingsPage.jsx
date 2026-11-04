import React, { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  Users,
  Database,
  Save,
  Plus,
  Shield,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { token, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('business'); // 'business', 'users', 'backup'

  // Business Profile State
  const [profile, setProfile] = useState({
    businessName: '',
    legalName: '',
    gstin: '',
    state: 'Gujarat',
    stateCode: '24',
    address: '',
    phone: '',
    email: '',
    invoicePrefix: 'CA-',
    invoiceNextNumber: 1001,
    thermalWidth: '80mm',
    termsAndConditions: '',
  });

  // User Management State
  const [users, setUsers] = useState([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'BILLING',
  });

  // Backups State
  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const resProf = await fetch('/api/business/profile');
      const dataProf = await resProf.json();
      setProfile(dataProf);

      if (hasPermission('ADMIN')) {
        const [resUsers, resBackups] = await Promise.all([
          fetch('/api/auth/users', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/backup/list', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (resUsers.ok) setUsers(await resUsers.json());
        if (resBackups.ok) setBackups(await resBackups.json());
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/business/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      setMessage('Business profile and invoice preferences saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUserForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      setIsUserModalOpen(false);
      setNewUserForm({ name: '', email: '', password: '', role: 'BILLING' });
      loadData();
      alert('User created successfully.');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleUser = async (userId) => {
    try {
      const res = await fetch(`/api/auth/users/${userId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch('/api/backup/create', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(`Backup Created: ${data.backup.fileName} (${data.backup.sizeKb} KB)`);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (fileName) => {
    if (!window.confirm(`RESTORE WARNING: Overwrite active database with ${fileName}? A safety backup will be made.`)) return;

    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(data.message);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold font-serif text-stone-100 flex items-center gap-2">
          <Settings className="w-6 h-6 text-amber-500" />
          <span>Showroom Configuration & Settings</span>
        </h1>
        <p className="text-xs text-stone-400 mt-1">
          Store business profile, GST credentials, user roles & local database disaster recovery
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-800 pb-2">
        <button
          onClick={() => setActiveTab('business')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'business'
              ? 'bg-amber-500 text-stone-950'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Business & GST Profile</span>
        </button>

        {hasPermission('ADMIN') && (
          <>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'users'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>User Accounts ({users.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('backup')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'backup'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Database Backup & Restore</span>
            </button>
          </>
        )}
      </div>

      {/* Notification */}
      {message && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: BUSINESS PROFILE */}
      {activeTab === 'business' && (
        <form onSubmit={handleSaveProfile} className="p-6 bg-stone-900 border border-stone-800 rounded-2xl shadow-xl space-y-4">
          <h3 className="font-serif font-bold text-base text-stone-100 pb-2 border-b border-stone-800">
            Showroom & Statutory Tax Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-stone-300 mb-1">Brand Name *</label>
              <input
                type="text"
                required
                value={profile.businessName}
                onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm font-serif"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-300 mb-1">Legal Entity Name *</label>
              <input
                type="text"
                required
                value={profile.legalName}
                onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-stone-300 mb-1">Showroom GSTIN *</label>
              <input
                type="text"
                required
                value={profile.gstin}
                onChange={(e) => setProfile({ ...profile, gstin: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-300 mb-1">Home State</label>
              <input
                type="text"
                value={profile.state}
                onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-300 mb-1">State Code</label>
              <input
                type="text"
                value={profile.stateCode}
                onChange={(e) => setProfile({ ...profile, stateCode: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-300 mb-1">Showroom Address *</label>
            <textarea
              rows={2}
              required
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-stone-300 mb-1">Phone</label>
              <input
                type="text"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-300 mb-1">Invoice Series Prefix</label>
              <input
                type="text"
                value={profile.invoicePrefix}
                onChange={(e) => setProfile({ ...profile, invoicePrefix: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-300 mb-1">Next Invoice Sequence #</label>
              <input
                type="number"
                value={profile.invoiceNextNumber}
                onChange={(e) => setProfile({ ...profile, invoiceNextNumber: parseInt(e.target.value, 10) || 1001 })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-300 mb-1">Receipt Terms & Conditions</label>
            <textarea
              rows={3}
              value={profile.termsAndConditions}
              onChange={(e) => setProfile({ ...profile, termsAndConditions: e.target.value })}
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs whitespace-pre-line"
            />
          </div>

          <div className="pt-3 border-t border-stone-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs tracking-wide shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Business Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && hasPermission('ADMIN') && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff Account</span>
            </button>
          </div>

          <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                <tr>
                  <th className="px-5 py-3">Full Name</th>
                  <th className="px-4 py-3">Email Address</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800 text-stone-300">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-stone-800/40">
                    <td className="px-5 py-3 font-semibold text-stone-100">{u.name}</td>
                    <td className="px-4 py-3 font-mono text-stone-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-stone-800 text-amber-400 font-bold font-mono text-[10px]">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                          u.isActive
                            ? 'bg-emerald-950 text-emerald-400'
                            : 'bg-rose-950 text-rose-400'
                        }`}
                      >
                        {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleToggleUser(u.id)}
                        className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DATABASE BACKUP & RESTORE */}
      {activeTab === 'backup' && hasPermission('ADMIN') && (
        <div className="space-y-6">
          <div className="p-6 bg-stone-900 border border-stone-800 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif font-bold text-base text-stone-100">
                Instant Local SQLite Database Backup
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Creates an immutable snapshot of all invoices, products, stock movements, and sync jobs
              </p>
            </div>

            <button
              onClick={handleCreateBackup}
              disabled={backupLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md"
            >
              <Database className="w-4 h-4" />
              <span>{backupLoading ? 'Creating Snapshot...' : 'Create Snapshot Backup'}</span>
            </button>
          </div>

          {/* Backup History Table */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 border-b border-stone-800">
              <h4 className="font-serif font-bold text-sm text-stone-100">
                Available Backups in Local Vault (`database/backups/`)
              </h4>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
                <tr>
                  <th className="px-5 py-3">Backup File Name</th>
                  <th className="px-4 py-3">File Size</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800 text-stone-300 font-mono">
                {backups.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-stone-400 font-sans">
                      No backups created yet. Click "Create Snapshot Backup" above.
                    </td>
                  </tr>
                ) : (
                  backups.map((b) => (
                    <tr key={b.fileName} className="hover:bg-stone-800/40">
                      <td className="px-5 py-3 font-semibold text-stone-100">{b.fileName}</td>
                      <td className="px-4 py-3 text-amber-500 font-bold">{b.sizeKb} KB</td>
                      <td className="px-4 py-3 text-stone-400 text-[11px]">
                        {new Date(b.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3 text-right font-sans">
                        <button
                          onClick={() => handleRestoreBackup(b.fileName)}
                          className="px-2.5 py-1 rounded bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-300 text-xs font-semibold transition-colors"
                        >
                          Restore
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

      {/* New User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-serif font-bold text-base text-stone-100">Add Staff User</h3>
              <button onClick={() => setIsUserModalOpen(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-300 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  placeholder="staff@curatedart.in"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-300 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-300 mb-1">Role *</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
                >
                  <option value="BILLING">Billing Staff / Cashier (POS & Sales)</option>
                  <option value="INVENTORY">Inventory Staff (Catalog & Stock)</option>
                  <option value="MANAGER">Store Manager (Operational Reports & POs)</option>
                  <option value="ADMIN">Owner / Admin (Full System Access)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 text-stone-950 font-bold"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

