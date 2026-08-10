// Frontend-facing mirror of lib/demo-calls/constants.js — labels, order, and
// pill colors for the UI. See src/modules/pipeline/constants.js for the
// pattern this follows.

export const OUTCOME_OPTIONS = [
  { value: "completed", label: "Completed", pillVariant: "ready" },
  { value: "no_show", label: "No Show", pillVariant: "lost" },
];

export function outcomeMeta(value) {
  return OUTCOME_OPTIONS.find((o) => o.value === value) || { value, label: value, pillVariant: "stage" };
}

// "no_show" isn't a real value of the `status` column (that's still just
// active/irrelevant, set only by the explicit Mark Irrelevant/Reactivate
// action) — it's a *displayed* state folded in by effectiveStatus() below,
// so a lead whose most recent call was a no-show never reads as plain
// "Active" and can't be added to pipeline until that's resolved.
export const STATUS_OPTIONS = [
  { value: "active", label: "Active", pillVariant: "stage" },
  { value: "no_show", label: "No Show", pillVariant: "lost" },
  { value: "irrelevant", label: "Irrelevant", pillVariant: "lost" },
];

export function statusMeta(value) {
  return STATUS_OPTIONS.find((o) => o.value === value) || { value, label: value, pillVariant: "stage" };
}

/**
 * The status actually shown to a rep: the raw `status` column
 * (active/irrelevant) with "the last logged call was a no-show" folded in
 * as its own state. Irrelevant always wins (a rep marked it irrelevant on
 * purpose); otherwise a no-show last call overrides "Active" — a lead
 * nobody showed up for isn't accurately "active" until that's followed up
 * on, and it shouldn't be handed to Sales Pipeline in that state either
 * (see the "Add to pipeline" gating in DemoCallLeadDrawer.jsx).
 */
export function effectiveStatus(status, lastCallOutcome) {
  if (status === "irrelevant") return "irrelevant";
  if (lastCallOutcome === "no_show") return "no_show";
  return "active";
}

// Mirrors lib/demo-calls/constants.js / src/modules/pipeline/constants.js —
// same vocabulary as Sales Pipeline's company scale field.
export const COMPANY_SCALE_OPTIONS = [
  { value: "startup", label: "Startup (<50 employees)" },
  { value: "smb", label: "SMB (50–200)" },
  { value: "mid_market", label: "Mid-Market (200–1000)" },
  { value: "enterprise", label: "Enterprise (1000+)" },
];

export function scaleLabel(value) {
  return COMPANY_SCALE_OPTIONS.find((o) => o.value === value)?.label || "—";
}

/**
 * `dateStr` is a plain "YYYY-MM-DD" string (see call_date::text in
 * lib/demo-calls/queries.js). Parsed with an explicit local-midnight time
 * component (no "Z") so it's interpreted in the browser's local timezone —
 * `new Date("YYYY-MM-DD")` alone is parsed as UTC per the JS spec, which
 * displays a day early in any timezone behind UTC.
 */
export function formatCallDate(dateStr) {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" });
}

/** Mirrors summarize() in lib/demo-calls/queries.js — recomputed client-side for whatever filter is currently applied. */
export function summarizeLeads(leads) {
  const active = leads.filter((l) => l.status === "active");
  const callCount = (l) => Number(l.call_count) || 0;
  return {
    total: leads.length,
    awaiting_first_call: active.filter((l) => callCount(l) === 0).length,
    call_1_done: active.filter((l) => callCount(l) >= 1).length,
    call_2_done: active.filter((l) => callCount(l) >= 2).length,
    call_3_done: active.filter((l) => callCount(l) >= 3).length,
    no_shows: leads.reduce((sum, l) => sum + (Number(l.no_show_count) || 0), 0),
    added_to_pipeline: leads.filter((l) => l.pipeline_lead_id).length,
    irrelevant: leads.filter((l) => l.status === "irrelevant").length,
    by_scale: {
      startup: leads.filter((l) => l.company_scale === "startup").length,
      smb: leads.filter((l) => l.company_scale === "smb").length,
      mid_market: leads.filter((l) => l.company_scale === "mid_market").length,
      enterprise: leads.filter((l) => l.company_scale === "enterprise").length,
      unspecified: leads.filter((l) => !l.company_scale).length,
    },
  };
}

