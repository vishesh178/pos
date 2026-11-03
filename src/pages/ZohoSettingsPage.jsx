import React, { useState, useEffect } from 'react';
import {
  CloudSync,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Layers,
  Key,
  Building2,
  Eye,
  X,
  Play,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ZohoSettingsPage() {
  const { token, hasPermission } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // Status & Test Connection
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);

  // Sync Jobs Queue
  const [jobs, setJobs] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedJob, setSelectedJob] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resConfig, resJobs] = await Promise.all([
        fetch('/api/zoho/config', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/zoho/jobs?status=${filterStatus}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [dataConfig, dataJobs] = await Promise.all([resConfig.json(), resJobs.json()]);

      setConfig(dataConfig);
      setClientId(dataConfig.clientId || '');
      setOrganizationId(dataConfig.organizationId || '');
      setAutoSyncEnabled(dataConfig.autoSyncEnabled ?? true);

      setJobs(dataJobs.jobs || []);
      setStatusCounts(dataJobs.statusCounts || {});
    } catch (err) {
      console.error('Failed to load Zoho data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'ZOHO_AUTH_SUCCESS') {
        loadData();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/zoho/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clientId,
          clientSecret: clientSecret || undefined,
          organizationId,
          autoSyncEnabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      alert('Zoho settings updated and credentials encrypted.');
      setClientSecret('');
      loadData();
    } catch (err) {
      alert('Save error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConnectOAuth = async () => {
    try {
      // Auto-save updated clientId or organizationId if modified
      if (clientId && (clientId !== config?.clientId || organizationId !== config?.organizationId)) {
        await fetch('/api/zoho/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            clientId,
            clientSecret: clientSecret || undefined,
            organizationId,
            autoSyncEnabled,
          }),
        });
      }

      const res = await fetch('/api/zoho/auth-url', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate authorization URL');

      const popup = window.open(data.url, '_blank', 'width=650,height=750');
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.location.href = data.url;
      }
    } catch (err) {
      alert('OAuth Error: ' + err.message);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/zoho/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncingNow(true);
    try {
      const res = await fetch('/api/zoho/sync-now', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      alert(`Sync pass completed: ${JSON.stringify(data.outcome)}`);
      loadData();
    } catch (err) {
      alert('Sync failed: ' + err.message);
    } finally {
      setSyncingNow(false);
    }
  };

  const handleRetryJob = async (jobId) => {
    try {
      await fetch(`/api/zoho/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRetryAll = async () => {
    try {
      const res = await fetch('/api/zoho/jobs/retry-all-failed', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      alert(data.message);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-serif text-stone-100 flex items-center gap-2">
            <CloudSync className="w-6 h-6 text-amber-500" />
            <span>Zoho Inventory & Books Cloud Integration</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Indian Data Center (accounts.zoho.in) • Resilient offline-first transactional outbox
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncNow}
            disabled={syncingNow}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-amber-400 text-xs font-semibold"
          >
            <Play className="w-3.5 h-3.5 text-amber-500" />
            <span>{syncingNow ? 'Syncing...' : 'Trigger Sync Now'}</span>
          </button>

          <button
            onClick={handleRetryAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-stone-100 text-xs font-semibold"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Retry Failed Jobs</span>
          </button>
        </div>
      </div>

      {/* Connection Status & Security Guard Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              config?.isConnected ? 'bg-emerald-950 text-emerald-400' : 'bg-stone-800 text-stone-400'
            }`}
          >
            {config?.isConnected ? <CheckCircle2 className="w-5 h-5" /> : <CloudSync className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-xs font-bold text-stone-100">
              {config?.isConnected ? 'Zoho Connected' : 'Not Connected'}
            </p>
            <p className="text-[10px] text-stone-400">
              Data Center: <span className="font-mono text-amber-400">IN (India DC)</span>
            </p>
          </div>
        </div>

        <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="truncate">
            <p className="text-xs font-bold text-stone-100 truncate">
              {config?.organizationId || 'No Org ID Set'}
            </p>
            <p className="text-[10px] text-stone-400">Active Books / Inventory Organization</p>
          </div>
        </div>

        <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-950 text-teal-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-stone-100">Encrypted Local Vault</p>
            <p className="text-[10px] text-stone-400">AES-256-GCM tokens hidden from client</p>
          </div>
        </div>
      </div>

      {/* OAuth Credentials Configuration (Admin Only) */}
      {hasPermission('ADMIN') && (
        <form onSubmit={handleSaveConfig} className="p-6 bg-stone-900 border border-stone-800 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-800">
            <div>
              <h3 className="font-serif font-bold text-base text-stone-100">
                Zoho API OAuth 2.0 Credentials
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Obtain from <a href="https://api-console.zoho.in" target="_blank" rel="noreferrer" className="text-amber-500 underline">Zoho API Console (India)</a>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>

              <button
                type="button"
                onClick={handleConnectOAuth}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                <span>Authorize OAuth 2.0</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800 text-rose-300'
              }`}
            >
              {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{testResult.message || testResult.error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-stone-300 mb-1">Zoho Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="1000.XXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-300 mb-1">
                Zoho Client Secret {config?.hasClientSecret && <span className="text-emerald-400 font-normal">(Encrypted Vault Saved)</span>}
              </label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={config?.hasClientSecret ? '••••••••••••••••••••••••••••••••' : 'Enter client secret'}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-stone-300 mb-1">Zoho Organization ID</label>
              <input
                type="text"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                placeholder="e.g. 60012345678"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="auto-sync"
                checked={autoSyncEnabled}
                onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 bg-stone-950 border-stone-700"
              />
              <label htmlFor="auto-sync" className="font-semibold text-stone-200 cursor-pointer">
                Enable Automatic Background Outbox Sync (every 30s)
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      )}

      {/* Outbox Queue Monitoring Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif font-bold text-sm text-stone-100">
              Transactional Outbox Queue (`SyncJob`)
            </h3>
            <p className="text-xs text-stone-400">
              Queue of invoices, catalog items, and stock movements synchronizing with Zoho
            </p>
          </div>

          {/* Queue Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs bg-stone-950 p-1 rounded-xl border border-stone-800">
            {['all', 'PENDING', 'SYNCED', 'FAILED', 'RETRY_SCHEDULED'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  filterStatus === s
                    ? 'bg-amber-500 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {s === 'all' ? `All (${jobs.length})` : s}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-4 py-3">Entity Type</th>
                <th className="px-4 py-3">Operation</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Retries</th>
                <th className="px-4 py-3">Error / Note</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800 text-stone-300">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-stone-400 font-sans">
                    No sync jobs matching filter.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-stone-800/40 font-mono">
                    <td className="px-5 py-3 text-[11px] text-stone-400">
                      {new Date(job.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-stone-800 text-amber-400 font-bold text-[10px]">
                        {job.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-300 text-[11px] font-semibold">{job.operation}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          job.status === 'SYNCED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : job.status === 'FAILED'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold">{job.retryCount}/{job.maxRetries}</td>
                    <td className="px-4 py-3 font-sans text-[11px] text-stone-400 max-w-xs truncate">
                      {job.errorMessage || (job.zohoRecordId ? `Synced ID: ${job.zohoRecordId}` : '—')}
                    </td>
                    <td className="px-5 py-3 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedJob(job)}
                          title="View Payload"
                          className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {(job.status === 'FAILED' || job.status === 'RETRY_SCHEDULED') && (
                          <button
                            onClick={() => handleRetryJob(job.id)}
                            className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-[10px]"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payload Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-serif font-bold text-sm text-stone-100">
                Sync Job Payload: {selectedJob.entityType} ({selectedJob.operation})
              </h3>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 text-stone-400 hover:text-stone-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="mt-4 p-3 bg-stone-950 border border-stone-800 rounded-xl font-mono text-[11px] text-amber-400 overflow-x-auto max-h-72">
              {JSON.stringify(JSON.parse(selectedJob.payload || '{}'), null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

