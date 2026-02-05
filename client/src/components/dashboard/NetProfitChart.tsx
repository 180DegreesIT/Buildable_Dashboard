import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import type { NetProfitTrendPoint } from '../../lib/dashboardApi';

function formatWeekLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function formatCurrency(val: number) {
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val.toFixed(0)}`;
}

export default function NetProfitChart({ data }: { data: NetProfitTrendPoint[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Net Profit Trend (13 Weeks)</h3>
      <div className="h-72">
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
                name === 'netProfit' ? 'Net Profit' : 'Budget',
              ]}
              labelFormatter={(label: any) => formatWeekLabel(String(label))}
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
            />
            <Legend
              formatter={(value: string) => value === 'netProfit' ? 'Net Profit' : 'Budget'}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="netProfit"
              stroke="#4573D2"
              strokeWidth={2}
              dot={{ r: 3, fill: '#4573D2' }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="budget"
              stroke="#6B7280"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
