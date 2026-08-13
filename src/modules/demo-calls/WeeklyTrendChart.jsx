import { useState } from "react";
import { FUNNEL_TREND_SERIES } from "./constants.js";

const WIDTH = 900;
const HEIGHT = 300;
const PAD_LEFT = 46; // room for both the tick numbers and a rotated axis title
const PAD_RIGHT = 12;
const PAD_TOP = 30; // room for month labels above the plot
const PAD_BOTTOM = 30;

// Fraction of each week's slot left empty between one week's group of bars
// and the next, so groups read as visually separated clusters ("clear weekly
// segregation") rather than one continuous block.
const GROUP_PADDING_RATIO = 0.18;
// Gap between the bars within a single week's group.
const BAR_GAP = 2;
// Bars stay this slim even when only 1-2 weeks are visible and their slots
// are wide — otherwise a bar sized to fill its whole slot turns into a bulky
// block that dominates the chart instead of reading as a small multiple.
const MAX_BAR_WIDTH = 18;

function monthOf(weekStartIso) {
  return new Date(`${weekStartIso}T00:00:00Z`).getUTCMonth();
}
function monthLabel(weekStartIso) {
  return new Date(`${weekStartIso}T00:00:00Z`).toLocaleDateString(undefined, { month: "long", timeZone: "UTC" });
}

/**
 * Week-on-week comparison of the funnel stages, as a grouped bar chart — one
 * bar per series (booked / meeting 1 / added to pipeline; see
 * FUNNEL_TREND_SERIES in constants.js) per week, all 3 bars in a week sharing
 * one x-slot. Each series keeps one fixed color across every week (not one
 * color per week) with a legend mapping color to metric, since bars carry no
 * inline label of their own. Colors reuse this app's existing stage/status
 * tokens rather than a new palette.
 *
 * Every week gets its own gridline so week boundaries are never implied —
 * they're drawn — and a slice of each slot is left empty between groups so
 * adjacent weeks never visually merge. Weeks are numbered by position within
 * their own calendar month (W1, W2, ... resetting to 1 at every month
 * boundary — so "W3" always means "August's 3rd week", not "the 3rd column
 * of whatever window happens to be visible"), and a bucket that starts a new
 * calendar month gets a bolder, dashed divider plus the month name above the
 * plot. Hand-built SVG — the app has no charting library.
 */
export function WeeklyTrendChart({ buckets }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);

  const maxValue = Math.max(1, ...buckets.flatMap((b) => FUNNEL_TREND_SERIES.map((s) => b[s.key])));
  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const slotW = plotW / buckets.length;
  // Band scale, not a point scale: each week gets an equal-width slot tiled
  // across the plot, and xFor(i) is that slot's center. A point scale (which
  // the old line chart used — points spaced from 0 to plotW, anchored exactly
  // on the left/right plot edges) puts a bar *group*'s center right on the
  // edge, so with few weeks (wide slots) half the group spills outside the
  // plot area entirely.
  const xFor = (i) => PAD_LEFT + (i + 0.5) * slotW;
  const yFor = (v) => PAD_TOP + plotH - (v / maxValue) * plotH;
  const baselineY = yFor(0);
  // Bar width is capped, not just proportional to the slot — otherwise wide
  // slots (few weeks visible) produce bulky bars. groupW is then derived
  // from the actual (possibly capped) bar width, so the cluster stays
  // tightly centered in its slot rather than stretched to fill it.
  const idealGroupW = slotW * (1 - GROUP_PADDING_RATIO);
  const idealBarW = (idealGroupW - BAR_GAP * (FUNNEL_TREND_SERIES.length - 1)) / FUNNEL_TREND_SERIES.length;
  const barW = Math.min(idealBarW, MAX_BAR_WIDTH);
  const groupW = barW * FUNNEL_TREND_SERIES.length + BAR_GAP * (FUNNEL_TREND_SERIES.length - 1);

  // Capped at maxValue so a small range (e.g. max=2) never rounds two ticks
  // to the same integer — dedupe as a second guard against the same thing.
  const yTicks = Math.max(1, Math.min(4, maxValue));
  const tickValues = [...new Set(Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxValue * i) / yTicks)))];

  const monthStarts = buckets
    .map((b, i) => ({ i, isStart: i === 0 || monthOf(b.week_start) !== monthOf(buckets[i - 1].week_start) }))
    .filter((m) => m.isStart);

  // Position within its month (W1, W2, ...) — resets to 1 at every month
  // boundary computed above, rather than counting sequentially across the
  // whole visible window.
  const weekInMonth = [];
  for (let i = 0; i < buckets.length; i++) {
    const isMonthStart = i === 0 || monthOf(buckets[i].week_start) !== monthOf(buckets[i - 1].week_start);
    weekInMonth.push(isMonthStart ? 1 : weekInMonth[i - 1] + 1);
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
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label="Weekly meeting funnel trend">
        {/* Axis title — so the 0/1/2/3 ticks read as "N opportunities", not bare numbers. */}
        <text
          x={14} y={PAD_TOP + plotH / 2}
          textAnchor="middle" fontSize="10" fill="var(--text-muted)"
          transform={`rotate(-90, 14, ${PAD_TOP + plotH / 2})`}
        >
          Opportunities
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

        {buckets.map((b, i) => {
          const groupStart = xFor(i) - groupW / 2;
          return (
            <g key={b.week_start}>
              {/* Transparent hit column — the hover target is the whole week slot, not just the bars. */}
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
              {FUNNEL_TREND_SERIES.map((s, k) => {
                const barX = groupStart + k * (barW + BAR_GAP);
                const barY = yFor(b[s.key]);
                const barHeight = Math.max(0, baselineY - barY);
                // Tall enough to hold a 10px label with a little padding
                // (white, for contrast against the bar's own fill) — a bar
                // too short to fit one instead gets its label just above,
                // in the app's usual neutral ink.
                const labelFitsInside = barHeight >= 16;
                return (
                  <g key={s.key}>
                    <rect
                      x={barX}
                      y={barY}
                      width={barW}
                      height={barHeight}
                      rx="2"
                      fill={s.color}
                      pointerEvents="none"
                    />
                    <text
                      x={barX + barW / 2}
                      y={labelFitsInside ? barY + 12 : barY - 4}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill={labelFitsInside ? "#fff" : "var(--text-secondary)"}
                      pointerEvents="none"
                    >
                      {b[s.key]}
                    </text>
                  </g>
                );
              })}
              <text x={xFor(i)} y={HEIGHT - 10} textAnchor="middle" fontSize="10" fill="var(--text-muted)" pointerEvents="none">
                W{weekInMonth[i]}
              </text>
            </g>
          );
        })}
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
