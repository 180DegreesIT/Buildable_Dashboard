import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import type { RevenueByCategoryPoint } from '../../lib/dashboardApi';

function formatWeekLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function formatCurrency(val: number) {
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val.toFixed(0)}`;
}

const COLORS = {
  residential: '#4573D2',
  commercial: '#6AAF50',
  retrospective: '#E8A442',
};

const LABELS: Record<string, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  retrospective: 'Retrospective',
};

export default function RevenueByCategoryChart({ data }: { data: RevenueByCategoryPoint[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Revenue by Category (13 Weeks)</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
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
                LABELS[String(name)] ?? name,
              ]}
              labelFormatter={(label: any) => formatWeekLabel(String(label))}
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
            />
            <Legend
              formatter={(value: string) => LABELS[value] ?? value}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="residential" stackId="rev" fill={COLORS.residential} radius={[0, 0, 0, 0]} />
            <Bar dataKey="commercial" stackId="rev" fill={COLORS.commercial} radius={[0, 0, 0, 0]} />
            <Bar dataKey="retrospective" stackId="rev" fill={COLORS.retrospective} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
