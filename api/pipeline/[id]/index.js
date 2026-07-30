// GET /api/pipeline/:id — lead detail + its notes + full stage history.
// PATCH /api/pipeline/:id — edit fields (never `stage` — see api/pipeline/[id]/stage.js).
// DELETE /api/pipeline/:id — permanently deletes the lead (and its notes/stage
// history, via cascade). Requires `confirm_company_name` to exactly match the
// lead's current company name — a server-enforced check, not just a client-side
// prompt, so a stray API call can't delete something by accident. No undo.

import { withDbErrorHandling, ValidationError, NotFoundError } from "../../../lib/pipeline/respond.js";
import { getLeadById, updateLead, deleteLead, listNotes, listStageHistory } from "../../../lib/pipeline/queries.js";
import { isValidCompanyScale, isValidPriority } from "../../../lib/pipeline/constants.js";

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    await withDbErrorHandling(res, async () => {
      const lead = await getLeadById(id);
      if (!lead) throw new NotFoundError("No pipeline lead with that id.");
      const [notes, stage_history] = await Promise.all([listNotes(id), listStageHistory(id)]);
      return { lead, notes, stage_history };
    });
    return;
  }

  if (req.method === "PATCH") {
    await withDbErrorHandling(res, async () => {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "stage")) {
        throw new ValidationError("Stage can only be changed via POST /api/pipeline/:id/stage.");
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "company_scale") && !isValidCompanyScale(req.body.company_scale)) {
        throw new ValidationError("Invalid company_scale.");
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "priority") && !isValidPriority(req.body.priority)) {
        throw new ValidationError("Invalid priority.");
      }
      const actor = req.body?.actor;
      if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");
      const lead = await updateLead(id, req.body, actor);
      if (!lead) throw new NotFoundError("No pipeline lead with that id.");
      return { lead };
    });
    return;
  }

  if (req.method === "DELETE") {
    await withDbErrorHandling(res, async () => {
      const actor = req.body?.actor;
      if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");

      const lead = await getLeadById(id);
      if (!lead) throw new NotFoundError("No pipeline lead with that id.");

      const confirmation = String(req.body?.confirm_company_name || "").trim();
      if (confirmation !== lead.company_name) {
        throw new ValidationError("Company name didn't match — nothing was deleted.");
      }

      await deleteLead(id);
      return { deleted: true, id };
    });
    return;
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
