// Pipeline error types, in their own module so the error->HTTP mapping in
// respond.js doesn't have to import the query layer to name them.
//
// respond.js only needed SourceLockedError to reference the class, but
// importing it from queries.js meant every consumer of respond.js pulled in
// the whole query module — and any test that mocked queries.js had to
// remember to re-export this class or respond.js would fail to evaluate.
// An error type has no dependencies; it belongs on its own.

/** Thrown when a caller tries to change a lead's `source` that was set automatically and locked. */
export class SourceLockedError extends Error {}
