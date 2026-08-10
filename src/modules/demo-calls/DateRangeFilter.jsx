import { PeriodToggle } from "../../components/PeriodToggle.jsx";
import { BOOKED_PERIOD_OPTIONS } from "./constants.js";

/**
 * Preset row (This Week / This Month / All Time / Custom Range) reusing
 * PeriodToggle as-is, plus two native date inputs that only appear once
 * "Custom Range" is selected. The resolved {from, to} range lives in the
 * parent (DemoCallsPage.jsx via resolvePeriodRange) — this component only
 * owns which preset is picked and the raw custom-range input strings.
 */
export function DateRangeFilter({ period, onPeriodChange, customFrom, customTo, onCustomFromChange, onCustomToChange }) {
  return (
    <div className="pipeline-toolbar-group">
      <PeriodToggle options={BOOKED_PERIOD_OPTIONS} value={period} onChange={onPeriodChange} />
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
