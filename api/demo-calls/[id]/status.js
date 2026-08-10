// POST /api/demo-calls/:id/status — set active/irrelevant, with an optional
// reason (stored only when moving to 'irrelevant'). Mirrors Pipeline's
// /stage endpoint but with a flat 2-state model — no cold/lost branching or
// revival bookkeeping needed here.

import { withDbErrorHandling, ValidationError, NotFoundError } from "../../../lib/demo-calls/respond.js";
import { setStatus } from "../../../lib/demo-calls/queries.js";
import { isValidStatus } from "../../../lib/demo-calls/constants.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: `Method ${req.method} not allowed.` });
    return;
  }

  const { id } = req.query;

  await withDbErrorHandling(res, async () => {
    const { status, reason, actor } = req.body || {};
    if (!isValidStatus(status)) throw new ValidationError("Invalid status.");
    if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");
    const lead = await setStatus(id, { status, reason: reason || null, actor });
    if (!lead) throw new NotFoundError("No demo call lead with that id.");
    return { lead };
  });
}
