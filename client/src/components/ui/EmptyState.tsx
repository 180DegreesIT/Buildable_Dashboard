export default function EmptyState({
  title = 'No data available',
  message = 'There is no data for the selected week. Try selecting a different week or uploading data.',
  icon,
}: {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
        {icon ?? (
          <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        )}
      </div>
      <h3 className="text-base font-semibold text-[#1A1A2E] mb-1">{title}</h3>
      <p className="text-sm text-[#6B7280] max-w-sm mx-auto">{message}</p>
    </div>
  );
}
