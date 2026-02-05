interface KPICardProps {
  label: string;
  value: string;
  comparisonLabel?: string;
  comparisonValue?: string;
  variance?: number;       // Percentage or absolute variance
  varianceLabel?: string;  // e.g. "$5,000" or "12.5%"
  invertColor?: boolean;   // If true, negative = good (e.g. Revenue to Staff Ratio)
  benchmark?: { low: number; high: number; value: number; label?: string };
  tooltip?: string;
  loading?: boolean;
}

export default function KPICard({
  label,
  value,
  comparisonLabel,
  comparisonValue,
  variance,
  varianceLabel,
  invertColor = false,
  benchmark,
  tooltip,
  loading = false,
}: KPICardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
        <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
        <div className="h-7 w-32 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-20 bg-gray-100 rounded" />
      </div>
    );
  }

  // Determine color based on variance
  let varianceColor = 'text-gray-500';
  if (variance !== undefined && variance !== 0) {
    const isPositive = invertColor ? variance < 0 : variance > 0;
    varianceColor = isPositive ? 'text-[#6AAF50]' : 'text-[#D94F4F]';
  }

  // Benchmark color
  let benchmarkColor = 'bg-[#6AAF50]';
  if (benchmark) {
    if (benchmark.value < benchmark.low) benchmarkColor = invertColor ? 'bg-[#6AAF50]' : 'bg-[#D94F4F]';
    else if (benchmark.value > benchmark.high) benchmarkColor = invertColor ? 'bg-[#D94F4F]' : 'bg-[#6AAF50]';
    else benchmarkColor = 'bg-[#E8A442]';
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 group" title={tooltip}>
      <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#1A1A2E] mb-1">{value}</p>

      <div className="flex items-center gap-2 flex-wrap">
        {comparisonLabel && comparisonValue && (
          <span className="text-xs text-[#6B7280]">
            {comparisonLabel}: {comparisonValue}
          </span>
        )}
        {varianceLabel && (
          <span className={`text-xs font-semibold ${varianceColor}`}>
            {variance !== undefined && variance > 0 && '+'}
            {varianceLabel}
          </span>
        )}
      </div>

      {benchmark && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${benchmarkColor}`} />
            <span className="text-xs text-[#6B7280]">{benchmark.label ?? `${benchmark.value.toFixed(1)}%`}</span>
          </div>
        </div>
      )}
    </div>
  );
}
