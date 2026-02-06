import { useSettings } from '../../lib/SettingsContext';

interface IntegrationCard {
  name: string;
  description: string;
  icon: React.ReactNode;
}

const INTEGRATIONS: IntegrationCard[] = [
  {
    name: 'Xero',
    description: 'Accounting and financial data sync',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
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

export default function SystemStatus() {
  const { branding } = useSettings();

  // Read backup status from settings (informational only)
  // Currently just shows "No backup configured"

  return (
    <section id="status" className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-[#1A1A2E] mb-1">System Status</h2>
      <p className="text-sm text-[#6B7280] mb-6">
        Integration connections and system health. These will be configured in future phases.
      </p>

      {/* Integration cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {INTEGRATIONS.map((integration) => (
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
