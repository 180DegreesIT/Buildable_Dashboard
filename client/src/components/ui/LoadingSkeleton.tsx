export default function LoadingSkeleton({
  variant = 'card',
  count = 1,
}: {
  variant?: 'card' | 'table' | 'kpi' | 'chart';
  count?: number;
}) {
  if (variant === 'kpi') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
            <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
            <div className="h-7 w-32 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'chart') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
        <div className="h-4 w-40 bg-gray-200 rounded mb-4" />
        <div className="h-64 bg-gray-50 rounded-lg" />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
        <div className="h-10 bg-gray-50 border-b border-gray-100" />
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-12 border-b border-gray-50 px-4 flex items-center gap-4">
            <div className="h-3 w-24 bg-gray-100 rounded" />
            <div className="h-3 w-16 bg-gray-100 rounded" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Default: card
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
          <div className="h-4 w-48 bg-gray-200 rounded mb-4" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-gray-100 rounded" />
            <div className="h-3 w-3/4 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
