import { PipelineDbConfigError } from "../db.js";

/**
 * Demo Calls data is mutable, user-edited operational state — same reasoning
 * as lib/pipeline/respond.js's setNoStoreCacheHeader: a stale cache here
 * would show a call log that "snaps back" right after a write.
 */
export function setNoStoreCacheHeader(res) {
  res.setHeader("Cache-Control", "no-store");
}

export class ValidationError extends Error {}
export class NotFoundError extends Error {}
export class ConflictError extends Error {
  constructor(message, existingLead) {
    super(message);
    this.existingLead = existingLead;
  }
}

/** Maps demo-calls-specific errors to HTTP status, mirroring lib/pipeline/respond.js. */
export async function withDbErrorHandling(res, fn) {
  try {
    const payload = await fn();
    setNoStoreCacheHeader(res);
    res.status(200).json(payload);
  } catch (err) {
    if (err instanceof PipelineDbConfigError) {
      res.status(500).json({ error: err.message });
    } else if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
    } else if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
    } else if (err instanceof ConflictError) {
      res.status(409).json({ error: err.message, existing_lead: err.existingLead });
    } else if (err && err.code === "23505") {
      res.status(409).json({ error: "A demo call lead for this contact already exists." });
    } else {
      res.status(500).json({ error: String((err && err.message) || err) });
    }
  }
}
