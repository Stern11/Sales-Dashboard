// Date formatting shared by every module.
//
// relativeTime lived in both pipeline/constants.js and
// demo-calls/constants.js, and formatShortDate in both demo-calls/ and
// account-expansion/constants.js — byte-identical copies in each case. Each
// module's constants.js still re-exports the one it used, so call sites are
// unchanged and nobody has to remember which module "owns" a date helper.

/**
 * "just now" / "5m ago" / "3h ago" / "12d ago", falling back to an absolute
 * date past 30 days — beyond that, "47d ago" is harder to place than the
 * date itself.
 */
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

/**
 * A date-only column (`YYYY-MM-DD`) as "Aug 14, 2026".
 *
 * The `T00:00:00` suffix is load-bearing: `new Date("2026-08-14")` is parsed
 * as UTC midnight and renders as the previous day for anyone west of
 * Greenwich, while adding a time makes it parse in local time.
 */
export function formatShortDate(dateStr) {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
