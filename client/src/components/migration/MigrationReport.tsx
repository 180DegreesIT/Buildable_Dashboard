/**
 * MigrationReport — Final summary report after migration completes.
 *
 * Shows success banner, per-table breakdown, warnings list,
 * and a downloadable warning report.
 */
import type { MigrationResult } from '../../lib/migrationApi';

interface Props {
  result: MigrationResult;
  allWarnings: string[];
  onReset: () => void;
}

export default function MigrationReport({ result, allWarnings, onReset }: Props) {
  function downloadWarnings() {
    const lines = [
      'Buildable Dashboard — Excel Migration Warning Report',
      `Generated: ${new Date().toLocaleDateString('en-AU')}`,
      `Total Warnings: ${allWarnings.length}`,
      '',
      '─'.repeat(60),
      '',
      ...allWarnings.map((w, i) => `${i + 1}. ${w}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration-warnings-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Success banner */}
      <div className="bg-[#6AAF50]/5 border border-[#6AAF50]/20 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-[#6AAF50]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-[#6AAF50]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#1A1A2E]">Migration Complete</h2>
            <p className="text-[#6B7280] text-sm mt-1">
              Successfully processed{' '}
              <span className="font-medium text-[#6AAF50]">{result.totalInserted.toLocaleString()}</span> new records
              {result.totalUpdated > 0 && (
                <> and updated <span className="font-medium text-[#4573D2]">{result.totalUpdated.toLocaleString()}</span> existing records</>
              )}.
            </p>
          </div>
        </div>
      </div>

      {/* Per-table breakdown */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Table Breakdown</h3>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2.5 font-medium text-[#6B7280]">Table</th>
                <th className="px-4 py-2.5 font-medium text-[#6B7280] text-right">Inserted</th>
                <th className="px-4 py-2.5 font-medium text-[#6B7280] text-right">Updated</th>
                <th className="px-4 py-2.5 font-medium text-[#6B7280] text-right">Warnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.tables.map((table) => (
                <tr
                  key={table.tableName}
                  className={table.warnings.length > 0 ? 'bg-[#E8A442]/5' : ''}
                >
                  <td className="px-4 py-2.5 text-[#1A1A2E] font-medium">{table.tableName}</td>
                  <td className="px-4 py-2.5 text-right text-[#6AAF50] font-medium">
                    {table.inserted.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[#4573D2] font-medium">
                    {table.updated.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {table.warnings.length > 0 ? (
                      <span className="bg-[#E8A442]/10 text-[#E8A442] text-xs font-medium px-2 py-0.5 rounded-full">
                        {table.warnings.length}
                      </span>
                    ) : (
                      <span className="text-[#6B7280] text-xs">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-2.5 text-[#1A1A2E]">Total</td>
                <td className="px-4 py-2.5 text-right text-[#6AAF50]">
                  {result.totalInserted.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right text-[#4573D2]">
                  {result.totalUpdated.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {result.totalWarnings > 0 ? (
                    <span className="bg-[#E8A442]/10 text-[#E8A442] text-xs font-medium px-2 py-0.5 rounded-full">
                      {result.totalWarnings}
                    </span>
                  ) : (
                    <span className="text-[#6B7280] text-xs">0</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Warnings section */}
      {allWarnings.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#1A1A2E] flex items-center gap-2">
              Warnings
              <span className="bg-[#E8A442]/10 text-[#E8A442] text-xs font-medium px-2 py-0.5 rounded-full">
                {allWarnings.length.toLocaleString()}
              </span>
            </h3>
            <button
              onClick={downloadWarnings}
              className="text-[#4573D2] text-xs font-medium hover:underline flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Full Warning Report
            </button>
          </div>
          <ul className="space-y-1.5 max-h-64 overflow-y-auto">
            {allWarnings.slice(0, 20).map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <svg className="w-3.5 h-3.5 text-[#E8A442] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[#6B7280]">{w}</span>
              </li>
            ))}
          </ul>
          {allWarnings.length > 20 && (
            <p className="text-xs text-[#6B7280] mt-2">
              Showing first 20 of {allWarnings.length.toLocaleString()} warnings.
              Download the full report for all warnings.
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex items-center justify-between">
        <p className="text-xs text-[#6B7280]">
          This migration is idempotent — you can safely re-run it at any time.
        </p>
        <button
          onClick={onReset}
          className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-[#4573D2] hover:bg-[#3a63b8] transition-colors"
        >
          Run Again
        </button>
      </div>
    </div>
  );
}
