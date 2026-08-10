// GET /api/demo-calls/:id — lead detail + its full call log.
// PATCH /api/demo-calls/:id — edit company_name/contact_name/email/phone/company_scale.
// DELETE /api/demo-calls/:id — permanently deletes the lead (and its call
// logs, via cascade). Requires `confirm_company_name` to exactly match the
// lead's current company name — server-enforced, mirrors
// api/pipeline/[id]/index.js. No undo.

import { withDbErrorHandling, ValidationError, NotFoundError } from "../../../lib/demo-calls/respond.js";
import { getLeadById, updateLead, deleteLead, listCalls } from "../../../lib/demo-calls/queries.js";
import { isValidCompanyScale } from "../../../lib/demo-calls/constants.js";

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    await withDbErrorHandling(res, async () => {
      const lead = await getLeadById(id);
      if (!lead) throw new NotFoundError("No demo call lead with that id.");
      const calls = await listCalls(id);
      return { lead, calls };
    });
    return;
  }

  if (req.method === "PATCH") {
    await withDbErrorHandling(res, async () => {
      const actor = req.body?.actor;
      if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "company_scale") && !isValidCompanyScale(req.body.company_scale)) {
        throw new ValidationError("Invalid company_scale.");
      }
      const lead = await updateLead(id, req.body || {}, actor);
      if (!lead) throw new NotFoundError("No demo call lead with that id.");
      return { lead };
    });
    return;
  }

  if (req.method === "DELETE") {
    await withDbErrorHandling(res, async () => {
      const actor = req.body?.actor;
      if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");

      const lead = await getLeadById(id);
      if (!lead) throw new NotFoundError("No demo call lead with that id.");

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
