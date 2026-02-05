import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface WeekContextValue {
  selectedWeek: string | null;      // YYYY-MM-DD (always a Saturday)
  availableWeeks: string[];
  setSelectedWeek: (week: string) => void;
  loading: boolean;
}

const WeekContext = createContext<WeekContextValue>({
  selectedWeek: null,
  availableWeeks: [],
  setSelectedWeek: () => {},
  loading: true,
});

export function useWeek() {
  return useContext(WeekContext);
}

/**
 * Snap a date to the nearest Saturday.
 */
function toSaturday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun, 6=Sat
  const diff = day === 6 ? 0 : (6 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

/**
 * Get ISO week number for a date.
 */
export function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000) + 1;
  return Math.ceil(dayOfYear / 7);
}

export function WeekProvider({ children }: { children: ReactNode }) {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        // Get current week and most recent with data
        const res = await fetch('/api/v1/weeks/current');
        const data = await res.json();

        // Get list of available weeks
        const listRes = await fetch('/api/v1/weeks/list');
        const weeks: string[] = await listRes.json();

        setAvailableWeeks(weeks);

        // Default to most recent week with data, or current week
        const defaultWeek = data.mostRecentWithData ?? data.currentWeekEnding;
        setSelectedWeek(defaultWeek);
      } catch {
        // Fallback to current Saturday
        setSelectedWeek(toSaturday(new Date().toISOString().split('T')[0]));
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  function handleSetWeek(week: string) {
    setSelectedWeek(toSaturday(week));
  }

  return (
    <WeekContext.Provider value={{ selectedWeek, availableWeeks, setSelectedWeek: handleSetWeek, loading }}>
      {children}
    </WeekContext.Provider>
  );
}
