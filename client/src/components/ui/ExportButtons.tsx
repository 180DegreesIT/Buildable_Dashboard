export default function ExportButtons({ disabled = false }: { disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <button
        disabled={disabled}
        onClick={() => alert('CSV export coming soon')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#6B7280] bg-gray-50 border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        CSV
      </button>
      <button
        disabled={disabled}
        onClick={() => alert('PDF export coming soon')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#6B7280] bg-gray-50 border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        PDF
      </button>
    </div>
  );
}
