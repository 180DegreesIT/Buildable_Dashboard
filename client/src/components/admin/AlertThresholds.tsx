import { useState, useEffect } from 'react';
import { useSettings } from '../../lib/SettingsContext';
import { updateAlertThresholds, type AlertThreshold } from '../../lib/settingsApi';

const DEFAULT_THRESHOLDS: AlertThreshold[] = [
  {
    metric: 'net_profit',
    label: 'Net Profit Below Budget',
    direction: 'below',
    warningValue: 80,
    criticalValue: 50,
    unit: 'percentage',
  },
  {
    metric: 'team_revenue_performance',
    label: 'Team Revenue Performance',
    direction: 'below',
    warningValue: 70,
    criticalValue: 50,
    unit: 'percentage',
  },
  {
    metric: 'cash_position',
    label: 'Cash Approaching Overdraft',
    direction: 'below',
    warningValue: 50000,
    criticalValue: 20000,
    unit: 'currency',
  },
];

function formatValue(value: number, unit: 'currency' | 'percentage'): string {
  if (unit === 'currency') {
    return `$${value.toLocaleString('en-AU')}`;
  }
  return `${value}%`;
}

function getSliderMax(threshold: AlertThreshold): number {
  if (threshold.unit === 'currency') return 200000;
  return 100;
}

function getSliderStep(threshold: AlertThreshold): number {
  if (threshold.unit === 'currency') return 1000;
  return 1;
}

interface ThresholdCardProps {
  threshold: AlertThreshold;
  onChange: (updated: AlertThreshold) => void;
}

