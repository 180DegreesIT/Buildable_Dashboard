import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';

// Top categories to show individually; rest go into "Other"
const TOP_CATEGORIES = [
  'class_1a', 'class_2_9_commercial', 'council_fees', 'inspections',
  'planning_1_10', 'insurance_levy', 'access_labour_hire', 'retrospective',
];

const CATEGORY_LABELS: Record<string, string> = {
  class_1a: 'Class 1A',
  class_10a_sheds: 'Class 10a Sheds',
  class_10b_pools: 'Class 10b Pools',
  class_2_9_commercial: 'Commercial',
  inspections: 'Inspections',
  retrospective: 'Retrospective',
  council_fees: 'Council Fees',
  planning_1_10: 'Planning 1&10',
  planning_2_9: 'Planning 2-9',
  property_searches: 'Property Searches',
  qleave: 'Qleave',
  sundry: 'Sundry',
  access_labour_hire: 'Access Labour',
  insurance_levy: 'Insurance Levy',
};

const COLORS = [
  '#4573D2', '#6AAF50', '#E8A442', '#D94F4F', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316',
];

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
  netRevenue: boolean;
  passThroughCategories: string[];
}

export default function RevenueBreakdownChart({ data, netRevenue, passThroughCategories }: Props) {
  // Determine which categories appear in the data
  const allCategories = new Set<string>();
  for (const row of data) {
    for (const key of Object.keys(row)) {
      if (key !== 'weekEnding') allCategories.add(key);
    }
  }

  // Filter out pass-through if net revenue mode
  const visibleCategories = netRevenue
    ? [...allCategories].filter(c => !passThroughCategories.includes(c))
    : [...allCategories];

  // Split into top categories and "other"
  const topVisible = visibleCategories.filter(c => TOP_CATEGORIES.includes(c));
  const otherVisible = visibleCategories.filter(c => !TOP_CATEGORIES.includes(c));

  // Transform data: collapse "other" categories
  const chartData = data.map(row => {
    const point: Record<string, any> = { weekEnding: row.weekEnding };
    for (const cat of topVisible) {
      point[cat] = row[cat] ?? 0;
    }
    if (otherVisible.length > 0) {
      point['other'] = otherVisible.reduce((sum, cat) => sum + (row[cat] ?? 0), 0);
    }
    return point;
  });

  const areaKeys = [...topVisible, ...(otherVisible.length > 0 ? ['other'] : [])];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-[#1A1A2E] mb-1">
        Revenue by Income Category (13 Weeks)
      </h3>
      <p className="text-xs text-[#6B7280] mb-4">
        {netRevenue ? 'Net revenue (pass-through items excluded)' : 'Gross revenue (all categories)'}
      </p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
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
                name === 'other' ? 'Other' : (CATEGORY_LABELS[String(name)] ?? name),
              ]}
              labelFormatter={(label: any) => formatWeekLabel(String(label))}
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
            />
            <Legend
              formatter={(value: string) =>
                value === 'other' ? 'Other' : (CATEGORY_LABELS[value] ?? value)
              }
              wrapperStyle={{ fontSize: 11 }}
            />
            {areaKeys.map((key, idx) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId="rev"
                fill={COLORS[idx % COLORS.length]}
                stroke={COLORS[idx % COLORS.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
