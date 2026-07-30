import { PipelineDbConfigError } from "../db.js";
import { SourceLockedError } from "./queries.js";

/**
 * Pipeline data is mutable, user-edited operational state — unlike the
 * HubSpot modules' 5-minute edge cache (lib/respond.js's
 * setLiveCacheHeader), a stale cache here would show a card that "snaps
 * back" right after a write. Every pipeline response opts out entirely.
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

/** Maps pipeline-specific errors to HTTP status, mirroring withHubspotErrorHandling. */
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
    } else if (err instanceof SourceLockedError) {
      res.status(400).json({ error: err.message });
    } else if (err && err.code === "23505") {
      // Unique-constraint violation — only pipeline_leads_hubspot_contact_id_uq
      // is set up to fire this in practice. Callers that need the existing
      // lead's id/stage for a 409 body should check via checkContactIds()
      // before insert rather than parsing this generic message.
      res.status(409).json({ error: "A pipeline lead for this contact already exists." });
    } else {
      res.status(500).json({ error: String((err && err.message) || err) });
    }
  }
}
