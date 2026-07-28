/**
 * options: [{ value, label }]
 */
export function PeriodToggle({ options, value, onChange }) {
  return (
    <div className="tab-group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={opt.value === value ? "active" : ""}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
