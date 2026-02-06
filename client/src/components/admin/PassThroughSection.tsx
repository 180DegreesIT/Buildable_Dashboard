import { useState } from 'react';
import { useSettings } from '../../lib/SettingsContext';
import { updatePassThroughCategories } from '../../lib/settingsApi';

export default function PassThroughSection() {
  const { passThroughCategories, refreshSettings } = useSettings();

  const [items, setItems] = useState<string[]>(passThroughCategories);
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (items.includes(trimmed)) {
      setMessage({ type: 'error', text: 'Item already exists' });
      return;
    }
    if (items.length >= 20) {
      setMessage({ type: 'error', text: 'Maximum of 20 items allowed' });
      return;
    }
    setItems([...items, trimmed]);
    setNewItem('');
    setMessage(null);
  };

  const handleRemove = (item: string) => {
    setItems(items.filter((i) => i !== item));
    setMessage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await updatePassThroughCategories(items);
      await refreshSettings();
      setMessage({ type: 'success', text: 'Pass-through items saved successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save pass-through items' });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    items.length !== passThroughCategories.length ||
    items.some((item, i) => item !== passThroughCategories[i]);

  return (
    <section id="pass-through" className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-[#1A1A2E] mb-1">Pass-Through Items</h2>
      <p className="text-sm text-[#6B7280] mb-6">
        Items listed here will be excluded when the Net Revenue toggle is active on Financial views.
      </p>

      {/* Add new item */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a category name..."
          className="flex-1 max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm text-[#1A1A2E] focus:border-[#4573D2] focus:ring-1 focus:ring-[#4573D2]/20 transition-colors"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newItem.trim()}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !newItem.trim()
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-[#4573D2] text-white hover:bg-[#3b62b5]'
          }`}
        >
          Add
        </button>
      </div>

      {/* Tag list */}
      <div className="flex flex-wrap gap-2 min-h-[40px]">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No pass-through items configured</p>
        ) : (
          items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-[#1A1A2E] rounded-full text-sm font-medium"
            >
              {item.replace(/_/g, ' ')}
              <button
                type="button"
                onClick={() => handleRemove(item)}
                className="w-4 h-4 rounded-full flex items-center justify-center text-gray-400 hover:text-[#D94F4F] hover:bg-gray-200 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))
        )}
      </div>

      {/* Save button and status */}
      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            saving || !hasChanges
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-[#4573D2] text-white hover:bg-[#3b62b5]'
          }`}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {message && (
          <p className={`text-sm font-medium ${message.type === 'success' ? 'text-[#6AAF50]' : 'text-[#D94F4F]'}`}>
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
