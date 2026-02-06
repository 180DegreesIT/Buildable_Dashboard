import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../lib/SettingsContext';
import {
  fetchXeroStatus,
  connectXero,
  disconnectXero,
  triggerXeroSync,
  startXeroScheduler,
  stopXeroScheduler,
  type XeroStatus,
} from '../../lib/xeroApi';

// ─── Static Integration Cards (3CX, Reportei) ──────────────────────────────

interface StaticIntegrationCard {
  name: string;
  description: string;
  icon: React.ReactNode;
}

const STATIC_INTEGRATIONS: StaticIntegrationCard[] = [
  {
    name: '3CX',
    description: 'Phone system and call tracking',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    ),
  },
  {
    name: 'Reportei',
    description: 'Marketing and analytics reporting',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

// ─── Xero Icon ──────────────────────────────────────────────────────────────

const XeroIcon = (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
  </svg>
);

// ─── Helper: format date ────────────────────────────────────────────────────

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  // DD/MM/YYYY HH:mm (Australian format)
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

// ─── Spinner ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SystemStatus() {
  const { branding } = useSettings();

  const [xeroStatus, setXeroStatus] = useState<XeroStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await fetchXeroStatus();
      setXeroStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Xero status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ─── Xero Actions ─────────────────────────────────────────────────────

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      const result = await connectXero();
      if (result.url) {
        // In mock mode, the URL is a relative path (callback)
        // Call the callback URL directly via fetch to simulate the redirect
        if (result.url.startsWith('/api/')) {
          await fetch(result.url);
          await loadStatus();
        } else {
          // Real mode: redirect to Xero consent page
          window.location.href = result.url;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Xero');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setError(null);
      await disconnectXero();
      await loadStatus();
      setSyncMessage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect from Xero');
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSyncMessage(null);
      const result = await triggerXeroSync();
      setSyncMessage(
        `Sync complete: ${result.summary.succeeded}/${result.summary.total} succeeded`
      );
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSchedulerToggle = async () => {
    try {
      setError(null);
      if (xeroStatus?.schedulerRunning) {
        await stopXeroScheduler();
      } else {
        await startXeroScheduler();
      }
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle scheduler');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <section id="status" className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-[#1A1A2E] mb-1">System Status</h2>
      <p className="text-sm text-[#6B7280] mb-6">
        Integration connections and system health.
      </p>

      {/* Integration cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Xero Card - Interactive */}
        <div className={`border rounded-lg p-5 ${xeroStatus?.connected ? 'border-[#6AAF50]/30' : 'border-gray-200'}`}>
          <div className="flex items-start justify-between mb-3">
            <div className={xeroStatus?.connected ? 'text-[#4573D2]' : 'text-gray-300'}>
              {XeroIcon}
            </div>
            {loading ? (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                Loading...
              </span>
            ) : xeroStatus?.connected ? (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-[#6AAF50]">
                {xeroStatus.mockMode ? 'Connected (Mock)' : 'Connected'}
              </span>
            ) : (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                Not Connected
              </span>
            )}
          </div>

          <h3 className={`text-sm font-semibold mb-1 ${xeroStatus?.connected ? 'text-[#1A1A2E]' : 'text-gray-400'}`}>
            Xero
          </h3>
          <p className="text-xs text-[#6B7280] mb-1">Accounting and financial data sync</p>

          {/* Connection details */}
          {xeroStatus?.connected && (
            <div className="text-xs text-[#6B7280] mb-3 space-y-0.5">
              {xeroStatus.tenantName && (
                <p>Organisation: <span className="font-medium text-[#1A1A2E]">{xeroStatus.tenantName}</span></p>
              )}
              <p>Last sync: <span className="font-medium">{formatDateTime(xeroStatus.lastSyncAt)}</span></p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-xs text-[#D94F4F] mb-2">{error}</p>
          )}

          {/* Sync success message */}
          {syncMessage && (
            <p className="text-xs text-[#6AAF50] mb-2">{syncMessage}</p>
          )}

          {/* Action buttons */}
          <div className="mt-3 space-y-2">
            {!xeroStatus?.connected ? (
              <button
                type="button"
                onClick={handleConnect}
                disabled={loading || connecting}
                className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-[#4573D2] text-white hover:bg-[#3a63b8] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {connecting ? <><Spinner /> Connecting...</> : 'Connect to Xero'}
              </button>
            ) : (
              <>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#4573D2] text-white hover:bg-[#3a63b8] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    {syncing ? <><Spinner /> Syncing...</> : 'Sync Now'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-[#6B7280] hover:bg-gray-50"
                  >
                    Disconnect
                  </button>
                </div>

                {/* Scheduler toggle */}
                <button
                  type="button"
                  onClick={handleSchedulerToggle}
                  className={`w-full px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 ${
                    xeroStatus?.schedulerRunning
                      ? 'bg-[#6AAF50]/10 text-[#6AAF50] hover:bg-[#6AAF50]/20'
                      : 'bg-gray-50 text-[#6B7280] hover:bg-gray-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    xeroStatus?.schedulerRunning ? 'bg-[#6AAF50]' : 'bg-gray-300'
                  }`} />
                  {xeroStatus?.schedulerRunning ? 'Auto-sync On (Daily 6am)' : 'Enable Auto-sync'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* 3CX and Reportei - Static/Disabled */}
        {STATIC_INTEGRATIONS.map((integration) => (
          <div
            key={integration.name}
            className="border border-gray-200 rounded-lg p-5 opacity-60"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-gray-300">{integration.icon}</div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                Not Connected
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-400 mb-1">{integration.name}</h3>
            <p className="text-xs text-gray-400">{integration.description}</p>
            <button
              type="button"
              disabled
              className="mt-4 w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
            >
              Configure
            </button>
          </div>
        ))}
      </div>

      {/* Backup status card */}
      <div className="border border-gray-200 rounded-lg p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-gray-300">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1A1A2E]">Backup Status</h3>
              <p className="text-xs text-[#6B7280] mt-0.5">No backup configured</p>
            </div>
          </div>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
            Informational
          </span>
        </div>
      </div>
    </section>
  );
}