function ThresholdCard({ threshold, onChange }: ThresholdCardProps) {
  const max = getSliderMax(threshold);
  const step = getSliderStep(threshold);

  // For "below" direction: green is high (right), red is low (left)
  // warningValue should be > criticalValue
  // For "above" direction: green is low (left), red is high (right)
  // warningValue should be < criticalValue

  const handleWarningChange = (value: number) => {
    if (threshold.direction === 'below') {
      // Warning must be >= critical
      onChange({ ...threshold, warningValue: Math.max(value, threshold.criticalValue) });
    } else {
      // Warning must be <= critical
      onChange({ ...threshold, warningValue: Math.min(value, threshold.criticalValue) });
    }
  };

  const handleCriticalChange = (value: number) => {
    if (threshold.direction === 'below') {
      // Critical must be <= warning
      onChange({ ...threshold, criticalValue: Math.min(value, threshold.warningValue) });
    } else {
      // Critical must be >= warning
      onChange({ ...threshold, criticalValue: Math.max(value, threshold.warningValue) });
    }
  };

  // Calculate colour zone percentages for the visual bar
  const warningPct = (threshold.warningValue / max) * 100;
  const criticalPct = (threshold.criticalValue / max) * 100;

  let greenStart: number, greenEnd: number;
  let amberStart: number, amberEnd: number;
  let redStart: number, redEnd: number;

  if (threshold.direction === 'below') {
    // Red on left (0 to critical), amber in middle (critical to warning), green on right (warning to max)
    redStart = 0;
    redEnd = criticalPct;
    amberStart = criticalPct;
    amberEnd = warningPct;
    greenStart = warningPct;
    greenEnd = 100;
  } else {
    // Green on left (0 to warning), amber in middle (warning to critical), red on right (critical to max)
    greenStart = 0;
    greenEnd = warningPct;
    amberStart = warningPct;
    amberEnd = criticalPct;
    redStart = criticalPct;
    redEnd = 100;
  }

  return (
    <div className="border border-gray-200 rounded-lg p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-[#1A1A2E]">{threshold.label}</h4>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Alert when {threshold.direction} threshold
          </p>
        </div>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
          {threshold.direction}
        </span>
      </div>

      {/* Colour zone bar */}
      <div className="h-3 rounded-full overflow-hidden flex mb-6" style={{ background: '#f3f4f6' }}>
        <div
          style={{
            width: `${redEnd - redStart}%`,
            marginLeft: `${redStart}%`,
            background: '#D94F4F',
          }}
          className="h-full"
        />
        <div
          style={{
            width: `${amberEnd - amberStart}%`,
            background: '#E8A442',
          }}
          className="h-full"
        />
        <div
          style={{
            width: `${greenEnd - greenStart}%`,
            background: '#6AAF50',
          }}
          className="h-full"
        />
      </div>

      {/* Warning threshold */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-[#E8A442] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E8A442]" />
            Warning Level
          </label>
          <div className="flex items-center gap-1">
            {threshold.unit === 'currency' && <span className="text-xs text-gray-400">$</span>}
            <input
              type="number"
              value={threshold.warningValue}
              onChange={(e) => handleWarningChange(Number(e.target.value))}
              min={0}
              max={max}
              step={step}
              className="w-24 px-2 py-1 border border-gray-200 rounded text-xs text-right font-mono text-[#1A1A2E] focus:border-[#E8A442] focus:ring-1 focus:ring-[#E8A442]/20"
            />
            {threshold.unit === 'percentage' && <span className="text-xs text-gray-400">%</span>}
          </div>
        </div>
        <input
          type="range"
          value={threshold.warningValue}
          onChange={(e) => handleWarningChange(Number(e.target.value))}
          min={0}
          max={max}
          step={step}
          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#E8A442]"
          style={{ background: `linear-gradient(to right, #E8A442 0%, #E8A442 ${warningPct}%, #e5e7eb ${warningPct}%, #e5e7eb 100%)` }}
        />
      </div>

      {/* Critical threshold */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-[#D94F4F] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D94F4F]" />
            Critical Level
          </label>
          <div className="flex items-center gap-1">
            {threshold.unit === 'currency' && <span className="text-xs text-gray-400">$</span>}
            <input
              type="number"
              value={threshold.criticalValue}
              onChange={(e) => handleCriticalChange(Number(e.target.value))}
              min={0}
              max={max}
              step={step}
              className="w-24 px-2 py-1 border border-gray-200 rounded text-xs text-right font-mono text-[#1A1A2E] focus:border-[#D94F4F] focus:ring-1 focus:ring-[#D94F4F]/20"
            />
            {threshold.unit === 'percentage' && <span className="text-xs text-gray-400">%</span>}
          </div>
        </div>
        <input
          type="range"
          value={threshold.criticalValue}
          onChange={(e) => handleCriticalChange(Number(e.target.value))}
          min={0}
          max={max}
          step={step}
          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#D94F4F]"
          style={{ background: `linear-gradient(to right, #D94F4F 0%, #D94F4F ${criticalPct}%, #e5e7eb ${criticalPct}%, #e5e7eb 100%)` }}
        />
      </div>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-[#6B7280]">
        <span>
          Warning: {formatValue(threshold.warningValue, threshold.unit)}
        </span>
        <span>
          Critical: {formatValue(threshold.criticalValue, threshold.unit)}
        </span>
      </div>
    </div>
  );
}

export default function AlertThresholds() {
  const { alertThresholds, refreshSettings } = useSettings();

  const [thresholds, setThresholds] = useState<AlertThreshold[]>(
    alertThresholds.length > 0 ? alertThresholds : DEFAULT_THRESHOLDS
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Update local state when context loads
  useEffect(() => {
    if (alertThresholds.length > 0) {
      setThresholds(alertThresholds);
    }
  }, [alertThresholds]);

  const handleThresholdChange = (index: number, updated: AlertThreshold) => {
    const next = [...thresholds];
    next[index] = updated;
    setThresholds(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await updateAlertThresholds(thresholds);
      await refreshSettings();
      setMessage({ type: 'success', text: 'Alert thresholds saved successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save alert thresholds' });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(thresholds) !== JSON.stringify(
    alertThresholds.length > 0 ? alertThresholds : DEFAULT_THRESHOLDS
  );

  return (
    <section id="alerts" className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-[#1A1A2E] mb-1">Alert Thresholds</h2>
      <p className="text-sm text-[#6B7280] mb-6">
        Configure warning and critical thresholds for key business metrics. KPI cards will change colour when thresholds are breached.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {thresholds.map((threshold, index) => (
          <ThresholdCard
            key={threshold.metric}
            threshold={threshold}
            onChange={(updated) => handleThresholdChange(index, updated)}
          />
        ))}
      </div>

      {/* Save button and status */}
      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            saving || !hasChanges
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-[#4573D2] text-white hover:bg-[#3b62b5]'
          }`}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {message && (
          <p className={`text-sm font-medium ${message.type === 'success' ? 'text-[#6AAF50]' : 'text-[#D94F4F]'}`}>
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
