// Account Expansion's slice of the shared database error mapping
// (lib/db-respond.js).
//
// This module previously lacked the 23505 branch the other two had, so a
// unique-constraint violation — account_expansion_whitespace_area_uq is the
// one reachable from the UI, by adding the same whitespace area twice —
// returned a 500 instead of a 409. Sharing the implementation fixes that as
// a side effect of no longer having three copies to keep in step.

import { createDbErrorHandling } from "../db-respond.js";

export { setNoStoreCacheHeader, ValidationError, NotFoundError, ConflictError } from "../db-respond.js";

export const withDbErrorHandling = createDbErrorHandling({
  conflictMessage: "That already exists for this account.",
});
