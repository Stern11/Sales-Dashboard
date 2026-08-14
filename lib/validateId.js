// Every id in this app's schema is a `uuid` column (see db/schema.sql), and
// Postgres rejects a non-UUID string with error 22P02 rather than simply
// matching no rows. That surfaced as a 500 carrying the raw PG message —
// `GET /api/pipeline/notauuid` returned "invalid input syntax for type uuid"
// to the browser — where the honest answer is 404: there is no such record.
//
// Checking the shape here also keeps malformed input from reaching the
// database at all.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True if `id` is a syntactically valid UUID. */
export function isUuid(id) {
  return typeof id === "string" && UUID_RE.test(id);
}
