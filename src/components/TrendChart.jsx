import { useState } from "react";

/**
 * points: [{ label, value, formatted? }] — plain CSS bar chart, no charting library.
 */
export function TrendChart({ points }) {
  const [tooltip, setTooltip] = useState(null);
  const maxValue = Math.max(...points.map((p) => p.value), 1);

  return (
    <div className="chart-card">
      <div className="trend-chart">
        {points.map((p) => {
          const pct = Math.max((p.value / maxValue) * 100, p.value > 0 ? 2 : 0);
          return (
            <div className="trend-bar-wrap" key={p.label}>
              <div
                className="trend-bar"
                style={{ height: `${pct}%` }}
                onMouseMove={(e) =>
                  setTooltip({ x: e.clientX + 12, y: e.clientY + 12, text: `${p.label}: ${p.formatted ?? p.value}` })
                }
                onMouseLeave={() => setTooltip(null)}
              />
              <div className="trend-bar-label">{p.label}</div>
            </div>
          );
        })}
      </div>
      {tooltip && (
        <div className="tooltip" style={{ display: "block", left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
