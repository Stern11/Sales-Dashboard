// Weekly/monthly period bucketing used by the Pipeline module's trend charts.

/**
 * Builds `count` consecutive buckets of `period` ("weekly" | "monthly"),
 * oldest first, ending at "now". Each bucket is a half-open [start, end) range.
 */
export function buildPeriodBuckets(period, count) {
  const now = new Date();
  const buckets = [];
  if (period === "monthly") {
    for (let i = count - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      buckets.push({ label: start.toLocaleDateString(undefined, { month: "short" }), start, end });
    }
  } else {
    for (let i = count - 1; i >= 0; i--) {
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
      const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7);
      buckets.push({ label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }), start, end });
    }
  }
  return buckets;
}

/** Index of the bucket `dateStr` falls into, or -1 if outside every bucket's range. */
export function bucketIndexFor(dateStr, buckets) {
  if (!dateStr) return -1;
  const d = new Date(dateStr);
  return buckets.findIndex((b) => d >= b.start && d < b.end);
}
