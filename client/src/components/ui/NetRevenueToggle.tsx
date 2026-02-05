export default function NetRevenueToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <span className="text-xs font-medium text-[#6B7280]">Net Revenue</span>
      <button
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative w-9 h-5 rounded-full transition-colors ${
          enabled ? 'bg-[#4573D2]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}
