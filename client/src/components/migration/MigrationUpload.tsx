/**
 * MigrationUpload — Step 1: File upload dropzone + dry-run preview.
 *
 * Accepts .xlsx/.xls files, uploads them for parsing, and displays
 * a preview of what will be imported into each database table.
 */
import { useState, useRef, useCallback } from 'react';
import { uploadWorkbook, type DryRunResult, type DryRunTable } from '../../lib/migrationApi';

interface Props {
  onUploadComplete: (result: DryRunResult) => void;
  dryRun: DryRunResult | null;
  onStartImport: () => void;
  isLoading: boolean;
}

export default function MigrationUpload({ onUploadComplete, dryRun, onStartImport, isLoading }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const ext = f.name.toLowerCase().split('.').pop();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('Only .xlsx and .xls files are accepted.');
      return;
    }
    setError('');
    setFile(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');

    try {
      const result = await uploadWorkbook(file);
      onUploadComplete(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function toggleTable(tableName: string) {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) next.delete(tableName);
      else next.add(tableName);
      return next;
    });
  }

  // ─── Upload Area ──────────────────────────────────────────────────────────────

  if (!dryRun) {
    return (
      <div>
        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-[#4573D2] bg-[#4573D2]/5'
              : file
              ? 'border-[#6AAF50] bg-[#6AAF50]/5'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />

          {file ? (
            <div>
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#6AAF50]/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-[#6AAF50]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-[#1A1A2E] font-medium">{file.name}</p>
              <p className="text-[#6B7280] text-sm mt-1">{formatSize(file.size)}</p>
              <p className="text-[#4573D2] text-sm mt-2 hover:underline">Click to change file</p>
            </div>
          ) : (
            <div>
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center">
                <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
              </div>
              <p className="text-[#1A1A2E] font-medium">Drop your Excel workbook here</p>
              <p className="text-[#6B7280] text-sm mt-1">or click to browse</p>
              <p className="text-[#6B7280] text-xs mt-3">Accepts .xlsx and .xls files up to 20 MB</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-[#D94F4F] text-sm">{error}</p>
          </div>
        )}

        {/* Upload button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-[#4573D2] hover:bg-[#3a63b8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Parsing workbook...
              </>
            ) : (
              'Upload & Preview'
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── Dry-Run Preview ──────────────────────────────────────────────────────────

  const visibleWarnings = showAllWarnings
    ? dryRun.allWarnings.slice(0, 20)
    : dryRun.allWarnings.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Preview header card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1A1A2E]">Migration Preview</h2>
            <p className="text-[#6B7280] text-sm mt-0.5">
              Parsed <span className="font-medium">{dryRun.fileName}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-[#6AAF50]/10 text-[#6AAF50] text-xs font-medium px-2.5 py-1 rounded-full">
              {dryRun.totalRecords.toLocaleString()} records
            </span>
            {dryRun.totalWarnings > 0 && (
              <span className="bg-[#E8A442]/10 text-[#E8A442] text-xs font-medium px-2.5 py-1 rounded-full">
                {dryRun.totalWarnings.toLocaleString()} warnings
              </span>
            )}
          </div>
        </div>

        {/* Table breakdown */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2.5 font-medium text-[#6B7280]">Table</th>
                <th className="px-4 py-2.5 font-medium text-[#6B7280] text-right">Records</th>
                <th className="px-4 py-2.5 font-medium text-[#6B7280] text-right">Warnings</th>
                <th className="px-4 py-2.5 font-medium text-[#6B7280] w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dryRun.tables.map((table: DryRunTable) => (
                <TableRow
                  key={table.tableName}
                  table={table}
                  expanded={expandedTables.has(table.tableName)}
                  onToggle={() => toggleTable(table.tableName)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warnings section */}
      {dryRun.allWarnings.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">
              Warnings ({dryRun.allWarnings.length.toLocaleString()})
            </h3>
            {dryRun.allWarnings.length > 5 && (
              <button
                onClick={() => setShowAllWarnings((v) => !v)}
                className="text-[#4573D2] text-xs font-medium hover:underline"
              >
                {showAllWarnings ? 'Show fewer' : `Show more (${Math.min(20, dryRun.allWarnings.length)})`}
              </button>
            )}
          </div>
          <ul className="space-y-1.5 max-h-64 overflow-y-auto">
            {visibleWarnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#E8A442]">
                <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[#6B7280]">{w}</span>
              </li>
            ))}
          </ul>
          {dryRun.allWarnings.length > 20 && showAllWarnings && (
            <p className="text-xs text-[#6B7280] mt-2">
              Showing first 20 of {dryRun.allWarnings.length.toLocaleString()} warnings.
              Full list will be available in the final report.
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => window.location.reload()}
          className="text-[#6B7280] text-sm hover:text-[#1A1A2E] hover:underline transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onStartImport}
          disabled={isLoading || dryRun.totalRecords === 0}
          className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-[#6AAF50] hover:bg-[#5a9a42] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Starting...
            </>
          ) : (
            <>Start Import ({dryRun.totalRecords.toLocaleString()} records)</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Table Row with expandable sample records ────────────────────────────────

function TableRow({
  table,
  expanded,
  onToggle,
}: {
  table: DryRunTable;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-2.5 text-[#1A1A2E] font-medium">{table.tableName}</td>
        <td className="px-4 py-2.5 text-right text-[#1A1A2E]">{table.recordCount.toLocaleString()}</td>
        <td className="px-4 py-2.5 text-right">
          {table.warnings.length > 0 ? (
            <span className="bg-[#E8A442]/10 text-[#E8A442] text-xs px-2 py-0.5 rounded-full">
              {table.warnings.length}
            </span>
          ) : (
            <span className="text-[#6B7280] text-xs">0</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-center">
          <svg
            className={`w-4 h-4 text-[#6B7280] transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </td>
      </tr>
      {expanded && table.sampleRecords.length > 0 && (
        <tr>
          <td colSpan={4} className="px-4 py-3 bg-gray-50">
            <p className="text-xs font-medium text-[#6B7280] mb-2">
              Sample records (first {table.sampleRecords.length})
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead>
                  <tr className="bg-gray-100">
                    {Object.keys(table.sampleRecords[0]).map((key) => (
                      <th key={key} className="px-3 py-1.5 text-left font-medium text-[#6B7280] whitespace-nowrap">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {table.sampleRecords.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-3 py-1.5 text-[#1A1A2E] whitespace-nowrap max-w-[200px] truncate">
                          {val == null ? '' : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {table.warnings.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-[#E8A442] mb-1">Warnings:</p>
                <ul className="space-y-0.5">
                  {table.warnings.slice(0, 5).map((w, i) => (
                    <li key={i} className="text-xs text-[#6B7280]">- {w}</li>
                  ))}
                  {table.warnings.length > 5 && (
                    <li className="text-xs text-[#6B7280]">... and {table.warnings.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
