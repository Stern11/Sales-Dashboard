import { PeriodToggle } from "./PeriodToggle.jsx";

/**
 * Preset row reusing PeriodToggle as-is, plus two native date inputs that
 * only appear once the "custom" option (whichever entry in `options` has
 * value "custom") is picked. The resolved {from, to} range/URL params live
 * in the parent — this component only owns which preset is selected and the
 * raw custom-range input strings.
 *
 * Shared between Demo Calls (BOOKED_PERIOD_OPTIONS) and Performance
 * Marketing (its own Lifetime/Monthly/Weekly/Custom Range options) — the
 * picker itself doesn't care what the presets mean, only that one of them is
 * named "custom".
 */
export function DateRangeFilter({ options, period, onPeriodChange, customFrom, customTo, onCustomFromChange, onCustomToChange }) {
  return (
    <div className="pipeline-toolbar-group">
      <PeriodToggle options={options} value={period} onChange={onPeriodChange} />
      {period === "custom" && (
        <>
          <input type="date" value={customFrom} onChange={(e) => onCustomFromChange(e.target.value)} aria-label="From date" />
          <span className="subtitle">to</span>
          <input type="date" value={customTo} onChange={(e) => onCustomToChange(e.target.value)} aria-label="To date" />
        </>
      )}
    </div>
  );
}
