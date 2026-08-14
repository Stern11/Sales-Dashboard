// Pipeline's slice of the shared database error mapping (lib/db-respond.js).
// Kept as its own module so route handlers under api/pipeline/ import from
// their own module, and so the pipeline-only SourceLockedError mapping lives
// next to the code that throws it.

import { createDbErrorHandling } from "../db-respond.js";
import { SourceLockedError } from "./errors.js";

export { setNoStoreCacheHeader, ValidationError, NotFoundError, ConflictError } from "../db-respond.js";

export const withDbErrorHandling = createDbErrorHandling({
  // Only pipeline_leads_hubspot_contact_id_uq fires this in practice.
  // Callers that need the existing lead's id/stage for a richer 409 body
  // check via checkContactIds() before inserting rather than parsing this.
  conflictMessage: "A pipeline lead for this contact already exists.",
  extraHandlers: [
    { type: SourceLockedError, status: 400, body: (err) => ({ error: err.message }) },
  ],
});
