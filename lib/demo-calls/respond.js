// Demo Calls' slice of the shared database error mapping (lib/db-respond.js).

import { createDbErrorHandling } from "../db-respond.js";

export { setNoStoreCacheHeader, ValidationError, NotFoundError, ConflictError } from "../db-respond.js";

export const withDbErrorHandling = createDbErrorHandling({
  conflictMessage: "A demo call lead for this contact already exists.",
});
