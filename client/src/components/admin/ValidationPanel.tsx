import { useState, useCallback } from 'react';
import {
  runFullValidation,
  runDataValidation,
  runBenchmark,
  type FullValidationResult,
  type ValidationCheck,
  type RoundTripField,
  type TargetWorkflowStep,
  type PageBenchmark,
  type CategorySummary,
} from '../../lib/validationApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAUD(val: number | null | undefined): string {
  if (val == null) return '--';
  return val.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function StatusBadge({ passed }: { passed: boolean }) {
  return passed ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
      PASS
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
      FAIL
    </span>
  );
}

function SummaryBar({ result }: { result: FullValidationResult }) {
  const { dataValidation, csvRoundTrip, targetWorkflow, performance } = result;
  const perfPassed = performance.pages.filter((p) => p.passed).length;

  return (
    <div
      className={`rounded-lg px-4 py-3 text-sm font-medium ${
        result.overallPassed
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-red-50 text-red-800 border border-red-200'
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Data: {dataValidation.passed}/{dataValidation.totalChecks} checks
        </span>
        <span className="text-gray-300">|</span>
        <span>CSV: {csvRoundTrip.allPassed ? 'PASS' : 'FAIL'}</span>
        <span className="text-gray-300">|</span>
        <span>Targets: {targetWorkflow.allPassed ? 'PASS' : 'FAIL'}</span>
        <span className="text-gray-300">|</span>
        <span>
          Performance: {perfPassed}/{performance.pages.length} pages &lt; 2s
        </span>
      </div>
    </div>
  );
}

// ─── Data Validation Section ──────────────────────────────────────────────────

function DataValidationSection({ checks, summary }: { checks: ValidationCheck[]; summary: Record<string, CategorySummary> }) {
  // Group checks by category
  const categories = Object.entries(summary);

  return (
    <div>
      <h4 className="text-sm font-semibold text-[#1A1A2E] mb-3">Data Validation</h4>

      {/* Category summary chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map(([cat, s]) => (
          <span
            key={cat}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              s.failed === 0
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {cat}: {s.passed}/{s.total}
          </span>
        ))}
      </div>

      {/* Detail table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Check ID</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Category</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Week</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Field</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Expected</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Actual</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Diff</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {checks.map((check) => (
              <tr
                key={check.id}
                className={check.passed ? '' : 'bg-red-50'}
              >
                <td className="px-3 py-2 text-[#6B7280] text-xs font-mono">{check.id}</td>
                <td className="px-3 py-2 text-[#1A1A2E]">{check.category}</td>
                <td className="px-3 py-2 text-[#6B7280]">{check.weekEnding}</td>
                <td className="px-3 py-2 text-[#1A1A2E] font-medium">{check.field}</td>
                <td className="px-3 py-2 text-right text-[#6B7280]">{fmtAUD(check.expected)}</td>
                <td className="px-3 py-2 text-right text-[#1A1A2E]">
                  {check.actual !== null ? fmtAUD(check.actual) : <span className="text-[#D94F4F]">null</span>}
                </td>
                <td className={`px-3 py-2 text-right ${check.difference !== 0 ? 'text-[#D94F4F] font-medium' : 'text-[#6B7280]'}`}>
                  {check.difference !== 0 ? fmtAUD(check.difference) : '--'}
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusBadge passed={check.passed} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── CSV Round-Trip Section ──────────────────────────────────────────────────

function CsvRoundTripSection({ fields, allPassed, weekEnding, error }: { fields: RoundTripField[]; allPassed: boolean; weekEnding: string; error?: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-[#1A1A2E] mb-3">CSV Round-Trip</h4>

      <div className={`rounded-lg border p-4 ${allPassed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex items-center gap-2 mb-2">
          <StatusBadge passed={allPassed} />
          <span className="text-sm text-[#1A1A2E] font-medium">
            {allPassed ? 'All numeric values survive CSV export/reimport' : 'Some values lost precision during round-trip'}
          </span>
        </div>
        <p className="text-xs text-[#6B7280]">Week: {weekEnding}</p>
        {error && <p className="text-xs text-[#D94F4F] mt-1">{error}</p>}
      </div>

      {fields.length > 0 && !allPassed && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-[#6B7280]">Field</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-[#6B7280]">Original</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-[#6B7280]">Exported</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-[#6B7280]">Reimported</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-[#6B7280]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fields.map((f) => (
                <tr key={f.field} className={f.passed ? '' : 'bg-red-50'}>
                  <td className="px-3 py-2 text-[#1A1A2E] font-medium">{f.field}</td>
                  <td className="px-3 py-2 text-right text-[#6B7280]">{fmtAUD(f.original)}</td>
                  <td className="px-3 py-2 text-right text-[#6B7280] font-mono text-xs">{f.exported}</td>
                  <td className="px-3 py-2 text-right text-[#1A1A2E]">{fmtAUD(f.reimported)}</td>
                  <td className="px-3 py-2 text-center"><StatusBadge passed={f.passed} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Target Workflow Section ──────────────────────────────────────────────────

function TargetWorkflowSection({ steps, allPassed }: { steps: TargetWorkflowStep[]; allPassed: boolean }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-[#1A1A2E] mb-3">Target Workflow</h4>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
              step.passed ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="mt-0.5">
              {step.passed ? (
                <svg className="w-4 h-4 text-[#6AAF50]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-[#D94F4F]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-[#1A1A2E]">
                Step {i + 1}: {step.step}
              </p>
              <p className="text-xs text-[#6B7280] mt-0.5">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Performance Section ─────────────────────────────────────────────────────

function PerformanceSection({ pages, allPassed }: { pages: PageBenchmark[]; allPassed: boolean }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-[#1A1A2E] mb-3">Performance (Warm Load)</h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pages.map((page) => {
          const pct = Math.min((page.loadTimeMs / page.target) * 100, 100);
          const barColour = page.passed ? 'bg-[#6AAF50]' : 'bg-[#D94F4F]';

          return (
            <div
              key={page.page}
              className={`rounded-lg border p-4 ${
                page.passed ? 'border-green-200' : 'border-red-200 bg-red-50/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#1A1A2E]">{page.page}</span>
                <StatusBadge passed={page.passed} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColour}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-sm font-semibold ${page.passed ? 'text-[#6AAF50]' : 'text-[#D94F4F]'}`}>
                  {fmtMs(page.loadTimeMs)}
                </span>
              </div>
              <p className="text-xs text-[#6B7280] mt-1">
                Target: {fmtMs(page.target)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Active Tab Type ──────────────────────────────────────────────────────────

type ActiveSection = 'data' | 'csv' | 'targets' | 'performance';

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ValidationPanel() {
  const [result, setResult] = useState<FullValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>('data');

  const handleRunFull = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await runFullValidation();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRunData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await runDataValidation();
      setResult((prev) =>
        prev
          ? { ...prev, dataValidation: data }
          : null
      );
      if (!result) {
        // If no previous result, show just data validation in a partial result
        setResult({
          dataValidation: data,
          csvRoundTrip: { weekEnding: '', fields: [], allPassed: true },
          targetWorkflow: { steps: [], allPassed: true },
          performance: { runAt: '', allPassed: true, pages: [] },
          overallPassed: data.failed === 0,
          summary: `Data: ${data.passed}/${data.totalChecks}`,
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [result]);

  const handleRunPerf = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await runBenchmark();
      setResult((prev) =>
        prev
          ? { ...prev, performance: data }
          : null
      );
      if (!result) {
        setResult({
          dataValidation: { runAt: '', duration: 0, totalChecks: 0, passed: 0, failed: 0, checks: [], summary: { byCategory: {}, byWeek: {} } },
          csvRoundTrip: { weekEnding: '', fields: [], allPassed: true },
          targetWorkflow: { steps: [], allPassed: true },
          performance: data,
          overallPassed: data.allPassed,
          summary: `Perf: ${data.pages.filter((p) => p.passed).length}/${data.pages.length}`,
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [result]);

  const sectionTabs: { key: ActiveSection; label: string }[] = [
    { key: 'data', label: 'Data Validation' },
    { key: 'csv', label: 'CSV Round-Trip' },
    { key: 'targets', label: 'Target Workflow' },
    { key: 'performance', label: 'Performance' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#1A1A2E]">System Validation</h3>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Verify data accuracy, CSV integrity, target workflow, and page performance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunData}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium text-[#6B7280] bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Run Data Only
            </button>
            <button
              onClick={handleRunPerf}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium text-[#6B7280] bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Run Performance Only
            </button>
            <button
              onClick={handleRunFull}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-[#4573D2] rounded-lg hover:bg-[#3A62B5] transition-colors disabled:opacity-50"
            >
              {loading ? 'Running...' : 'Run Full Validation'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-[#4573D2] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm text-[#6B7280]">Running validation... this may take 15-30 seconds.</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-4">
            <p className="text-sm text-[#D94F4F] font-medium">Validation error</p>
            <p className="text-xs text-[#D94F4F] mt-1">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[#6B7280]">
              Click &quot;Run Full Validation&quot; to verify system accuracy and performance.
            </p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-6">
            {/* Summary bar */}
            <SummaryBar result={result} />

            {/* Section tabs */}
            <div className="flex items-center gap-1 border-b border-gray-200 pb-0">
              {sectionTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveSection(tab.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeSection === tab.key
                      ? 'border-[#4573D2] text-[#4573D2]'
                      : 'border-transparent text-[#6B7280] hover:text-[#1A1A2E] hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Active section content */}
            <div className="pt-2">
              {activeSection === 'data' && (
                <DataValidationSection
                  checks={result.dataValidation.checks}
                  summary={result.dataValidation.summary.byCategory}
                />
              )}

              {activeSection === 'csv' && (
                <CsvRoundTripSection
                  fields={result.csvRoundTrip.fields}
                  allPassed={result.csvRoundTrip.allPassed}
                  weekEnding={result.csvRoundTrip.weekEnding}
                  error={result.csvRoundTrip.error}
                />
              )}

              {activeSection === 'targets' && (
                <TargetWorkflowSection
                  steps={result.targetWorkflow.steps}
                  allPassed={result.targetWorkflow.allPassed}
                />
              )}

              {activeSection === 'performance' && (
                <PerformanceSection
                  pages={result.performance.pages}
                  allPassed={result.performance.allPassed}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
