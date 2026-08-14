import { currency } from "../pipeline/constants.js";

/**
 * Quarter-by-quarter metric table — plain HTML table (inherits the app's
 * base table styles from global.css) rather than the DataTable component,
 * which is built for searchable/sortable rows-of-leads, not this compact
 * metric-by-quarter matrix. `buckets` comes from buildQuarterlyOverview()
 * (overviewMath.js), already sized to whatever the growing window currently
 * shows — this component just renders whatever it's handed.
 */
export function OverviewTrendTable({ buckets }) {
  const rows = [
    { key: "meetingsBooked", label: "Meetings Booked", format: (v) => v },
    { key: "opportunities", label: "Opportunities", format: (v) => v },
    { key: "pipelineAdded", label: "Pipeline Added", format: (v) => currency.format(v), tinted: true },
    { key: "closedWon", label: "Closed Won", format: (v) => currency.format(v), tinted: true },
  ];

  return (
    <div className="chart-card">
      <table className="overview-trend-table">
        <thead>
          <tr>
            <th>Metric</th>
            {buckets.map((b) => <th key={b.key} className="num">{b.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.tinted ? "tinted" : undefined}>
              <td className="name-cell">{r.label}</td>
              {buckets.map((b) => <td key={b.key} className="num">{r.format(b[r.key])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
