import { PipelineDbConfigError } from "../db.js";

/**
 * Account Expansion data is mutable, rep-edited planning state — same
 * reasoning as lib/pipeline/respond.js's setNoStoreCacheHeader: a stale
 * cache here would show an expansion area/signal that "snaps back" right
 * after a write.
 */
export function setNoStoreCacheHeader(res) {
  res.setHeader("Cache-Control", "no-store");
}

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

/** Maps account-expansion-specific errors to HTTP status, mirroring lib/demo-calls/respond.js. */
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
    } else {
      res.status(500).json({ error: String((err && err.message) || err) });
    }
  }
}
