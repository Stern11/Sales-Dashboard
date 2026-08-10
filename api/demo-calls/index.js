// GET /api/demo-calls — full lead list + funnel/KPI summary. Also doubles as
// the reverse "history for this pipeline lead" lookup via
// ?pipeline_lead_id=<id> (used by the Sales Pipeline drawer's "View Demo
// Call History" button) — folded in here rather than its own route file to
// stay within Vercel Hobby's 12-serverless-function cap per deployment
// (every file under api/ is its own function; see api/demo-calls/[id].js
// for the same reasoning behind its own consolidation).
// POST /api/demo-calls — create a lead: manual entry, or the target of
// "Log first call" on a live-but-untracked HubSpot contact (accepts an
// optional `first_call` payload to create the lead and its first call log
// in one request — see createLead() in lib/demo-calls/queries.js).
//
// Demo Calls is a database-backed module, same boundary as Sales Pipeline —
// see db/schema.sql and docs/ARCHITECTURE.md. It never reads HubSpot itself;
// "who's reached Demo Call" is detected live, client-side, by reusing the
// same data ABM/Marketing already fetch (src/modules/demo-calls/
// useLiveDemoCallContacts.js).

import { withDbErrorHandling, ValidationError, ConflictError } from "../../lib/demo-calls/respond.js";
import { listLeads, createLead, getLeadByHubspotContactId, getLeadByPipelineLeadId, listCalls } from "../../lib/demo-calls/queries.js";
import { isValidOutcome, isValidCompanyScale } from "../../lib/demo-calls/constants.js";

function validateCreateBody(body) {
  const { company_name, contact_name, actor, first_call, company_scale } = body || {};
  if (!company_name || !String(company_name).trim()) throw new ValidationError("company_name is required.");
  if (!contact_name || !String(contact_name).trim()) throw new ValidationError("contact_name is required.");
  if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");
  if (!isValidCompanyScale(company_scale)) throw new ValidationError("Invalid company_scale.");
  if (first_call && !isValidOutcome(first_call.outcome)) {
    throw new ValidationError("Invalid first_call.outcome.");
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { pipeline_lead_id } = req.query;
    if (pipeline_lead_id) {
      await withDbErrorHandling(res, async () => {
        const lead = await getLeadByPipelineLeadId(pipeline_lead_id);
        if (!lead) return { lead: null, calls: [] };
        const calls = await listCalls(lead.id);
        return { lead, calls };
      });
      return;
    }
    await withDbErrorHandling(res, () => listLeads());
    return;
  }

  if (req.method === "POST") {
    await withDbErrorHandling(res, async () => {
      validateCreateBody(req.body);
      const { hubspot_contact_id } = req.body;
      if (hubspot_contact_id) {
        const existing = await getLeadByHubspotContactId(String(hubspot_contact_id));
        if (existing) {
          throw new ConflictError("A demo call lead for this contact already exists.", {
            id: existing.id,
            status: existing.status,
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
