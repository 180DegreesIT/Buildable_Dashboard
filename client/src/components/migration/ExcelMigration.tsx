/**
 * ExcelMigration — Two-step wizard container for Excel workbook migration.
 *
 * State machine: idle → preview → importing → complete
 */
import { useState, useCallback } from 'react';
import type { DryRunResult, MigrationResult } from '../../lib/migrationApi';
import { uploadWorkbook, startImport } from '../../lib/migrationApi';
import MigrationUpload from './MigrationUpload';
import MigrationProgress from './MigrationProgress';
import MigrationReport from './MigrationReport';

type MigrationPhase = 'idle' | 'preview' | 'importing' | 'complete';

interface MigrationState {
  phase: MigrationPhase;
  dryRun: DryRunResult | null;
  jobId: string | null;
  result: MigrationResult | null;
  error: string | null;
}

const INITIAL_STATE: MigrationState = {
  phase: 'idle',
  dryRun: null,
  jobId: null,
  result: null,
  error: null,
};

export default function ExcelMigration() {
  const [state, setState] = useState<MigrationState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = useCallback(() => {
    setState(INITIAL_STATE);
    setIsLoading(false);
  }, []);

  const handleUploadComplete = useCallback((dryRun: DryRunResult) => {
    setState({
      phase: 'preview',
      dryRun,
      jobId: dryRun.jobId,
      result: null,
      error: null,
    });
  }, []);

  const handleStartImport = useCallback(async () => {
    if (!state.jobId) return;
    setIsLoading(true);
    try {
      await startImport(state.jobId);
      setState((prev) => ({ ...prev, phase: 'importing', error: null }));
    } catch (err: any) {
      setState((prev) => ({ ...prev, error: err.message }));
    } finally {
      setIsLoading(false);
    }
  }, [state.jobId]);

  const handleImportComplete = useCallback((result: MigrationResult) => {
    setState((prev) => ({ ...prev, phase: 'complete', result }));
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A2E]">Excel Workbook Migration</h1>
            <p className="text-[#6B7280] text-sm mt-1">
              Import data from your existing Excel workbook in one step. The system will
              parse all sheets and map them to the correct database tables.
            </p>
          </div>
          {state.phase !== 'idle' && (
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Start Over
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {state.error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
          <svg className="w-5 h-5 text-[#D94F4F] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-[#D94F4F] text-sm font-medium">Something went wrong</p>
            <p className="text-[#D94F4F]/80 text-sm mt-0.5">{state.error}</p>
          </div>
          <button onClick={() => setState((prev) => ({ ...prev, error: null }))} className="text-[#D94F4F]/60 hover:text-[#D94F4F] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Phase content */}
      {(state.phase === 'idle' || state.phase === 'preview') && (
        <MigrationUpload
          onUploadComplete={handleUploadComplete}
          dryRun={state.dryRun}
          onStartImport={handleStartImport}
          isLoading={isLoading}
        />
      )}

      {state.phase === 'importing' && state.jobId && (
        <MigrationProgress
          jobId={state.jobId}
          onComplete={handleImportComplete}
        />
      )}

      {state.phase === 'complete' && state.result && (
        <MigrationReport
          result={state.result}
          allWarnings={state.result.allWarnings}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
