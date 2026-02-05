import { useEffect, useState } from 'react';
import { fetchDataTypes, type DataTypeDefinition } from '../../lib/api';

const CATEGORY_ICONS: Record<string, string> = {
  Financial: '💰',
  Projects: '📋',
  Sales: '📊',
  Marketing: '📣',
  Operations: '⚙️',
};

const CATEGORY_COLORS: Record<string, string> = {
  Financial: 'border-emerald-200 hover:border-emerald-400',
  Projects: 'border-blue-200 hover:border-blue-400',
  Sales: 'border-purple-200 hover:border-purple-400',
  Marketing: 'border-orange-200 hover:border-orange-400',
  Operations: 'border-slate-200 hover:border-slate-400',
};

export default function DataTypeSelector({
  onSelect,
}: {
  onSelect: (dt: DataTypeDefinition) => void;
}) {
  const [grouped, setGrouped] = useState<Record<string, DataTypeDefinition[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDataTypes()
      .then((res) => setGrouped(res.grouped))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-5 w-32 bg-gray-200 rounded mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-28 bg-gray-100 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700 font-medium">Failed to load data types</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Select Data Type</h2>
      <p className="text-gray-500 text-sm mb-6">Choose the type of data you're uploading.</p>

      {Object.entries(grouped).map(([category, types]) => (
        <div key={category} className="mb-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>{CATEGORY_ICONS[category] ?? '📁'}</span>
            {category}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {types.map((dt) => (
              <button
                key={dt.id}
                onClick={() => onSelect(dt)}
                className={`text-left p-5 rounded-xl border-2 bg-white transition-all hover:shadow-md cursor-pointer ${
                  CATEGORY_COLORS[category] ?? 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <h4 className="font-semibold text-gray-900 text-sm">{dt.name}</h4>
                <p className="text-gray-500 text-xs mt-1 leading-relaxed">{dt.description}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {dt.fields.filter((f) => f.required).length} required fields
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
