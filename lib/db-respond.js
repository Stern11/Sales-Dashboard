// Shared error->HTTP mapping for the three database-backed modules
// (pipeline, demo-calls, account-expansion).
//
// These were three separate files that had drifted into being the same file
// with different strings — except account-expansion had silently lost the
// 23505 branch, so a unique-constraint violation there returned 500 where
// the other two returned 409. Consolidating removes the class of bug where a
// fix lands in two of three copies. The only genuine per-module difference,
// the conflict message, is a parameter.
//
// Each module still keeps its own respond.js re-exporting this, so route
// handlers' imports are unchanged and the error classes stay nominally
// distinct per module.

import { PipelineDbConfigError } from "./db.js";
import { ActorError } from "./auth/actor.js";

/**
 * Database-backed modules hold mutable, user-edited operational state, so
 * every response opts out of caching entirely — unlike the HubSpot modules'
 * 5-minute edge cache (setLiveCacheHeader in lib/respond.js). A stale cache
 * here would show a record that "snaps back" right after a write.
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

/**
 * Builds a `withDbErrorHandling(res, fn)` for one module.
 *
 * `conflictMessage` is what a 23505 unique-constraint violation reports when
 * the handler didn't catch the duplicate itself first.
 *
 * `extraHandlers` maps additional module-specific error constructors to
 * {status, body} — pipeline uses it for SourceLockedError. Passed in rather
 * than imported here so this module stays free of per-module dependencies.
 */
export function createDbErrorHandling({ conflictMessage, extraHandlers = [] }) {
  return async function withDbErrorHandling(res, fn) {
    try {
      const payload = await fn();
      setNoStoreCacheHeader(res);
      res.status(200).json(payload);
    } catch (err) {
      setNoStoreCacheHeader(res);

      for (const { type, status, body } of extraHandlers) {
        if (err instanceof type) {
          res.status(status).json(body(err));
          return;
        }
      }

      if (err instanceof ActorError) {
        res.status(401).json({ error: "Not authenticated." });
      } else if (err instanceof PipelineDbConfigError) {
        // Deliberately surfaced verbatim: it's a deployment-configuration
        // message written for whoever is setting the app up, and it contains
        // no request data or database internals.
        res.status(500).json({ error: err.message });
      } else if (err instanceof ValidationError) {
        res.status(400).json({ error: err.message });
      } else if (err instanceof NotFoundError) {
        res.status(404).json({ error: err.message });
      } else if (err instanceof ConflictError) {
        res.status(409).json({ error: err.message, existing_lead: err.existingLead });
      } else if (err && err.code === "23505") {
        res.status(409).json({ error: conflictMessage });
      } else {
        // Anything unrecognized is an internal fault, and its message tends
        // to be a raw Postgres error — column names, constraint names,
        // SQLSTATE text — or a full upstream HubSpot response body. That is
        // useful in logs and not something to hand to a browser, so it's
        // logged here and the client gets a fixed string.
        console.error("Unhandled API error:", err);
        res.status(500).json({ error: "Something went wrong. Please try again." });
      }
    }
  };
}
