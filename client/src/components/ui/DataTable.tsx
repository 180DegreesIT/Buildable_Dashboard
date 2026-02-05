import { useState, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: string;
  expandable?: (row: T) => ReactNode;
  emptyMessage?: string;
  loading?: boolean;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  expandable,
  emptyMessage = 'No data available.',
  loading = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="animate-pulse p-4 space-y-3">
          <div className="h-8 bg-gray-100 rounded" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {data.length === 0 ? (
        <div className="p-8 text-center text-[#6B7280] text-sm">{emptyMessage}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    } ${col.sortable ? 'cursor-pointer hover:text-gray-900 select-none' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable && sortKey === col.key && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={sortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
                          />
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedData.map((row) => {
                const key = String(row[keyField]);
                const isExpanded = expandedRow === key;
                return (
                  <tr key={key} className="group">
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        onClick={() => expandable && setExpandedRow(isExpanded ? null : key)}
                        className={`px-4 py-3 text-[#1A1A2E] ${
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        } ${expandable ? 'cursor-pointer' : ''}`}
                      >
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
