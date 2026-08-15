import { formatShortDate } from "../../lib/datetime.js";

/**
 * Week-on-week funnel: of the leads added to the Demo Calls list in a given
 * week, how many progressed to each next stage. Each row is a strict subset
 * of the one above it for a week that's fully played out, but a *recent*
 * week's numbers will keep rising as those leads progress after the fact —
 * this week's "Opportunity" column being low doesn't mean the funnel is
 * broken, it means those leads haven't had time to convert yet.
 *
 * `buckets` comes straight from weeklyFunnelTrend() (src/modules/demo-calls/
 * constants.js) — the same cohort data that module's own WeeklyTrendChart
 * plots, just read as a plain table here since Overview's other trend
 * (OverviewTrendTable) is already table-shaped and exact numbers matter more
 * than a visual shape for a stakeholder skimming this page.
 */
export function WeeklyFunnelTable({ buckets }) {
  const rows = [
    { key: "booked", label: "Number of Leads" },
    { key: "meetings_booked", label: "Meetings Booked" },
    { key: "call_1_done", label: "First Call" },
    { key: "added_to_pipeline", label: "Opportunity" },
  ];

  return (
    <div className="chart-card">
      <table className="overview-trend-table">
        <thead>
          <tr>
            <th>Week of</th>
            {buckets.map((b) => <th key={b.week_start} className="num">{formatShortDate(b.week_start)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="name-cell">{r.label}</td>
              {buckets.map((b) => <td key={b.week_start} className="num">{b[r.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
