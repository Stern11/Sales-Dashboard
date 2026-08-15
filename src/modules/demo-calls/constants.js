// Frontend-facing mirror of lib/demo-calls/constants.js — labels, order, and
// pill colors for the UI. See src/modules/pipeline/constants.js for the
// pattern this follows.

export const OUTCOME_OPTIONS = [
  { value: "completed", label: "Completed", pillVariant: "ready" },
  { value: "no_show", label: "No Show", pillVariant: "lost" },
  { value: "scheduled", label: "Scheduled", pillVariant: "stage" },
];

export function outcomeMeta(value) {
  return OUTCOME_OPTIONS.find((o) => o.value === value) || { value, label: value, pillVariant: "stage" };
}

/**
 * A call_date strictly after today (the browser's local calendar date) hasn't
 * happened yet, so it can't have a real Completed/No Show outcome — see
 * outcomeOptionsFor() below, which is what actually enforces this in the call
 * forms (AddDemoCallLeadModal's inline first call, CallLogTimeline's
 * CallForm).
 */
export function isFutureCallDate(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${dateStr}T00:00:00`) > today;
}

/**
 * The outcome choices valid for a given call_date: a future date can only be
 * "Scheduled" (the meeting hasn't happened yet, so Completed/No Show would be
 * a lie); any other date can be Completed/No Show but not "Scheduled" (once a
 * date has arrived or passed, the call either happened or didn't).
 */
export function outcomeOptionsFor(dateStr) {
  return isFutureCallDate(dateStr)
    ? OUTCOME_OPTIONS.filter((o) => o.value === "scheduled")
    : OUTCOME_OPTIONS.filter((o) => o.value !== "scheduled");
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

// Mirrors lib/demo-calls/constants.js — where a manually-entered lead
// actually came from, same dropdown-plus-"Other" pattern as Sales Pipeline's
// own SOURCE_CATEGORIES (src/modules/pipeline/constants.js). Only relevant
// to manual entry — a lead detected live from HubSpot already has its
// origin captured by hubspot_origin_module (which view surfaced it).
export const SOURCE_CATEGORIES = ["Website Inbound", "Referral", "ABM", "Event", "Ads", "Partner", "Demo Call"];
export const SOURCE_OTHER = "Other";

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

/** Same parsing as formatCallDate(), compact — for table cells rather than a detail page. */

/**
 * The date a lead counts as "booked" — when it was added to the Demo Calls
 * list (demo_call_leads.created_at), not when its first call happened.
 *
 * This used to prefer the call log's first_call_date when one existed, on
 * the theory that a backfilled/imported lead's row-insert time could land
 * weeks after its real meeting. In practice that made "booked" mean two
 * different things depending on whether a call had been logged yet, so the
 * same KPI/date filter silently changed definition under a rep's feet. Now
 * it's always created_at: "Booked" answers "when did this enter the demo
 * call list", full stop. "First Call" is tracked separately (first_call_date
 * / first_call_outcome, driven entirely by the call_date a rep enters when
 * logging it) and isn't affected by this.
 */
export function bookedDateOf(lead) {
  return lead.created_at;
}

/** Mirrors summarize() in lib/demo-calls/queries.js — recomputed client-side for whatever filter is currently applied. */
export function summarizeLeads(leads) {
  const active = leads.filter((l) => l.status === "active");
  const callCount = (l) => Number(l.call_count) || 0;
  return {
    total: leads.length,
    awaiting_first_call: active.filter((l) => callCount(l) === 0).length,
    // "Meeting N Done" means call #N *itself* was completed — not merely
    // "N or more calls have been completed somewhere in this lead's history".
    // A lead whose first call was a no-show and second call succeeded must
    // not count toward "First Meeting Done" (it does count toward "Second
    // Meeting Done") — that completion was call #2, not call #1.
    call_1_done: active.filter((l) => l.first_call_outcome === "completed").length,
    call_2_done: active.filter((l) => l.second_call_outcome === "completed").length,
    call_3_done: active.filter((l) => l.third_call_outcome === "completed").length,
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

/**
 * One bar per series in the weekly funnel trend chart — fixed order/color,
 * reusing this app's existing stage/status tokens rather than a new palette.
 * Only 3 of the 6 metrics weeklyFunnelTrend() computes per week are charted
 * here (Booked, Meeting 1 Done, Added to Pipeline) — Meeting 2 Done,
 * Irrelevant, and Meetings Booked (the Overview page's own weekly funnel
 * table uses that last one instead) are dropped to keep each week's group of
 * bars readable. The bucket objects carry all of them either way.
 */
export const FUNNEL_TREND_SERIES = [
  { key: "booked", label: "Booked", color: "var(--stage-sql)" },
  { key: "call_1_done", label: "Meeting 1 Done", color: "var(--stage-discovery)" },
  { key: "added_to_pipeline", label: "Added to Pipeline", color: "var(--stage-won)" },
];

// Temporary floor on the trend window's earliest possible week — some
// existing leads carry old/backdated booked dates (data-entry artifacts from
// before this module's real usage) that would otherwise drag the window back
// into months with no meaningful activity. Remove once that old data is
// cleaned up or the window naturally grows past it on its own. Exposed as a
// weeklyFunnelTrend() parameter (not hardcoded inline) so tests can exercise
// the underlying grow/cap/roll logic on its own, independent of this
// temporary business-specific date.
export const MIN_TREND_WEEK_START = "2026-08-03";

/**
 * Floor for the "Not Logged" virtual rows on the Meetings page (see
 * useLiveDemoCallContacts.js) — a contact that reached the Demo Call stage
 * before this date is old backlog nobody's following up on and, unlike a
 * tracked lead, has no dismiss/mark-irrelevant action of its own to clear it
 * with. One-time cleanup per product decision (2026-08-15); raise it again
 * by hand if the backlog piles up the same way in the future.
 */
export const MIN_LIVE_CONTACT_DATE = "2026-08-01";

/**
 * Week-on-week cohort breakdown, computed entirely client-side from the
 * already-fetched `leads` array (no new backend endpoint — same "aggregate
 * what's already in hand" approach ABM's Overall Effort totals use, see
 * docs/ARCHITECTURE.md). Each week bucket is the *current* state of leads
 * booked (bookedDateOf() above) that week — same cohort semantics as the
 * "Booked" date filter above, just plotted across many weeks side by side
 * instead of one filtered snapshot.
 *
 * The window isn't a fixed trailing range: it starts at the Monday-aligned
 * week of the very first booked lead (never earlier than `floorWeekStartIso`
 * — see MIN_TREND_WEEK_START above — so the chart never opens on a wall of
 * empty weeks/months before any real data exists), grows by one column each
 * week as time passes, and once it reaches `maxWeeks` it rolls forward —
 * always dropping the oldest week and keeping the current week as the last
 * column.
 */
export function weeklyFunnelTrend(leads, maxWeeks = 8, floorWeekStartIso = MIN_TREND_WEEK_START) {
  const currentWeekStart = mondayOfUtcWeek(new Date());
  const floorWeekStart = toUtcDate(floorWeekStartIso);
  const bookedWeekStarts = leads
    .map(bookedDateOf)
    .filter(Boolean)
    .map((iso) => mondayOfUtcWeek(toUtcDate(new Date(iso).toISOString().slice(0, 10))));

  let weeksToShow = 1;
  if (bookedWeekStarts.length) {
    const rawEarliestWeekStart = new Date(Math.min(...bookedWeekStarts.map((d) => d.getTime())));
    const earliestWeekStart = rawEarliestWeekStart.getTime() > floorWeekStart.getTime() ? rawEarliestWeekStart : floorWeekStart;
    const spanWeeks = Math.round((currentWeekStart.getTime() - earliestWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    weeksToShow = Math.min(maxWeeks, Math.max(1, spanWeeks));
  }

  const buckets = new Map();
  for (let i = weeksToShow - 1; i >= 0; i--) {
    const d = new Date(currentWeekStart);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const week_start = isoDate(d);
    buckets.set(week_start, { week_start, booked: 0, meetings_booked: 0, call_1_done: 0, call_2_done: 0, added_to_pipeline: 0, irrelevant: 0 });
  }

  for (const l of leads) {
    const bookedDate = bookedDateOf(l);
    if (!bookedDate) continue;
    const dayStr = new Date(bookedDate).toISOString().slice(0, 10);
    const key = isoDate(mondayOfUtcWeek(toUtcDate(dayStr)));
    const bucket = buckets.get(key);
    if (!bucket) continue; // booked before the visible window
    bucket.booked += 1;
    // "Of this week's leads, how many have an actual call scheduled/logged"
    // — the funnel's second stage (see the Overview page's weekly funnel).
    // Unlike call_1_done below, this isn't gated on status === "active": a
    // call having been booked is a fact about what happened, and doesn't
    // get erased by the lead later being marked irrelevant.
    if ((Number(l.call_count) || 0) > 0) bucket.meetings_booked += 1;
    // Matches summarizeLeads()'s semantics: call progress is only counted
    // for currently-active leads (irrelevant is its own bucket, a side
    // branch — same "active vs. side-state" split Sales Pipeline uses for
    // cold/lost) — otherwise the two charts would disagree on "Meeting 1
    // Done". Checks call #N's own outcome, not merely "N calls completed
    // somewhere" — a no-show on call 1 followed by a completed call 2 counts
    // toward Meeting 2 Done, never Meeting 1 Done.
    if (l.status === "active") {
      if (l.first_call_outcome === "completed") bucket.call_1_done += 1;
      if (l.second_call_outcome === "completed") bucket.call_2_done += 1;
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

/** Inclusive bounds check used to filter leads by a date/timestamp string (e.g. bookedDateOf()) against a resolved range. */
export function isWithinRange(isoString, from, to) {
  if (!isoString) return false;
  const t = new Date(isoString).getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

// Shared with the other modules — see src/lib/datetime.js.
export { relativeTime, formatShortDate } from "../../lib/datetime.js";