// Pure UTC-anchored date arithmetic for week-bucketing — a lead's
// created_at is a real instant (timestamptz), but bucketing it into
// Monday-start weeks stays simplest and least error-prone by treating the
// resulting calendar day as UTC consistently end to end (see the call_date
// timezone-shift bug this app already hit once — lib/demo-calls/queries.js).
function toUtcDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function mondayOfUtcWeek(date) {
  const day = date.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}
function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

/** One line per series in the weekly funnel trend chart — fixed order/color, reusing this app's existing stage/status tokens rather than a new palette. */
export const FUNNEL_TREND_SERIES = [
  { key: "booked", label: "Booked", color: "var(--stage-sql)" },
  { key: "call_1_done", label: "Call 1 Done", color: "var(--stage-discovery)" },
  { key: "call_2_done", label: "Call 2 Done", color: "var(--stage-commercial)" },
  { key: "added_to_pipeline", label: "Added to Pipeline", color: "var(--stage-won)" },
  { key: "irrelevant", label: "Irrelevant", color: "var(--stage-lost)" },
];

/**
 * Week-on-week cohort breakdown for the last `weeks` Monday-start weeks,
 * computed entirely client-side from the already-fetched `leads` array (no
 * new backend endpoint — same "aggregate what's already in hand" approach
 * ABM's Overall Effort totals use, see docs/ARCHITECTURE.md). Each week
 * bucket is the *current* state of leads booked (created_at) that week —
 * same cohort semantics as the "Booked" date filter above, just plotted
 * across many weeks side by side instead of one filtered snapshot.
 */
export function weeklyFunnelTrend(leads, weeks = 12) {
  const currentWeekStart = mondayOfUtcWeek(new Date());
  const buckets = new Map();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(currentWeekStart);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const week_start = isoDate(d);
    buckets.set(week_start, { week_start, booked: 0, call_1_done: 0, call_2_done: 0, added_to_pipeline: 0, irrelevant: 0 });
  }

  for (const l of leads) {
    if (!l.created_at) continue;
    const dayStr = new Date(l.created_at).toISOString().slice(0, 10);
    const key = isoDate(mondayOfUtcWeek(toUtcDate(dayStr)));
    const bucket = buckets.get(key);
    if (!bucket) continue; // booked before the visible window
    bucket.booked += 1;
    // Matches summarizeLeads()'s semantics: call progress is only counted
    // for currently-active leads (irrelevant is its own bucket, a side
    // branch — same "active vs. side-state" split Sales Pipeline uses for
    // cold/lost) — otherwise the two charts would disagree on "Call 1 Done".
    if (l.status === "active") {
      const callCount = Number(l.call_count) || 0;
      if (callCount >= 1) bucket.call_1_done += 1;
      if (callCount >= 2) bucket.call_2_done += 1;
    }
    if (l.pipeline_lead_id) bucket.added_to_pipeline += 1;
    if (l.status === "irrelevant") bucket.irrelevant += 1;
  }

  return [...buckets.values()];
}

// Rolling windows, not calendar-aligned — matches the only other period
// control in the app (Performance Marketing's Lifetime/Monthly/Weekly
// toggle, `windowFilters()` in api/sources/index.js: "last 30/7 days from
// now", not Monday-aligned weeks or 1st-of-month).
export const BOOKED_PERIOD_OPTIONS = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

/**
 * Resolves a period selection to a {from, to} Date range (either bound may
 * be null, meaning unbounded). "week"/"month" are rolling windows ending
 * now; "custom" parses the two <input type="date"> value strings (`to` is
 * treated as inclusive of that whole day); "all" (or an unrecognized value)
 * is fully unbounded.
 */
export function resolvePeriodRange(period, customFrom, customTo) {
  const now = new Date();
  if (period === "week") return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: null };
  if (period === "month") return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: null };
  if (period === "custom") {
    const from = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
    const to = customTo ? new Date(`${customTo}T23:59:59.999`) : null;
    return { from, to };
  }
  return { from: null, to: null };
}

/** Inclusive bounds check used to filter leads by created_at against a resolved range. */
export function isWithinRange(isoString, from, to) {
  if (!isoString) return false;
  const t = new Date(isoString).getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

export function relativeTime(isoString) {
  if (!isoString) return "—";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}
