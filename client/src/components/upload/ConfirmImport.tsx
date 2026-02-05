import { useState } from 'react';
import { importData, type DataTypeDefinition, type ApplyMappingResult, type ImportResult } from '../../lib/api';

export default function ConfirmImport({
  dataType,
  fileName,
  mapping,
  savedMappingId,
  validationResult,
  duplicateStrategy,
  onDone,
  onNavigateHistory,
  onBack,
}: {
  dataType: DataTypeDefinition;
  fileName: string;
  mapping: Record<string, string>;
  savedMappingId: number | null;
  validationResult: ApplyMappingResult;
  duplicateStrategy: 'overwrite' | 'skip' | 'merge';
  onDone: () => void;
  onNavigateHistory: () => void;
  onBack: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const { rows, summary, duplicates } = validationResult;
  const importableRows = rows.filter((r) => r.status !== 'error');

  // Derive week range from the data
  const weekDates = importableRows
    .map((r) => r.data.weekEnding)
    .filter(Boolean)
    .map((d: any) => (typeof d === 'string' ? d.split('T')[0] : ''))
    .filter(Boolean)
    .sort();
  const weekRange = weekDates.length > 0 ? `${weekDates[0]} to ${weekDates[weekDates.length - 1]}` : 'N/A';

  async function handleImport() {
    setImporting(true);
    setError('');
    try {
      const res = await importData({
        dataTypeId: dataType.id,
        fileName,
        mappingId: savedMappingId ?? undefined,
        rows: validationResult.rows,
        duplicateStrategy,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  // ─── Success Screen ────────────────────────────────────────────────────────
  if (result) {
    const isSuccess = result.status === 'completed';
    return (
      <div className="text-center py-8">
        <div
          className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${
            isSuccess ? 'bg-emerald-100' : 'bg-red-100'
          }`}
        >
          {isSuccess ? (
            <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        <h2 className={`text-2xl font-semibold mb-2 ${isSuccess ? 'text-gray-900' : 'text-red-800'}`}>
          {isSuccess ? 'Import Successful' : 'Import Failed'}
        </h2>

        <p className="text-gray-500 mb-6">
          {isSuccess
            ? `${result.rowsInserted} rows inserted, ${result.rowsUpdated} updated, ${result.rowsSkipped} skipped.`
            : `The import encountered an error. ${result.errors[0]?.messages[0] ?? ''}`}
        </p>

        {/* Stats grid */}
        <div className="inline-grid grid-cols-3 gap-6 mb-8 text-center">
          <div>
            <p className="text-2xl font-bold text-emerald-600">{result.rowsInserted}</p>
            <p className="text-xs text-gray-500 uppercase mt-1">Inserted</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{result.rowsUpdated}</p>
            <p className="text-xs text-gray-500 uppercase mt-1">Updated</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-400">{result.rowsSkipped}</p>
            <p className="text-xs text-gray-500 uppercase mt-1">Skipped</p>
          </div>
        </div>

        {result.rowsFailed > 0 && (
          <div className="mb-6 mx-auto max-w-md text-left bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 text-sm font-medium mb-2">{result.rowsFailed} row(s) failed:</p>
            <ul className="space-y-1">
              {result.errors.slice(0, 5).map((e, i) => (
                <li key={i} className="text-xs text-red-600">
                  Row {e.rowIndex}: {e.messages.join(', ')}
                </li>
              ))}
              {result.errors.length > 5 && (
                <li className="text-xs text-red-400">...and {result.errors.length - 5} more</li>
              )}
            </ul>
          </div>
        )}

        <div className="flex justify-center gap-3">
          <button
            onClick={onNavigateHistory}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            View Upload History
          </button>
          <button
            onClick={onDone}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  // ─── Confirm Screen ────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Confirm Import</h2>
          <p className="text-gray-500 text-sm">Review the summary and import your data</p>
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Data Type</p>
            <p className="text-sm font-medium text-gray-900">{dataType.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">File</p>
            <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Week Range</p>
            <p className="text-sm font-medium text-gray-900">{weekRange}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Rows</p>
            <p className="text-sm font-medium text-gray-900">
              {importableRows.length} to import
              {summary.errors > 0 && <span className="text-red-500 ml-1">({summary.errors} errors)</span>}
            </p>
          </div>
        </div>

        {duplicates.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-amber-700">
              <span className="font-medium">{duplicates.length} duplicate week(s)</span> — strategy:{' '}
              <span className="font-semibold capitalize">{duplicateStrategy}</span>
            </p>
          </div>
        )}

        {/* Mapped fields */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Column Mapping</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(mapping).map(([csv, db]) => (
              <span key={csv} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                {csv} → {db}
              </span>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleImport}
          disabled={importing || importableRows.length === 0}
          className="px-8 py-3 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
        >
          {importing ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Importing...
            </>
          ) : (
            'Import Data'
          )}
        </button>
      </div>
    </div>
  );
}
