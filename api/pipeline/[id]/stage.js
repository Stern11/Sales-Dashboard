// POST /api/pipeline/:id/stage — move a lead to a new stage, including the
// Cold/Lost branch (with an optional reason) and reviving back to an active
// stage. The only place stage_history rows get written — see changeStage()
// in lib/pipeline/queries.js for the cold/lost bookkeeping rules.

import { withDbErrorHandling, ValidationError, NotFoundError } from "../../../lib/pipeline/respond.js";
import { changeStage } from "../../../lib/pipeline/queries.js";
import { isValidStage } from "../../../lib/pipeline/constants.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: `Method ${req.method} not allowed.` });
    return;
  }

  const { id } = req.query;

  await withDbErrorHandling(res, async () => {
    const { to_stage, reason, actor } = req.body || {};
    if (!isValidStage(to_stage)) throw new ValidationError("Invalid to_stage.");
    if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");
    const lead = await changeStage(id, { to_stage, reason: reason || null, actor });
    if (!lead) throw new NotFoundError("No pipeline lead with that id.");
    return { lead };
  });
}
