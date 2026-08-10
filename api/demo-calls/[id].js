// Every write on a single Demo Calls lead, disambiguated by method +
// `?action=` — deliberately one file (not a `[id]/calls.js`,
// `[id]/status.js`, `[id]/link-pipeline.js` split) to stay within Vercel
// Hobby's 12-serverless-function-per-deployment cap (every file under api/
// is its own function; this module alone was 7 files before consolidating
// to this one + api/demo-calls/index.js, which pushed a real deploy over
// the limit — see git history). `vercel dev` here doesn't support the
// catch-all `[...x]`/`[[...x]]` file syntax at all (verified directly, not
// just a hunch), so this uses the one nested-dynamic-segment shape already
// proven to work elsewhere in this app (api/pipeline/[id]/*.js) plus a
// query-param action instead of more path segments.
//
//   GET    /api/demo-calls/:id                        — lead detail + full call log
//   PATCH  /api/demo-calls/:id                         — edit company_name/contact_name/email/phone/company_scale
//   DELETE /api/demo-calls/:id                         — permanently delete (confirm_company_name required)
//   POST   /api/demo-calls/:id?action=calls            — append a call log entry
//   PATCH  /api/demo-calls/:id?action=calls&call_id=X  — edit an existing call log entry
//   POST   /api/demo-calls/:id?action=status           — set active/irrelevant
//   POST   /api/demo-calls/:id?action=link-pipeline    — record the Sales Pipeline handoff

import { withDbErrorHandling, ValidationError, NotFoundError } from "../../lib/demo-calls/respond.js";
import {
  getLeadById, updateLead, deleteLead, listCalls,
  addCall, updateCall, setStatus, linkPipeline,
} from "../../lib/demo-calls/queries.js";
import { isValidOutcome, isValidCompanyScale, isValidStatus } from "../../lib/demo-calls/constants.js";

async function handleGetOne(req, res, id) {
  await withDbErrorHandling(res, async () => {
    const lead = await getLeadById(id);
    if (!lead) throw new NotFoundError("No demo call lead with that id.");
    const calls = await listCalls(id);
    return { lead, calls };
  });
}

async function handleUpdateLead(req, res, id) {
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
}

async function handleUpdateCall(req, res, id, callId) {
  await withDbErrorHandling(res, async () => {
    const actor = req.body?.actor;
    if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "outcome") && !isValidOutcome(req.body.outcome)) {
      throw new ValidationError("Invalid outcome.");
    }
    const call = await updateCall(id, callId, req.body || {}, actor);
    if (!call) throw new NotFoundError("No call log entry with that id for this lead.");
    return { call };
  });
}

async function handleDelete(req, res, id) {
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
}

async function handleAddCall(req, res, id) {
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

async function handleSetStatus(req, res, id) {
  await withDbErrorHandling(res, async () => {
    const { status, reason, actor } = req.body || {};
    if (!isValidStatus(status)) throw new ValidationError("Invalid status.");
    if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");
    const lead = await setStatus(id, { status, reason: reason || null, actor });
    if (!lead) throw new NotFoundError("No demo call lead with that id.");
    return { lead };
  });
}

async function handleLinkPipeline(req, res, id) {
  await withDbErrorHandling(res, async () => {
    const { pipeline_lead_id, actor } = req.body || {};
    if (!pipeline_lead_id) throw new ValidationError("pipeline_lead_id is required.");
    if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");
    const lead = await linkPipeline(id, pipeline_lead_id, actor);
    if (!lead) throw new NotFoundError("No demo call lead with that id.");
    return { lead };
  });
}

export default async function handler(req, res) {
  const { id, action, call_id: callId } = req.query;

  if (req.method === "GET") return handleGetOne(req, res, id);

  if (req.method === "PATCH") {
    if (action === "calls") return handleUpdateCall(req, res, id, callId);
    return handleUpdateLead(req, res, id);
  }

  if (req.method === "DELETE") return handleDelete(req, res, id);

  if (req.method === "POST") {
    if (action === "calls") return handleAddCall(req, res, id);
    if (action === "status") return handleSetStatus(req, res, id);
    if (action === "link-pipeline") return handleLinkPipeline(req, res, id);
    res.status(400).json({ error: "Missing or unrecognized ?action=." });
    return;
  }

  res.setHeader("Allow", "GET, PATCH, DELETE, POST");
  res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
