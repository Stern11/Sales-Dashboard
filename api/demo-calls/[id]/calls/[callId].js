// PATCH /api/demo-calls/:id/calls/:callId — edit an existing call log entry.
// Unlike Sales Pipeline's append-only notes, call log entries are editable —
// a call's fields legitimately fill in incrementally (date now, transcript
// link once it's ready), and there's no @-mention/notification concern here.

import { withDbErrorHandling, ValidationError, NotFoundError } from "../../../../lib/demo-calls/respond.js";
import { updateCall } from "../../../../lib/demo-calls/queries.js";
import { isValidOutcome } from "../../../../lib/demo-calls/constants.js";

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    res.status(405).json({ error: `Method ${req.method} not allowed.` });
    return;
  }

  const { id, callId } = req.query;

  await withDbErrorHandling(res, async () => {
    const actor = req.body?.actor;
    if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "outcome") && !isValidOutcome(req.body.outcome)) {
      throw new ValidationError("Invalid outcome.");
    }
    const call = await updateCall(id, callId, req.body || {}, actor);
    if (!call) throw new NotFoundError("No call log entry with that id for this lead.");
    return { call };
  });
}
