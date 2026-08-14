import { bookedDateOf } from "../demo-calls/constants.js";

function monthKeyOf(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

function parseMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

/** monthKey `n` months after `key` (n may be negative). */
function shiftMonthKey(key, n) {
  const { year, month } = parseMonthKey(key);
  const total = year * 12 + (month - 1) + n;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function monthsBetween(fromKey, toKey) {
  const from = parseMonthKey(fromKey);
  const to = parseMonthKey(toKey);
  return (to.year * 12 + (to.month - 1)) - (from.year * 12 + (from.month - 1));
}

// Temporary floor on the trend's earliest possible month — same reasoning
// (and same mechanism) as MIN_TREND_WEEK_START in
// src/modules/demo-calls/constants.js: some existing leads carry old/
// backdated dates that would otherwise drag the window back into months
// with no meaningful activity. Exposed as a buildMonthlyOverview() parameter
// (not hardcoded inline) so tests can exercise the underlying grow/cap/roll
// logic on its own, independent of this business-specific date.
export const MIN_TREND_MONTH_START = "2026-07";

/**
 * Cross-module monthly trend for the Overview page — Meetings Booked and
 * Opportunities/Pipeline/Closed Won, the only rows with a reliable per-record
 * date to bucket by (Demo Calls' bookedDateOf(), Sales Pipeline's created_at
 * and won_at). Marketing/ABM are live HubSpot reads with no comparable
 * historical date field in what this app already fetches, so they're
 * deliberately left out of this trend and shown as snapshot-only KPI cards
 * instead (see OverviewPage.jsx) — inventing a fake trend for them would be
 * worse than not having one.
 *
 * Same growing-window shape as weeklyFunnelTrend() in
 * src/modules/demo-calls/constants.js: starts at the later of the earliest
 * month with real data or `floorMonthKey` (so the chart never opens on a
 * wall of empty months from old/backdated records), grows one column per
 * month as time passes, caps at `maxMonths`, then rolls forward — current
 * month is always the last column.
 */
export function buildMonthlyOverview(pipelineLeads, demoCallLeads, maxMonths = 12, floorMonthKey = MIN_TREND_MONTH_START) {
  const now = new Date();
  const currentKey = monthKeyOf(now);

  const candidateDates = [
    ...demoCallLeads.map(bookedDateOf).filter(Boolean),
    ...pipelineLeads.map((l) => l.created_at).filter(Boolean),
    ...pipelineLeads.map((l) => l.won_at).filter(Boolean),
  ];

  let monthsToShow = 1;
  if (candidateDates.length) {
    // Earliest key wins a reduce pass: monthsBetween(key, earliest) > 0
    // means `earliest` sits *after* `key` (`key` is the earlier of the two),
    // so `key` becomes the new running earliest.
    const rawEarliestKey = candidateDates
      .map((iso) => monthKeyOf(new Date(iso)))
      .reduce((earliest, key) => (monthsBetween(key, earliest) > 0 ? key : earliest));
    const earliestKey = monthsBetween(floorMonthKey, rawEarliestKey) > 0 ? rawEarliestKey : floorMonthKey;
    const spanMonths = monthsBetween(earliestKey, currentKey) + 1;
    monthsToShow = Math.min(maxMonths, Math.max(1, spanMonths));
  }

  const startKey = shiftMonthKey(currentKey, -(monthsToShow - 1));
  const buckets = new Map();
  for (let i = 0; i < monthsToShow; i++) {
    const key = shiftMonthKey(startKey, i);
    buckets.set(key, { key, label: monthLabel(key), meetingsBooked: 0, opportunities: 0, pipelineAdded: 0, closedWon: 0 });
  }

  for (const l of demoCallLeads) {
    const bookedDate = bookedDateOf(l);
    if (!bookedDate) continue;
    const bucket = buckets.get(monthKeyOf(new Date(bookedDate)));
    if (bucket) bucket.meetingsBooked += 1;
  }

  for (const l of pipelineLeads) {
    if (l.created_at) {
      const bucket = buckets.get(monthKeyOf(new Date(l.created_at)));
      if (bucket) {
        bucket.opportunities += 1;
        bucket.pipelineAdded += Number(l.deal_size) || 0;
      }
    }
    if (l.won_at) {
      const bucket = buckets.get(monthKeyOf(new Date(l.won_at)));
      if (bucket) bucket.closedWon += Number(l.deal_size) || 0;
    }
  }

  return [...buckets.values()];
}
