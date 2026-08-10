import { useState } from "react";
import { FUNNEL_TREND_SERIES } from "./constants.js";

const WIDTH = 900;
const HEIGHT = 300;
const PAD_LEFT = 46; // room for both the tick numbers and a rotated axis title
const PAD_RIGHT = 12;
const PAD_TOP = 30; // room for month labels above the plot
const PAD_BOTTOM = 30;

function monthOf(weekStartIso) {
  return new Date(`${weekStartIso}T00:00:00Z`).getUTCMonth();
}
function monthLabel(weekStartIso) {
  return new Date(`${weekStartIso}T00:00:00Z`).toLocaleDateString(undefined, { month: "long", timeZone: "UTC" });
}

/**
 * Week-on-week comparison of the funnel stages (booked / call 1 / call 2 /
 * added to pipeline / irrelevant) — 5 series, so per the dataviz method a
 * legend is mandatory (past ~4 series, converging lines make direct labels
 * unreadable). Colors reuse this app's existing stage/status tokens
 * (FUNNEL_TREND_SERIES in constants.js) rather than a new palette.
 *
 * Every week gets its own gridline so week boundaries are never implied —
 * they're drawn. A bucket that starts a new calendar month gets a bolder,
 * dashed divider plus the month name above the plot, so "where does the
 * month change" is answered by the chart itself, not left to the reader to
 * count weeks. Hand-built SVG — the app has no charting library.
 */
export function WeeklyTrendChart({ buckets }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);

  const maxValue = Math.max(1, ...buckets.map((b) => Math.max(b.booked, b.call_1_done, b.call_2_done, b.added_to_pipeline, b.irrelevant)));
  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xFor = (i) => PAD_LEFT + (buckets.length === 1 ? plotW / 2 : (i / (buckets.length - 1)) * plotW);
  const yFor = (v) => PAD_TOP + plotH - (v / maxValue) * plotH;
  const slotW = plotW / buckets.length;

  // Capped at maxValue so a small range (e.g. max=2) never rounds two ticks
  // to the same integer — dedupe as a second guard against the same thing.
  const yTicks = Math.max(1, Math.min(4, maxValue));
  const tickValues = [...new Set(Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxValue * i) / yTicks)))];

  const monthStarts = buckets
    .map((b, i) => ({ i, isStart: i === 0 || monthOf(b.week_start) !== monthOf(buckets[i - 1].week_start) }))
    .filter((m) => m.isStart);

  // Position within its month (W1, W2, ...) rather than a calendar date —
  // resets to 1 at every month boundary computed above.
  const weekInMonth = [];
  for (let i = 0; i < buckets.length; i++) {
    const isMonthStart = i === 0 || monthOf(buckets[i].week_start) !== monthOf(buckets[i - 1].week_start);
    weekInMonth.push(isMonthStart ? 1 : weekInMonth[i - 1] + 1);
  }

  function pathFor(key) {
    return buckets.map((b, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(b[key])}`).join(" ");
  }

  function handleMove(e, i) {
    setHoverIdx(i);
    // The SVG scales responsively (viewBox 900 units -> however wide the
    // card actually renders), so the clamp below must use the card's real
    // rendered width, not the 900-unit WIDTH constant — mixing those two
    // coordinate spaces would clamp the tooltip in the wrong place on any
    // screen narrower than 900px.
    const rect = e.currentTarget.closest(".chart-card").getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, containerWidth: rect.width });
  }

  return (
    <div className="chart-card" style={{ position: "relative" }}>
      <div className="chart-legend">
        {FUNNEL_TREND_SERIES.map((s) => (
          <span key={s.key} className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label="Weekly demo call funnel trend">
        {/* Axis title — so the 0/1/2/3 ticks read as "N leads", not bare numbers. */}
        <text
          x={14} y={PAD_TOP + plotH / 2}
          textAnchor="middle" fontSize="10" fill="var(--text-muted)"
          transform={`rotate(-90, 14, ${PAD_TOP + plotH / 2})`}
        >
          Leads
        </text>
        {/* Horizontal value gridlines */}
        {tickValues.map((v, i) => (
          <g key={`y${i}`}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yFor(v)} y2={yFor(v)} stroke="var(--gridline)" strokeWidth="1" />
            <text x={PAD_LEFT - 8} y={yFor(v)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="var(--text-muted)">{v}</text>
          </g>
        ))}

        {/* One vertical line per week — every week boundary is drawn, not implied */}
        {buckets.map((b, i) => (
          <line key={`w${i}`} x1={xFor(i)} x2={xFor(i)} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke="var(--gridline)" strokeWidth="1" />
        ))}

        {/* Month boundaries — bolder dashed divider + name above the plot */}
        {monthStarts.map(({ i }) => (
          <g key={`m${i}`}>
            <line
              x1={xFor(i)} x2={xFor(i)} y1={PAD_TOP - 14} y2={PAD_TOP + plotH}
              stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3,3"
            />
            <text x={xFor(i) + 4} y={PAD_TOP - 18} fontSize="11.5" fontWeight="700" fill="var(--text-secondary)">
              {monthLabel(buckets[i].week_start)}
            </text>
          </g>
        ))}

        {FUNNEL_TREND_SERIES.map((s) => (
          <path key={s.key} d={pathFor(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {buckets.map((b, i) => (
          <g key={b.week_start}>
            {/* Transparent hit column — the crosshair's hit target is the whole week slot, not the 2px line. */}
            <rect
              x={xFor(i) - slotW / 2}
              y={PAD_TOP}
              width={slotW}
              height={plotH}
              fill="transparent"
              onMouseMove={(e) => handleMove(e, i)}
              onMouseLeave={() => { setHoverIdx(null); setTooltipPos(null); }}
            />
            {hoverIdx === i && (
              <rect x={xFor(i) - slotW / 2} y={PAD_TOP} width={slotW} height={plotH} fill="var(--page-plane)" opacity="0.6" pointerEvents="none" />
            )}
            {FUNNEL_TREND_SERIES.map((s) => (
              <circle
                key={s.key}
                cx={xFor(i)}
                cy={yFor(b[s.key])}
                r={hoverIdx === i ? 4 : 3}
                fill={s.color}
                stroke="var(--surface-1)"
                strokeWidth="2"
                pointerEvents="none"
              />
            ))}
            <text x={xFor(i)} y={HEIGHT - 10} textAnchor="middle" fontSize="10" fill="var(--text-muted)" pointerEvents="none">
              W{weekInMonth[i]}
            </text>
          </g>
        ))}
      </svg>
      {hoverIdx !== null && tooltipPos && (
        <div
          className="trend-tooltip"
          style={{
            left: Math.min(tooltipPos.x + 16, tooltipPos.containerWidth - 190),
            top: Math.max(tooltipPos.y - 10, 4),
          }}
        >
          <div className="trend-tooltip-title">W{weekInMonth[hoverIdx]} · {monthLabel(buckets[hoverIdx].week_start)}</div>
          {FUNNEL_TREND_SERIES.map((s) => (
            <div className="trend-tooltip-row" key={s.key}>
              <span className="trend-tooltip-key" style={{ background: s.color }} />
              <span className="trend-tooltip-label">{s.label}</span>
              <span className="trend-tooltip-value">{buckets[hoverIdx][s.key]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
