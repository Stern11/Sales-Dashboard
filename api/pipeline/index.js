// GET /api/pipeline — full lead list + stage-count summary for the board/list view.
// POST /api/pipeline — create a lead (manual entry, or "Add to pipeline" from
// ABM/Marketing with hubspot_contact_id/hubspot_origin_module/source_locked set).
//
// This replaces the old HubSpot-deals-backed Sales Pipeline endpoint — the
// pipeline is now a database-backed lead tracker, not a live HubSpot view.
// See db/schema.sql for the data model.

import { withDbErrorHandling, ValidationError, ConflictError } from "../../lib/pipeline/respond.js";
import { requireActor } from "../../lib/auth/actor.js";
import { listLeads, createLead, checkContactIds } from "../../lib/pipeline/queries.js";
import { isValidCompanyScale, isValidPriority } from "../../lib/pipeline/constants.js";

const HUBSPOT_ORIGIN_MODULES = ["abm", "marketing", "demo-calls"];

function validateCreateBody(body) {
  const { company_name, contact_name, source, company_scale, priority } = body || {};
  if (!company_name || !String(company_name).trim()) throw new ValidationError("company_name is required.");
  if (!contact_name || !String(contact_name).trim()) throw new ValidationError("contact_name is required.");
  if (!source || !String(source).trim()) throw new ValidationError("source is required.");
  if (!isValidCompanyScale(company_scale)) throw new ValidationError("Invalid company_scale.");
  if (priority !== undefined && !isValidPriority(priority)) throw new ValidationError("Invalid priority.");
}

/**
 * The exact set of columns a client may set when creating a lead, each
 * coerced to the type its column expects.
 *
 * The whole request body used to be handed to createLead(), which
 * destructured integrity-bearing fields straight out of it. That let a
 * caller set `source_locked: true` to permanently freeze a lead's source
 * (updateLead refuses to change it afterwards), squat an arbitrary
 * `hubspot_contact_id` so the real "Add to pipeline" for that contact could
 * never succeed, or send `deal_size: "abc"` and get a raw Postgres error.
 *
 * These fields are all legitimately set by the ABM/Marketing "Add to
 * pipeline" flow (see abmLeadToPipelinePrefill in
 * src/lib/pipelineIntegration.js), so the fix is to validate them rather
 * than to refuse them.
 */
function pickCreateFields(body) {
  const b = body || {};

  let dealSize = null;
  if (b.deal_size !== undefined && b.deal_size !== null && b.deal_size !== "") {
    dealSize = Number(b.deal_size);
    if (!Number.isFinite(dealSize)) throw new ValidationError("deal_size must be a number.");
  }

  if (b.hubspot_origin_module != null && !HUBSPOT_ORIGIN_MODULES.includes(b.hubspot_origin_module)) {
    throw new ValidationError("Invalid hubspot_origin_module.");
  }

  return {
    company_name: String(b.company_name).trim(),
    contact_name: String(b.contact_name).trim(),
    email: b.email ? String(b.email).trim() : null,
    phone: b.phone ? String(b.phone).trim() : null,
    source: String(b.source).trim(),
    source_locked: b.source_locked === true,
    hubspot_contact_id: b.hubspot_contact_id != null ? String(b.hubspot_contact_id) : null,
    hubspot_origin_module: b.hubspot_origin_module ?? null,
    company_scale: b.company_scale || null,
    region: b.region ? String(b.region) : null,
    is_supply_chain: b.is_supply_chain === true,
    priority: b.priority || "medium",
    deal_size: dealSize,
    project_description: b.project_description ? String(b.project_description) : null,
  };
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
      const actor = await requireActor(req);
      const lead = await createLead({ ...pickCreateFields(req.body), actor });
      return { lead };
    });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
