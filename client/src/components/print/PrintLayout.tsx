import { useSettings } from '../../lib/SettingsContext';

interface PrintLayoutProps {
  title: string;
  weekEnding: string;
  ready: boolean;
  children: React.ReactNode;
}

function formatDateAU(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PrintLayout({ title, weekEnding, ready, children }: PrintLayoutProps) {
  const { branding } = useSettings();

  return (
    <div
      data-print-ready={ready ? 'true' : 'false'}
      style={{
        backgroundColor: '#ffffff',
        minHeight: '100vh',
        padding: '24px 32px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        color: '#1A1A2E',
        /* Print-optimised: no scrollbars, no transitions */
        overflow: 'visible',
      }}
    >
      {/* ── Print Styles ── */}
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { margin: 0; padding: 0; }
        }
        /* Disable all animations and transitions in print mode */
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
        }
        /* Hide scrollbars */
        ::-webkit-scrollbar { display: none; }
        * { scrollbar-width: none; }
        /* No hover effects */
        *:hover { opacity: 1 !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        borderBottom: '2px solid #4573D2',
        paddingBottom: '12px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
      }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#1A1A2E' }}>
            {title}
          </h1>
          <p style={{ fontSize: '12px', color: '#6B7280', margin: '4px 0 0 0' }}>
            {branding.companyName || 'Buildable Approvals'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
            Week ending: {formatDateAU(weekEnding)}
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      {children}
    </div>
  );
}
