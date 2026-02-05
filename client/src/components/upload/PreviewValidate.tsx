import { useState } from 'react';
import type { DataTypeDefinition, ApplyMappingResult } from '../../lib/api';

const STATUS_STYLES = {
  pass: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '✓', label: 'Pass' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', icon: '⚠', label: 'Warning' },
  error: { bg: 'bg-red-50', text: 'text-red-700', icon: '✕', label: 'Error' },
};

export default function PreviewValidate({
  dataType: _dataType,
  result,
  duplicateStrategy,
  onStrategyChange,
  onConfirm,
  onBack,
}: {
  dataType: DataTypeDefinition;
  result: ApplyMappingResult;
  duplicateStrategy: 'overwrite' | 'skip' | 'merge';
  onStrategyChange: (s: 'overwrite' | 'skip' | 'merge') => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const { rows, summary, duplicates } = result;

  // Get column names from the field mappings (mapped DB fields)
  const columns = result.fieldMappings.map((fm: any) => ({
    csvHeader: fm.csvHeader,
    dbField: fm.dbField,
  }));

  const hasDuplicates = duplicates.length > 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Preview & Validate</h2>
          <p className="text-gray-500 text-sm">Review your data before importing</p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-400" />
          <span className="text-sm text-gray-700">{summary.passed} ready</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="text-sm text-gray-700">{summary.warnings} warnings</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span className="text-sm text-gray-700">{summary.errors} errors</span>
        </div>
        {summary.blankSkipped > 0 && (
          <span className="text-sm text-gray-400">{summary.blankSkipped} blank rows skipped</span>
        )}
        <span className="text-sm text-gray-500 ml-auto">{summary.total} total rows</span>
      </div>

      {/* Duplicate warning */}
      {hasDuplicates && (
        <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50">
          <p className="text-amber-800 text-sm font-medium mb-2">
            {duplicates.length} row(s) have week dates that already exist in the database.
          </p>
          <div className="flex items-center gap-4 mt-3">
            <label className="text-sm text-gray-700 font-medium">How to handle duplicates:</label>
            <div className="flex gap-2">
              {(['skip', 'overwrite', 'merge'] as const).map((strategy) => (
                <button
                  key={strategy}
                  onClick={() => onStrategyChange(strategy)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                    duplicateStrategy === strategy
                      ? 'border-indigo-300 bg-indigo-100 text-indigo-800 font-medium'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {strategy === 'skip' && 'Skip existing'}
                  {strategy === 'overwrite' && 'Overwrite existing'}
                  {strategy === 'merge' && 'Merge (non-null only)'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">
                  Status
                </th>
                {columns.slice(0, 6).map((col: any) => (
                  <th
                    key={col.dbField}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider max-w-[160px]"
                  >
                    {col.csvHeader}
                  </th>
                ))}
                {columns.length > 6 && (
                  <th className="px-4 py-3 text-xs text-gray-400">+{columns.length - 6} more</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.slice(0, 20).map((row) => {
                const style = STATUS_STYLES[row.status];
                const isExpanded = expandedRow === row.rowIndex;
                const isDuplicate = duplicates.some((d) => d.rowIndex === row.rowIndex);

                return (
                  <tr key={row.rowIndex} className="group">
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">{row.rowIndex}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : row.rowIndex)}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${style.bg} ${style.text}`}
                      >
                        <span>{style.icon}</span>
                        {style.label}
                        {isDuplicate && <span className="ml-1">📋</span>}
                      </button>
                    </td>
                    {columns.slice(0, 6).map((col: any) => (
                      <td key={col.dbField} className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                        {row.original[col.csvHeader] ?? '—'}
                      </td>
                    ))}
                    {columns.length > 6 && <td />}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expanded row detail */}
        {expandedRow !== null && (
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            {(() => {
              const row = rows.find((r) => r.rowIndex === expandedRow);
              if (!row) return null;
              return (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Row {row.rowIndex} Details</p>
                  {row.messages.length > 0 ? (
                    <ul className="space-y-1">
                      {row.messages.map((msg, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className={row.status === 'error' ? 'text-red-500' : 'text-amber-500'}>•</span>
                          {msg}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400">No issues found.</p>
                  )}

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(row.data).map(([key, val]) => (
                      <div key={key} className="text-xs">
                        <span className="text-gray-400">{key}: </span>
                        <span className="text-gray-700 font-medium">
                          {val instanceof Object ? JSON.stringify(val) : String(val ?? '—')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {rows.length > 20 && (
        <p className="text-xs text-gray-400 mt-2 text-center">Showing first 20 of {rows.length} rows</p>
      )}

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={summary.passed + summary.warnings === 0}
          className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue to Import
        </button>
      </div>
    </div>
  );
}
