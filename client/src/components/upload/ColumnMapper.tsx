import { useState, useMemo } from 'react';
import {
  applyMapping,
  saveMapping,
  type DataTypeDefinition,
  type ParseResult,
  type AutoMapResult,
  type ApplyMappingResult,
} from '../../lib/api';

export default function ColumnMapper({
  dataType,
  parseResult,
  autoMapResult,
  initialMapping,
  onConfirm,
  onBack,
}: {
  dataType: DataTypeDefinition;
  parseResult: ParseResult;
  autoMapResult: AutoMapResult | null;
  initialMapping: Record<string, string>;
  onConfirm: (mapping: Record<string, string>, result: ApplyMappingResult) => void;
  onBack: () => void;
}) {
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  // All available target fields from the data type definition
  const targetFields = useMemo(() => dataType.fields, [dataType]);
  // Which DB fields are currently mapped
  const mappedDbFields = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);

  // Missing required fields
  const missingRequired = useMemo(
    () => targetFields.filter((f) => f.required && !mappedDbFields.has(f.dbField)),
    [targetFields, mappedDbFields],
  );

  function setFieldMapping(csvHeader: string, dbField: string) {
    setMapping((prev) => {
      const next = { ...prev };
      if (dbField === '') {
        delete next[csvHeader];
      } else {
        next[csvHeader] = dbField;
      }
      return next;
    });
  }

  async function handleValidate() {
    setValidating(true);
    setError('');
    try {
      const result = await applyMapping(dataType.id, parseResult.previewRows, mapping);
      onConfirm(mapping, result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  }

  async function handleSaveMapping() {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      await saveMapping(saveName.trim(), dataType.id, mapping);
      setSaveSuccess(`Mapping "${saveName}" saved.`);
      setShowSave(false);
      setSaveName('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Map Columns</h2>
          <p className="text-gray-500 text-sm">
            Match your CSV columns to <span className="font-medium text-indigo-600">{dataType.name}</span> fields
          </p>
        </div>
      </div>

      {/* Auto-map banner */}
      {autoMapResult?.autoMapped && (
        <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-start gap-3">
          <svg className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-indigo-800 text-sm font-medium">
              Auto-mapped using "{autoMapResult.mappingName}" ({autoMapResult.score}% match)
            </p>
            <p className="text-indigo-600 text-xs mt-0.5">Review the mapping below and confirm.</p>
          </div>
        </div>
      )}

      {/* Mapping table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-0 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <span>CSV Column</span>
          <span className="w-8" />
          <span>Database Field</span>
        </div>

        <div className="divide-y divide-gray-100">
          {parseResult.headers.map((header) => {
            const selectedDb = mapping[header] ?? '';
            const isMapped = selectedDb !== '';
            return (
              <div
                key={header}
                className={`grid grid-cols-[1fr_auto_1fr] gap-0 items-center px-5 py-3 ${
                  isMapped ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isMapped ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                    {header}
                  </span>
                  {parseResult.columns.find((c) => c.name === header) && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {parseResult.columns.find((c) => c.name === header)?.inferredType}
                    </span>
                  )}
                </div>

                <div className="w-8 flex justify-center">
                  <svg className={`w-4 h-4 ${isMapped ? 'text-indigo-400' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>

                <select
                  value={selectedDb}
                  onChange={(e) => setFieldMapping(header, e.target.value)}
                  className={`text-sm rounded-lg border px-3 py-2 w-full ${
                    isMapped
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                      : 'border-gray-200 bg-white text-gray-500'
                  }`}
                >
                  <option value="">— Ignore this column —</option>
                  {targetFields.map((f) => {
                    const alreadyUsed = mappedDbFields.has(f.dbField) && selectedDb !== f.dbField;
                    return (
                      <option key={f.dbField} value={f.dbField} disabled={alreadyUsed}>
                        {f.label} {f.required ? '*' : ''} ({f.type}){alreadyUsed ? ' (already mapped)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Missing required fields warning */}
      {missingRequired.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-amber-800 text-sm font-medium">Required fields not yet mapped:</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {missingRequired.map((f) => (
              <li key={f.dbField} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                {f.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Save mapping */}
      <div className="mt-4 flex items-center gap-3">
        {!showSave ? (
          <button
            onClick={() => setShowSave(true)}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Save mapping for next time...
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Mapping name (e.g. &quot;Financial P&L Standard&quot;)"
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-72"
            />
            <button
              onClick={handleSaveMapping}
              disabled={saving || !saveName.trim()}
              className="text-sm px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setShowSave(false); setSaveName(''); }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {saveSuccess && (
        <div className="mt-2 text-sm text-emerald-600">{saveSuccess}</div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleValidate}
          disabled={missingRequired.length > 0 || validating}
          className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {validating ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Validating...
            </>
          ) : (
            'Validate & Preview'
          )}
        </button>
      </div>
    </div>
  );
}
