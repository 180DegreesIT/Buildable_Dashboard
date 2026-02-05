import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';

const TEAM_COLORS: Record<string, string> = {
  cairns: '#4573D2',
  mackay: '#6AAF50',
  nq_commercial: '#E8A442',
  seq_residential: '#D94F4F',
  seq_commercial: '#8B5CF6',
  town_planning: '#EC4899',
  townsville: '#06B6D4',
  wide_bay: '#F97316',
  all_in_access: '#10B981',
};

function formatWeekLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function formatCurrency(val: number) {
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val.toFixed(0)}`;
}

interface Props {
  data: Record<string, any>[];
  regions: string[];
  regionLabels: Record<string, string>;
  selectedRegion: string | null;
}

export default function RegionalTrendChart({ data, regions, regionLabels, selectedRegion }: Props) {
  // If a region is selected, only show that one; otherwise show all
  const visibleRegions = selectedRegion ? [selectedRegion] : regions;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-[#1A1A2E] mb-1">
        {selectedRegion
          ? `${regionLabels[selectedRegion]} — 13-Week Trend`
          : 'All Teams — 13-Week Trend'}
      </h3>
      <p className="text-xs text-[#6B7280] mb-4">
        Actual invoiced per week by team
      </p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="weekEnding"
              tickFormatter={formatWeekLabel}
              tick={{ fontSize: 11, fill: '#6B7280' }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              formatter={(value: any, name: any) => [
                `$${Number(value).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
                regionLabels[String(name)] ?? name,
              ]}
              labelFormatter={(label: any) => formatWeekLabel(String(label))}
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
            />
            {!selectedRegion && (
              <Legend
                formatter={(value: string) => regionLabels[value] ?? value}
                wrapperStyle={{ fontSize: 11 }}
              />
            )}
            {visibleRegions.map((region) => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={TEAM_COLORS[region] ?? '#6B7280'}
                strokeWidth={selectedRegion ? 2.5 : 1.5}
                dot={selectedRegion ? { r: 3, fill: TEAM_COLORS[region] } : false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
