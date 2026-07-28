import { useState } from "react";

const DEFAULT_COLORS = ["var(--baseline)", "var(--seq-250)", "var(--seq-350)", "var(--seq-450)", "var(--seq-550)", "var(--seq-650)"];

/**
 * stages: [{ stage, count, formatted? }] — `formatted` overrides the display value (e.g. "$12,400").
 */
export function FunnelChart({ stages, colors = DEFAULT_COLORS }) {
  const [tooltip, setTooltip] = useState(null);
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="chart-card">
      {stages.map((s, i) => {
        const pct = Math.max((s.count / maxCount) * 100, s.count > 0 ? 2 : 0.6);
        const color = colors[i % colors.length];
        return (
          <div className="funnel-row" key={s.stage}>
            <div className="funnel-label">{s.stage}</div>
            <div className="funnel-track">
              <div
                className="funnel-bar"
                style={{ width: `${pct}%`, background: color }}
                onMouseMove={(e) =>
                  setTooltip({ x: e.clientX + 12, y: e.clientY + 12, text: `${s.stage}: ${s.formatted ?? s.count}` })
                }
                onMouseLeave={() => setTooltip(null)}
              />
            </div>
            <div className="funnel-count">{s.formatted ?? s.count}</div>
          </div>
        );
      })}
      {tooltip && (
        <div className="tooltip" style={{ display: "block", left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
