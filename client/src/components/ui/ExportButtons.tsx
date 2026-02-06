import { useState } from 'react';
import { downloadPdf } from '../../lib/exportApi';

interface ExportButtonsProps {
  disabled?: boolean;
  onCsvExport: () => void;
  pageSlug: string;
  weekEnding: string;
}

export default function ExportButtons({ disabled = false, onCsvExport, pageSlug, weekEnding }: ExportButtonsProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  async function handlePdfExport() {
    setPdfLoading(true);
    setPdfError(false);
    try {
      await downloadPdf(pageSlug, weekEnding);
    } catch (err: any) {
      setPdfError(true);
      // Clear error state after 3 seconds
      setTimeout(() => setPdfError(false), 3000);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        disabled={disabled}
        onClick={onCsvExport}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#6B7280] bg-gray-50 border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        CSV
      </button>
      <button
        disabled={disabled || pdfLoading}
        onClick={handlePdfExport}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#6B7280] bg-gray-50 border hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
          pdfError ? 'border-[#D94F4F]' : 'border-gray-200'
        }`}
        title={pdfError ? 'PDF export failed. Server-side generation pending.' : undefined}
      >
        {pdfLoading ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        )}
        {pdfLoading ? 'Exporting...' : 'PDF'}
      </button>
    </div>
  );
}
