// POST /api/demo-calls/:id/calls — append a new call log entry ("Call 1",
// "Call 2", ... — call_number is assigned server-side as existing count + 1).

import { withDbErrorHandling, ValidationError, NotFoundError } from "../../../lib/demo-calls/respond.js";
import { addCall, getLeadById } from "../../../lib/demo-calls/queries.js";
import { isValidOutcome } from "../../../lib/demo-calls/constants.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: `Method ${req.method} not allowed.` });
    return;
  }

  const { id } = req.query;

  await withDbErrorHandling(res, async () => {
    const { actor } = req.body || {};
    if (!isValidOutcome(req.body?.outcome)) throw new ValidationError("Invalid outcome.");
    if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");

    const lead = await getLeadById(id);
    if (!lead) throw new NotFoundError("No demo call lead with that id.");

    const call = await addCall(id, req.body, actor);
    return { call };
  });
}
