import { useEffect, useState } from 'react';
import { fetchHistory, rollbackUpload, type UploadRecord } from '../../lib/api';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  processing: { bg: 'bg-blue-100', text: 'text-blue-700' },
  pending: { bg: 'bg-gray-100', text: 'text-gray-700' },
  failed: { bg: 'bg-red-100', text: 'text-red-700' },
  rolled_back: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

export default function UploadHistory({ onNavigateUpload }: { onNavigateUpload: () => void }) {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDataType, setFilterDataType] = useState('');

  // Rollback modal
  const [rollbackTarget, setRollbackTarget] = useState<UploadRecord | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackResult, setRollbackResult] = useState('');

  function loadHistory() {
    setLoading(true);
    setError('');
    fetchHistory({
      status: filterStatus || undefined,
      dataType: filterDataType || undefined,
    })
      .then(setUploads)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadHistory();
  }, [filterStatus, filterDataType]);

  async function handleRollback() {
    if (!rollbackTarget) return;
    setRollingBack(true);
    try {
      const res = await rollbackUpload(rollbackTarget.id);
      setRollbackResult(
        `Rolled back upload #${res.uploadId}: ${res.rowsDeleted} deleted, ${res.rowsRestored} restored.`,
      );
      setRollbackTarget(null);
      loadHistory();
    } catch (err: any) {
      setRollbackResult('');
      setError(err.message);
      setRollbackTarget(null);
    } finally {
      setRollingBack(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Get unique data types for filter
  const dataTypes = [...new Set(uploads.map((u) => u.dataType))];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Upload History</h2>
          <p className="text-gray-500 text-sm">View past uploads and rollback if needed</p>
        </div>
        <button
          onClick={onNavigateUpload}
          className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
        >
          New Upload
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700"
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="rolled_back">Rolled Back</option>
          <option value="processing">Processing</option>
        </select>
        <select
          value={filterDataType}
          onChange={(e) => setFilterDataType(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700"
        >
          <option value="">All Data Types</option>
          {dataTypes.map((dt) => (
            <option key={dt} value={dt}>
              {dt}
            </option>
          ))}
        </select>
      </div>

      {rollbackResult && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between">
          <p className="text-emerald-700 text-sm">{rollbackResult}</p>
          <button onClick={() => setRollbackResult('')} className="text-emerald-500 hover:text-emerald-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full mx-auto" />
            <p className="text-gray-400 text-sm mt-3">Loading...</p>
          </div>
        ) : uploads.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No uploads yet</p>
            <p className="text-gray-400 text-sm mt-1">Upload your first CSV to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">File</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Uploaded By</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Rows</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {uploads.map((upload) => {
                  const style = STATUS_STYLES[upload.status] ?? STATUS_STYLES.pending;
                  return (
                    <tr key={upload.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(upload.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium max-w-[200px] truncate">
                        {upload.fileName}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{upload.dataType}</td>
                      <td className="px-4 py-3 text-gray-600">{upload.uploadedBy ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-700">{upload.rowsProcessed}</span>
                        {upload.rowsFailed > 0 && (
                          <span className="text-red-500 text-xs ml-1">({upload.rowsFailed} failed)</span>
                        )}
                        {upload.rowsSkipped > 0 && (
                          <span className="text-gray-400 text-xs ml-1">({upload.rowsSkipped} skipped)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${style.bg} ${style.text}`}>
                          {upload.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {upload.status === 'completed' && (
                          <button
                            onClick={() => setRollbackTarget(upload)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium hover:underline"
                          >
                            Rollback
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rollback confirmation modal */}
      {rollbackTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Rollback</h3>
            <p className="text-gray-600 text-sm mb-4">
              This will undo upload <span className="font-medium">"{rollbackTarget.fileName}"</span> and remove{' '}
              {rollbackTarget.rowsProcessed} row(s) from the database. Any overwritten data will be restored.
            </p>
            <p className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRollbackTarget(null)}
                disabled={rollingBack}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleRollback}
                disabled={rollingBack}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {rollingBack ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Rolling back...
                  </>
                ) : (
                  'Rollback'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
