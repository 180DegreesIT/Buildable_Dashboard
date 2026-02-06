import { useState, useEffect } from 'react';
import {
  fetchCurrentTargets,
  type Target,
  TARGET_TYPE_LABELS,
  TARGET_TYPE_GROUPS,
  REGION_LABELS,
  ALL_REGIONS,
  type TargetType,
} from '../../lib/targetApi';
import PrintLayout from './PrintLayout';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtAUD(val: number | string | null): string {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num == null || isNaN(num)) return '\u2014';
  return num.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getTargetLabel(target: Target): string {
  if (target.targetType === 'team_revenue' && target.entity) {
    return REGION_LABELS[target.entity] ?? target.entity;
  }
  return TARGET_TYPE_LABELS[target.targetType] ?? target.targetType;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '11px' };
const thStyle: React.CSSProperties = {
  padding: '6px 10px', textAlign: 'left', fontSize: '10px',
  fontWeight: 600, color: '#6B7280', textTransform: 'uppercase',
  letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB',
};
const thRight: React.CSSProperties = { ...thStyle, textAlign: 'right' };
const tdStyle: React.CSSProperties = {
  padding: '5px 10px', borderBottom: '1px solid #F3F4F6', color: '#1A1A2E',
};
const tdRight: React.CSSProperties = { ...tdStyle, textAlign: 'right' };
const sectionTitle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: '#1A1A2E', margin: '20px 0 8px 0',
};
const cardStyle: React.CSSProperties = {
  border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px',
  backgroundColor: '#ffffff', marginBottom: '16px',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function PrintTargets({ weekEnding }: { weekEnding: string }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentTargets(weekEnding)
      .then((data) => {
        setTargets(data);
        setLoaded(true);
      })
      .catch((err) => {
        setError(err.message);
        setLoaded(true);
      });
  }, [weekEnding]);

  if (error) {
    return (
      <PrintLayout title="Target Management" weekEnding={weekEnding} ready={true}>
        <p style={{ color: '#D94F4F' }}>Error: {error}</p>
      </PrintLayout>
    );
  }

  if (!loaded) return null;

  // Group targets the same way as the regular page
  const grouped = TARGET_TYPE_GROUPS.map((group) => {
    const groupTargets: Target[] = [];
    for (const type of group.types) {
      if (type === 'team_revenue') {
        for (const region of ALL_REGIONS) {
          const t = targets.find((t) => t.targetType === 'team_revenue' && t.entity === region);
          if (t) groupTargets.push(t);
        }
      } else {
        const t = targets.find((t) => t.targetType === type as TargetType && !t.entity);
        if (t) groupTargets.push(t);
      }
    }
    return { ...group, targets: groupTargets };
  });

  return (
    <PrintLayout title="Target Management" weekEnding={weekEnding} ready={loaded}>
      {grouped.map((group) => (
        <div key={group.label} style={cardStyle}>
          <h3 style={{ ...sectionTitle, margin: '0 0 8px 0' }}>{group.label}</h3>
          {group.targets.length === 0 ? (
            <p style={{ fontSize: '11px', color: '#6B7280' }}>No targets set for this category.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Target</th>
                  <th style={thRight}>Amount (Weekly)</th>
                  <th style={thStyle}>Effective From</th>
                  <th style={thStyle}>Effective To</th>
                  <th style={thStyle}>Set By</th>
                  <th style={thStyle}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {group.targets.map((target) => (
                  <tr key={target.id}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{getTargetLabel(target)}</td>
                    <td style={{ ...tdRight, fontWeight: 600 }}>{fmtAUD(target.amount)}</td>
                    <td style={tdStyle}>{fmtDate(target.effectiveFrom)}</td>
                    <td style={tdStyle}>{fmtDate(target.effectiveTo)}</td>
                    <td style={tdStyle}>{target.setBy ?? '\u2014'}</td>
                    <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {target.notes ?? '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {targets.length === 0 && (
        <p style={{ fontSize: '12px', color: '#6B7280', textAlign: 'center', marginTop: '40px' }}>
          No targets have been configured for this week.
        </p>
      )}
    </PrintLayout>
  );
}
