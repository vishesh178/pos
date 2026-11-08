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
  Trash2,
  Lock,
  HardDrive,
  ShieldCheck,
  Clock,
  Upload,
  FileSpreadsheet,
  Package,
  Truck,
  Receipt,
  Boxes,
  Tag,
  Landmark,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { downloadExportFile } from '../utils/exportDownloader';

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
  const [backupStatus, setBackupStatus] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [restoringFile, setRestoringFile] = useState(false);

  // Danger Zone / Nuclear Reset State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessModal, setResetSuccessModal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const resProf = await fetch('/api/business/profile');
      const dataProf = await resProf.json();
      setProfile(dataProf);

      if (hasPermission('ADMIN')) {
        const [resUsers, resBackups, resStatus] = await Promise.all([
          fetch('/api/auth/users', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/backup/list', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/backup/status', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (resUsers.ok) setUsers(await resUsers.json());
        if (resBackups.ok) setBackups(await resBackups.json());
        if (resStatus && resStatus.ok) setBackupStatus(await resStatus.json());
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

      // Notify header and all active components of the updated business profile
      window.dispatchEvent(new CustomEvent('business-profile-updated', { detail: data }));

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

  const handleCreateBackup = async (encrypted = false) => {
    setBackupLoading(true);
    try {
      const res = await fetch('/api/backup/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ encrypted }),
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

  const handleDownloadLiveBackup = (encrypted = false) => {
    setDownloading(true);
    try {
      const url = `/api/backup/download?token=${encodeURIComponent(token)}${encrypted ? '&encrypted=true' : ''}`;
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', '');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Download failed: ' + err.message);
    } finally {
      setTimeout(() => setDownloading(false), 1200);
    }
  };

  const handleDownloadFile = (fileName) => {
    const url = `/api/backup/download/${encodeURIComponent(fileName)}?token=${encodeURIComponent(token)}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteBackup = async (fileName) => {
    if (!window.confirm(`Are you sure you want to permanently delete backup "${fileName}" from the vault?`)) return;

    try {
      const res = await fetch(`/api/backup/${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      loadData();
    } catch (err) {
      alert(err.message);
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

  const handleUploadRestore = async (file) => {
    if (!file) return;
    if (
      !window.confirm(
        `RESTORE WARNING: Overwrite active database with "${file.name}"?\n\nAll current records will be replaced with the contents of this backup file. (A safety backup of the current database will be saved to the vault automatically).`
      )
    ) {
      return;
    }

    setRestoringFile(true);
    const formData = new FormData();
    formData.append('backupFile', file);

    try {
      const res = await fetch('/api/backup/upload-restore', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restore database');

      alert(data.message);
      loadData();
    } catch (err) {
      alert('Restore failed: ' + err.message);
    } finally {
      setRestoringFile(false);
    }
  };

  const handleNuclearFactoryReset = async () => {
    if (resetConfirmInput !== 'DESTROY ALL DATA') return;

    setIsResetting(true);
    setError('');

    try {
      const res = await fetch('/api/backup/factory-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmation: resetConfirmInput }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Factory reset failed');

      setIsResetModalOpen(false);
      setResetSuccessModal(true);
    } catch (err) {
      alert('Permanent Destruction Failed: ' + err.message);
      setIsResetting(false);
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

            <button
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'export'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Data Export & Migration</span>
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
          {/* Top Status & Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-stone-400 uppercase font-bold tracking-wider">Live SQLite Store</p>
                <p className="text-base font-bold font-mono text-stone-100">
                  {backupStatus?.activeDbSizeKb ? `${backupStatus.activeDbSizeKb} KB` : 'Active'}
                </p>
                <p className="text-[10px] text-stone-500 truncate mt-0.5">curated_art.db</p>
              </div>
            </div>

            <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-stone-400 uppercase font-bold tracking-wider">Local Snapshot Vault</p>
                <p className="text-base font-bold font-mono text-stone-100">
                  {backups.length} Snapshots
                </p>
                <p className="text-[10px] text-stone-500 truncate mt-0.5">
                  {backupStatus?.totalBackupsSizeKb ? `${(backupStatus.totalBackupsSizeKb / 1024).toFixed(1)} MB stored` : 'database/backups/'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-stone-400 uppercase font-bold tracking-wider">Automated Daily Protection</p>
                <p className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Active</span>
                </p>
                <p className="text-[10px] text-stone-500 truncate mt-0.5">Daily midnight • 30d retention</p>
              </div>
            </div>
          </div>

          {/* Off-Site 1-Click Download Hero Banner */}
          <div className="p-5 sm:p-6 bg-stone-900/90 border border-amber-500/30 rounded-2xl shadow-xl backdrop-blur-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                    Recommended Security Practice
                  </span>
                </div>
                <h3 className="font-serif font-bold text-lg text-stone-100">
                  Off-Site & One-Click Database Download
                </h3>
                <p className="text-xs text-stone-400 leading-relaxed">
                  All transactions, products, customer accounts, and stock movements are stored locally on this machine. Download a complete snapshot to your personal laptop, flash drive, or cloud storage regularly to protect against disk corruption or server termination.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadLiveBackup(false)}
                  disabled={downloading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md shadow-amber-950/40 transition-all cursor-pointer disabled:opacity-50"
                  title="Download raw SQLite database file directly to your downloads folder"
                >
                  <Download className="w-4 h-4" />
                  <span>{downloading ? 'Downloading...' : 'Download Database (.sqlite)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadLiveBackup(true)}
                  disabled={downloading}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-stone-950 border border-amber-500/40 hover:bg-stone-800 text-amber-300 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  title="Download AES-256 encrypted database snapshot for safe cloud storage"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Encrypted (.enc)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCreateBackup(false)}
                  disabled={backupLoading}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  title="Create a point-in-time snapshot directly in server vault"
                >
                  <Database className="w-3.5 h-3.5 text-stone-400" />
                  <span>{backupLoading ? 'Saving...' : 'Vault Snapshot'}</span>
                </button>

                <label
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-700 hover:border-amber-500 hover:text-amber-300 text-stone-300 font-semibold text-xs transition-colors cursor-pointer"
                  title="Upload a downloaded .sqlite or .enc backup from your laptop to restore your data"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>{restoringFile ? 'Restoring...' : 'Upload & Restore'}</span>
                  <input
                    type="file"
                    accept=".sqlite,.db,.enc"
                    className="hidden"
                    disabled={restoringFile}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadRestore(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Backup History Table */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 border-b border-stone-800 flex items-center justify-between">
              <div>
                <h4 className="font-serif font-bold text-sm text-stone-100">
                  Available Backups in Local Vault (`database/backups/`)
                </h4>
                <p className="text-[11px] text-stone-400">
                  Historical point-in-time snapshots available for download or immediate recovery
                </p>
              </div>
              <span className="text-xs font-mono text-stone-400">{backups.length} total</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Backup File Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">File Size</th>
                    <th className="px-4 py-3">Created At</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/80 text-stone-300 font-mono">
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-10 text-stone-400 font-sans">
                        No backups created yet. Click "Download Database (.sqlite)" or "Vault Snapshot" above.
                      </td>
                    </tr>
                  ) : (
                    backups.map((b) => (
                      <tr key={b.fileName} className="hover:bg-stone-800/40 transition-colors">
                        <td className="px-5 py-3 font-semibold text-stone-100 flex items-center gap-2">
                          {b.isEncrypted ? (
                            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <HardDrive className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                          )}
                          <span className="truncate max-w-xs">{b.fileName}</span>
                        </td>
                        <td className="px-4 py-3 font-sans">
                          {b.isEncrypted ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800 font-semibold">
                              AES-256 Encrypted
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-stone-300 font-semibold">
                              SQLite Database
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-amber-400 font-bold">{b.sizeKb} KB</td>
                        <td className="px-4 py-3 text-stone-400 text-[11px] font-sans">
                          {new Date(b.createdAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-5 py-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDownloadFile(b.fileName)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors cursor-pointer"
                              title="Download backup file to laptop"
                            >
                              <Download className="w-3.5 h-3.5 text-amber-400" />
                              <span>Download</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRestoreBackup(b.fileName)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-300 text-xs font-semibold transition-colors cursor-pointer"
                              title="Restore database from this snapshot"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteBackup(b.fileName)}
                              className="p-1.5 rounded-lg bg-stone-800 hover:bg-rose-950 text-stone-400 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Delete snapshot from vault"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* DANGER ZONE: Complete Data & Snapshots Destruction */}
          <div className="p-6 bg-gradient-to-br from-rose-950/40 via-stone-900 to-stone-900 border-2 border-rose-600/50 rounded-2xl shadow-2xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-rose-500/30">
                    <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                    <span>Danger Zone • Irreversible Action</span>
                  </span>
                </div>
                <h4 className="font-serif font-bold text-lg text-rose-100 flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-500" />
                  <span>Permanent Data & Snapshot Destruction</span>
                </h4>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Permanently destroys every database record across all tables (all invoices, product catalog, inventory stock movements, customer and vendor ledgers, expenses, sync jobs) and deletes all historical backup snapshots in <code className="text-rose-300 bg-rose-950/60 px-1 py-0.5 rounded font-mono text-[11px]">database/backups/</code> along with all uploaded product images. SQLite free-lists are securely wiped (<code className="text-rose-300 bg-rose-950/60 px-1 py-0.5 rounded font-mono text-[11px]">VACUUM</code> & <code className="text-rose-300 bg-rose-950/60 px-1 py-0.5 rounded font-mono text-[11px]">wal_checkpoint</code>) making any data recovery impossible.
                </p>
              </div>

              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setResetConfirmInput('');
                    setIsResetModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-rose-950/60 transition-all cursor-pointer hover:scale-105 active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Destroy All Data & Snapshots</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DATA EXPORT & FULL MIGRATION */}
      {activeTab === 'export' && hasPermission('ADMIN') && (
        <div className="space-y-6">
          {/* Master 1-Click All-in-One Export Hero */}
          <div className="p-6 bg-stone-900/90 border border-amber-500/40 rounded-2xl shadow-xl backdrop-blur-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                    Full ERP Data Migration
                  </span>
                  <span className="text-xs text-stone-400">• Multi-Tab Excel Workbook (.xlsx)</span>
                </div>
                <h3 className="font-serif font-bold text-lg text-stone-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                  <span>Master All-in-One Business Data Export</span>
                </h3>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Download 100% of your business data formatted into an editable Microsoft Excel (.xlsx) workbook with separate sheets for <strong>Customers</strong>, <strong>Products Catalog</strong>, <strong>Suppliers</strong>, <strong>Sales Invoices</strong>, <strong>Purchase Bills</strong>, <strong>Stock Ledger</strong>, <strong>Expenses</strong>, and <strong>Pricebooks</strong>. Perfect for complete migrations, offline accounting, or tax filing.
                </p>
              </div>

              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => downloadExportFile('/api/export/all', 'curated_art_complete_business_data.xlsx', token)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-lg shadow-amber-950/50 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Complete Master (.xlsx)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Module-by-Module Selective Exports Grid */}
          <div className="space-y-3">
            <div>
              <h4 className="font-serif font-bold text-base text-stone-100">
                Individual Module Exports (Excel & CSV)
              </h4>
              <p className="text-xs text-stone-400">
                Download any specific dataset individually for easy spreadsheet editing or importing into external accounting software.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Card 1: Customers */}
              <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-stone-100 font-semibold text-sm">
                    <Users className="w-4 h-4 text-amber-500" />
                    <span>Customers & Debtors</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Names, mobile numbers, addresses, GSTIN, PAN, state codes, and current ledger balances.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-stone-800/80">
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/customers?format=xlsx', 'CURATED_ART-Account_List.xlsx', token)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/customers?format=csv', 'CURATED_ART-Account_List.csv', token)}
                    className="py-1.5 px-2.5 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    CSV
                  </button>
                </div>
              </div>

              {/* Card 2: Products */}
              <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-stone-100 font-semibold text-sm">
                    <Package className="w-4 h-4 text-amber-500" />
                    <span>Products & Art Catalog</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Art piece titles, SKU, barcodes, categories, HSN codes, purchase cost, selling price, MRP, and stock.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-stone-800/80">
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/products?format=xlsx', 'curated_art_products.xlsx', token)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/products?format=csv', 'curated_art_products.csv', token)}
                    className="py-1.5 px-2.5 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    CSV
                  </button>
                </div>
              </div>

              {/* Card 3: Suppliers */}
              <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-stone-100 font-semibold text-sm">
                    <Truck className="w-4 h-4 text-amber-500" />
                    <span>Suppliers & Vendors</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Supplier contact directory, Moradabad/Khambhat addresses, GST numbers, and payable balances.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-stone-800/80">
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/suppliers?format=xlsx', 'curated_art_suppliers.xlsx', token)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/suppliers?format=csv', 'curated_art_suppliers.csv', token)}
                    className="py-1.5 px-2.5 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    CSV
                  </button>
                </div>
              </div>

              {/* Card 4: Sales Invoices */}
              <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-stone-100 font-semibold text-sm">
                    <Receipt className="w-4 h-4 text-amber-500" />
                    <span>Sales Invoices</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Complete invoice history, taxable values, CGST/SGST/IGST breakdown, payment modes, and grand totals.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-stone-800/80">
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/invoices?format=xlsx', 'curated_art_sales_invoices.xlsx', token)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/invoices?format=csv', 'curated_art_sales_invoices.csv', token)}
                    className="py-1.5 px-2.5 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    CSV
                  </button>
                </div>
              </div>

              {/* Card 5: Inward Purchase Bills */}
              <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-stone-100 font-semibold text-sm">
                    <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                    <span>Purchase Bills</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Vendor inward invoices, bill dates, taxes, paid amounts, and payment status.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-stone-800/80">
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/purchases?format=xlsx', 'curated_art_purchase_bills.xlsx', token)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/purchases?format=csv', 'curated_art_purchase_bills.csv', token)}
                    className="py-1.5 px-2.5 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    CSV
                  </button>
                </div>
              </div>

              {/* Card 6: Stock Movements Ledger */}
              <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-stone-100 font-semibold text-sm">
                    <Boxes className="w-4 h-4 text-amber-500" />
                    <span>Inventory & Stock Ledger</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Timestamped audit ledger of every inventory change (Sales, Purchases, Returns, Adjustments).
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-stone-800/80">
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/inventory?format=xlsx', 'curated_art_stock_movement_ledger.xlsx', token)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/inventory?format=csv', 'curated_art_stock_movement_ledger.csv', token)}
                    className="py-1.5 px-2.5 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    CSV
                  </button>
                </div>
              </div>

              {/* Card 7: Operating Expenses */}
              <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-stone-100 font-semibold text-sm">
                    <Tag className="w-4 h-4 text-amber-500" />
                    <span>Showroom Expenses</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Rent, electricity, staff salaries, packaging, freight, and showroom maintenance entries.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-stone-800/80">
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/expenses?format=xlsx', 'curated_art_expenses.xlsx', token)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/expenses?format=csv', 'curated_art_expenses.csv', token)}
                    className="py-1.5 px-2.5 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    CSV
                  </button>
                </div>
              </div>

              {/* Card 8: Chart of Accounts */}
              <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-stone-100 font-semibold text-sm">
                    <Landmark className="w-4 h-4 text-amber-500" />
                    <span>Chart of Accounts</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Bank accounts, cash on hand, loans, liabilities, capital, and operating expense ledger heads.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-stone-800/80">
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/general-accounts?format=xlsx', 'curated_art_chart_of_accounts.xlsx', token)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadExportFile('/api/export/general-accounts?format=csv', 'curated_art_chart_of_accounts.csv', token)}
                    className="py-1.5 px-2.5 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs font-semibold text-center transition-colors cursor-pointer"
                  >
                    CSV
                  </button>
                </div>
              </div>
            </div>
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

      {/* Danger Zone Nuclear Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-stone-900 border-2 border-rose-600/70 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-rose-100">
                    Permanently Destroy All ERP Data?
                  </h3>
                  <p className="text-[11px] text-rose-400 font-semibold uppercase tracking-wider">
                    Irreversible • No Recovery Possible
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isResetting && setIsResetModalOpen(false)}
                disabled={isResetting}
                className="p-1 text-stone-400 hover:text-stone-200 disabled:opacity-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-950/30 border border-rose-800/40 rounded-xl p-3.5 space-y-2 text-xs text-stone-300">
              <p className="font-bold text-rose-300">The following will be permanently wiped:</p>
              <ul className="list-disc list-inside space-y-1 text-stone-300 text-[11px]">
                <li>All Invoices, Estimates, Payments & Sales Returns</li>
                <li>All Products, Inventory Stock Movements & Catalog entries</li>
                <li>All Customers, Vendors, and General Accounts</li>
                <li>All Uploaded Product Images (<span className="font-mono text-stone-400">server/uploads/products/*</span>)</li>
                <li><strong>All Backup Snapshots & Vault Archives (<span className="font-mono text-stone-400">database/backups/*</span>)</strong></li>
                <li>SQLite zero-wipe & Vacuum to wipe free-list disk sectors</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-stone-300">
                To confirm permanent destruction, type <span className="font-mono font-bold text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/60">DESTROY ALL DATA</span> below:
              </label>
              <input
                type="text"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                disabled={isResetting}
                placeholder="DESTROY ALL DATA"
                className="w-full px-3.5 py-2.5 bg-stone-950 border border-rose-700/60 rounded-xl text-rose-200 font-mono text-sm tracking-wide focus:outline-none focus:border-rose-500 placeholder:text-stone-600"
                autoFocus
              />
            </div>

            <div className="pt-3 border-t border-stone-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="px-4 py-2.5 rounded-xl text-stone-400 hover:text-stone-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel & Keep Data
              </button>
              <button
                type="button"
                onClick={handleNuclearFactoryReset}
                disabled={resetConfirmInput !== 'DESTROY ALL DATA' || isResetting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-stone-800 disabled:text-stone-500 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isResetting ? 'Permanently Destroying...' : 'Confirm & Wipe Everything'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Reset Success Screen */}
      {resetSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-stone-900 border border-emerald-500/50 rounded-2xl w-full max-w-md p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-serif font-bold text-xl text-stone-100">
              Factory Reset Completed
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed">
              All database tables, uploaded files, and snapshot archives have been permanently destroyed. The ERP is reset to its initial factory clean state.
            </p>
            <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl text-left text-xs font-mono text-stone-300 space-y-1">
              <p className="text-stone-400 text-[10px] uppercase font-bold">Default Admin Login:</p>
              <p>Email: <span className="text-amber-400">admin@curatedart.in</span></p>
              <p>Password: <span className="text-amber-400">admin123</span></p>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('curated_art_token');
                window.location.href = '/';
              }}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Log in to Fresh System
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

