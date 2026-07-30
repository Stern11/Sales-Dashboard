// GET /api/pipeline — full lead list + stage-count summary for the board/list view.
// POST /api/pipeline — create a lead (manual entry, or "Add to pipeline" from
// ABM/Marketing with hubspot_contact_id/hubspot_origin_module/source_locked set).
//
// This replaces the old HubSpot-deals-backed Sales Pipeline endpoint — the
// pipeline is now a database-backed lead tracker, not a live HubSpot view.
// See db/schema.sql for the data model.

import { withDbErrorHandling, ValidationError, ConflictError } from "../../lib/pipeline/respond.js";
import { listLeads, createLead, checkContactIds } from "../../lib/pipeline/queries.js";
import { isValidCompanyScale, isValidPriority } from "../../lib/pipeline/constants.js";

function validateCreateBody(body) {
  const { company_name, contact_name, source, actor, company_scale, priority } = body || {};
  if (!company_name || !String(company_name).trim()) throw new ValidationError("company_name is required.");
  if (!contact_name || !String(contact_name).trim()) throw new ValidationError("contact_name is required.");
  if (!source || !String(source).trim()) throw new ValidationError("source is required.");
  if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");
  if (!isValidCompanyScale(company_scale)) throw new ValidationError("Invalid company_scale.");
  if (priority !== undefined && !isValidPriority(priority)) throw new ValidationError("Invalid priority.");
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    await withDbErrorHandling(res, () => listLeads());
    return;
  }

  if (req.method === "POST") {
    await withDbErrorHandling(res, async () => {
      validateCreateBody(req.body);
      const { hubspot_contact_id } = req.body;
      if (hubspot_contact_id) {
        const existing = await checkContactIds([String(hubspot_contact_id)]);
        if (existing.length) {
          throw new ConflictError("A pipeline lead for this contact already exists.", {
            id: existing[0].id,
            stage: existing[0].stage,
          });
        }
      }
      const lead = await createLead(req.body);
      return { lead };
    });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
