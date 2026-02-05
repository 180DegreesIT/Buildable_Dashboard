import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from 'recharts';
import type { TeamPerformanceRow } from '../../lib/dashboardApi';

function formatCurrency(val: number) {
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val.toFixed(0)}`;
}

function getBarColor(pct: number): string {
  if (pct >= 80) return '#6AAF50';
  if (pct >= 50) return '#E8A442';
  return '#D94F4F';
}

export default function RegionalPerformanceChart({ data }: { data: TeamPerformanceRow[] }) {
  const sorted = [...data].sort((a, b) => b.percentageToTarget - a.percentageToTarget);

  // Custom label showing percentage
  const renderLabel = (props: any) => {
    const { x, y, width, height, index } = props;
    const entry = sorted[index];
    if (!entry) return null;
    return (
      <text
        x={x + width + 6}
        y={y + height / 2}
        dominantBaseline="middle"
        fill="#6B7280"
        fontSize={11}
        fontWeight={500}
      >
        {entry.percentageToTarget.toFixed(0)}%
      </text>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-[#1A1A2E] mb-1">Regional Team Performance vs Target</h3>
      <div className="flex items-center gap-4 mb-4">
        <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#6AAF50] inline-block" /> &ge; 80%
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E8A442] inline-block" /> 50–79%
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#D94F4F] inline-block" /> &lt; 50%
        </span>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 5, right: 50, bottom: 5, left: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11, fill: '#6B7280' }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 11, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip
              formatter={(value: any, name: any) => {
                const label = name === 'actual' ? 'Actual Invoiced' : 'Target';
                return [`$${Number(value).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, label];
              }}
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
            />
            {/* Target bar (background, wider, light) */}
            <Bar dataKey="target" fill="#E5E7EB" radius={[0, 4, 4, 0]} barSize={24} />
            {/* Actual bar (foreground, narrower, colored) */}
            <Bar
              dataKey="actual"
              radius={[0, 4, 4, 0]}
              barSize={24}
              label={renderLabel}
            >
              {sorted.map((entry, idx) => (
                <Cell key={idx} fill={getBarColor(entry.percentageToTarget)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
