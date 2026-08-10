// GET /api/demo-calls — full lead list + funnel/KPI summary.
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
import { listLeads, createLead, getLeadByHubspotContactId } from "../../lib/demo-calls/queries.js";
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
