import { useWeek, getWeekNumber } from '../../lib/WeekContext';

export default function TopBar() {
  const { selectedWeek, availableWeeks, setSelectedWeek, loading } = useWeek();

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      {/* Left: breadcrumb placeholder */}
      <div />

      {/* Center: Week selector */}
      <div className="flex items-center gap-3">
        {loading ? (
          <div className="animate-pulse h-8 w-48 bg-gray-100 rounded-lg" />
        ) : (
          <>
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">Week Ending</label>
            <div className="relative">
              <select
                value={selectedWeek ?? ''}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-gray-800 hover:border-gray-300 focus:border-[#4573D2] focus:ring-1 focus:ring-[#4573D2]/20 transition-colors cursor-pointer"
              >
                {availableWeeks.map((w) => (
                  <option key={w} value={w}>
                    {formatWeekLabel(w)}
                  </option>
                ))}
                {selectedWeek && !availableWeeks.includes(selectedWeek) && (
                  <option value={selectedWeek}>{formatWeekLabel(selectedWeek)}</option>
                )}
              </select>
              <svg
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {selectedWeek && (
              <span className="text-xs text-gray-400">
                Wk {getWeekNumber(selectedWeek)}
              </span>
            )}
          </>
        )}
      </div>

      {/* Right: User info */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#4573D2]/10 flex items-center justify-center">
          <span className="text-xs font-semibold text-[#4573D2]">DA</span>
        </div>
        <span className="text-sm text-gray-600 hidden sm:block">Dev Admin</span>
      </div>
    </header>
  );
}

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}
