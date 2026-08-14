// Value coercions shared by the query modules.

/**
 * Turns an empty string into null, leaving everything else alone.
 *
 * HTML form fields submit "" for "not filled in", but a nullable column
 * means null — and the two are not the same to SQL: `where region is null`
 * doesn't match "", and a `numeric` or `date` column rejects "" outright.
 *
 * This was defined identically in lib/demo-calls/queries.js and
 * lib/account-expansion/queries.js, and was simply missing from
 * lib/pipeline/queries.js — which is why Pipeline stored "" for a cleared
 * optional field where the other two stored null. A real behavioural
 * divergence, hidden inside a duplicated four-line helper.
 *
 * Apply only to nullable columns. Pipeline's company_name / contact_name /
 * source are NOT NULL (db/schema.sql), so passing "" through this for them
 * would turn a constraint the form already enforces into a 500.
 */
export function blankToNull(v) {
  return v === "" ? null : v;
}
