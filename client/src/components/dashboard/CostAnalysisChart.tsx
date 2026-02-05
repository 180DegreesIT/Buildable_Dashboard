import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceArea,
} from 'recharts';
import type { CostAnalysisPoint } from '../../lib/dashboardApi';

function formatWeekLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function CostAnalysisChart({ data }: { data: CostAnalysisPoint[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-[#1A1A2E] mb-1">
        Revenue to Staff Ratio Trend
      </h3>
      <p className="text-xs text-[#6B7280] mb-4">
        Wages as % of revenue. 55–65% is the healthy benchmark range.
      </p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            {/* Benchmark band: 55-65% shown as green shaded area */}
            <ReferenceArea y1={55} y2={65} fill="#6AAF50" fillOpacity={0.1} />
            <XAxis
              dataKey="weekEnding"
              tickFormatter={formatWeekLabel}
              tick={{ fontSize: 11, fill: '#6B7280' }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 11, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
              width={50}
              domain={['auto', 'auto']}
            />
            <Tooltip
              formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Staff Ratio']}
              labelFormatter={(label: any) => formatWeekLabel(String(label))}
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="revenueToStaffRatio"
              stroke="#4573D2"
              strokeWidth={2}
              dot={{ r: 3, fill: '#4573D2' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
