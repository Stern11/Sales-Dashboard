// GET /api/demo-calls — full lead list + funnel/KPI summary. Also doubles as
// the reverse "history for this pipeline lead" lookup via
// ?pipeline_lead_id=<id> (used by the Sales Pipeline drawer's "View Demo
// Call History" button) — folded in here rather than its own route file to
// stay within Vercel Hobby's 12-serverless-function cap per deployment
// (every file under api/ is its own function; see api/demo-calls/[id].js
// for the same reasoning behind its own consolidation).
// GET /api/demo-calls?action=hubspot-engagements&contact_id=<id> — the one
// place this module reads HubSpot (read-only): Meetings + Notes logged
// against a contact, for the "Import from HubSpot" review panel. See
// lib/demo-calls/hubspotEngagements.js for why Calls are deliberately
// excluded. Folded in here rather than a new file for the same
// function-cap reason as above.
// POST /api/demo-calls — create a lead: manual entry, or the target of
// "Log first call" on a live-but-untracked HubSpot contact (accepts an
// optional `first_call` payload to create the lead and its first call log
// in one request — see createLead() in lib/demo-calls/queries.js). When the
// new lead carries a hubspot_contact_id, this also does a second, read-only
// HubSpot lookup (fetchStageEnteredAt) for a more accurate Booked date than
// created_at — best-effort, never blocks creation on failure.
//
// Demo Calls is a database-backed module, same boundary as Sales Pipeline —
// see db/schema.sql and docs/ARCHITECTURE.md. "Who's reached Demo Call" is
// still detected live, client-side, by reusing the same data ABM/Marketing
// already fetch (src/modules/demo-calls/useLiveDemoCallContacts.js) — the
// hubspot-engagements action above is a narrower, deliberate exception for
// the import panel only, not a general HubSpot read path for this module.

import { withDbErrorHandling, ValidationError, ConflictError } from "../../lib/demo-calls/respond.js";
import { requireActor } from "../../lib/auth/actor.js";
import { withHubspotErrorHandling } from "../../lib/respond.js";
import { getToken } from "../../lib/hubspot.js";
import { getLifecycleStages } from "../../lib/abm.js";
import { fetchEngagementsForContact } from "../../lib/demo-calls/hubspotEngagements.js";
import { fetchStageEnteredAt } from "../../lib/demo-calls/hubspotStageHistory.js";
import { listLeads, createLead, getLeadByHubspotContactId, getLeadByPipelineLeadId, listCalls } from "../../lib/demo-calls/queries.js";
import { isValidOutcome, isValidCompanyScale } from "../../lib/demo-calls/constants.js";

/**
 * The HubSpot lifecyclestage value this app treats as "Demo Call reached" —
 * same value lib/abm.js's meeting_done uses, and the one label everything
 * else in this module (useLiveDemoCallContacts.js, api/sources/index.js)
 * already keys off of.
 */
const DEMO_STAGE_VALUE = "opportunity";

/**
 * Best-effort lookup of when a HubSpot contact actually reached the Demo
 * Call stage, for a more accurate Booked date than created_at (see
 * migration 0015 and lib/demo-calls/hubspotStageHistory.js). Never throws:
 * a lookup failure (missing scope, rate limit, network) must not block lead
 * creation — the lead is still created, just with demo_stage_entered_at
 * left null, falling back to created_at like it always has.
 */
async function lookupStageEnteredAt(hubspotContactId) {
  if (!hubspotContactId) return null;
  try {
    const token = getToken();
    const stages = await getLifecycleStages(token);
    return await fetchStageEnteredAt(token, hubspotContactId, stages, DEMO_STAGE_VALUE);
  } catch (err) {
    console.error(`demo_stage_entered_at lookup failed for contact ${hubspotContactId}:`, err.message);
    return null;
  }
}

function validateCreateBody(body) {
  const { company_name, contact_name, first_call, company_scale } = body || {};
  if (!company_name || !String(company_name).trim()) throw new ValidationError("company_name is required.");
  if (!contact_name || !String(contact_name).trim()) throw new ValidationError("contact_name is required.");
  if (!isValidCompanyScale(company_scale)) throw new ValidationError("Invalid company_scale.");
  if (first_call && !isValidOutcome(first_call.outcome)) {
    throw new ValidationError("Invalid first_call.outcome.");
  }
}

/**
 * The columns a client may set when creating a demo-call lead, coerced to
 * the types their columns expect. Same reasoning as pickCreateFields in
 * api/pipeline/index.js: the raw body used to be passed straight to
 * createLead(), which destructured whatever it found there.
 */
function pickCreateFields(body) {
  const b = body || {};
  const first = b.first_call;
  return {
    company_name: String(b.company_name).trim(),
    contact_name: String(b.contact_name).trim(),
    email: b.email ? String(b.email).trim() : null,
    phone: b.phone ? String(b.phone).trim() : null,
    hubspot_contact_id: b.hubspot_contact_id != null ? String(b.hubspot_contact_id) : null,
    hubspot_origin_module: b.hubspot_origin_module ? String(b.hubspot_origin_module) : null,
    company_scale: b.company_scale || null,
    source: b.source ? String(b.source) : null,
    first_call: first
      ? {
          call_date: first.call_date || null,
          outcome: first.outcome,
          notes: first.notes ? String(first.notes) : null,
          next_steps: first.next_steps ? String(first.next_steps) : null,
          transcript_url: first.transcript_url ? String(first.transcript_url) : null,
        }
      : null,
  };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { pipeline_lead_id, action, contact_id: contactId } = req.query;

    if (action === "hubspot-engagements") {
      if (!contactId) {
        res.status(400).json({ error: "contact_id is required." });
        return;
      }
      await withHubspotErrorHandling(res, async () => {
        const token = getToken();
        return fetchEngagementsForContact(token, contactId);
      });
      return;
    }

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
      const actor = await requireActor(req);
      const fields = pickCreateFields(req.body);
      const demo_stage_entered_at = await lookupStageEnteredAt(fields.hubspot_contact_id);
      const lead = await createLead({ ...fields, demo_stage_entered_at, actor });
      return { lead };
    });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
