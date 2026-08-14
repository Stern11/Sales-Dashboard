// GET /api/pipeline/:id — lead detail + its notes + full stage history.
// PATCH /api/pipeline/:id — edit fields (never `stage` — see ?action=stage below).
// DELETE /api/pipeline/:id — permanently deletes the lead (and its notes/stage
// history, via cascade). Requires `confirm_company_name` to exactly match the
// lead's current company name — a server-enforced check, not just a client-side
// prompt, so a stray API call can't delete something by accident. No undo.
// POST /api/pipeline/:id?action=stage — move a lead to a new stage.
// POST /api/pipeline/:id?action=notes  — append a note (the "Next steps" timeline).
//
// stage/notes are folded into this same file (disambiguated by ?action=,
// same pattern as api/account-expansion/index.js and api/demo-calls/[id].js)
// rather than their own path-segment files, to stay under Vercel Hobby's
// 12-serverless-function-per-deployment cap — this app was already sitting
// at 12/12 before the Google-login endpoint needed a slot.

import { withDbErrorHandling, ValidationError, NotFoundError } from "../../../lib/pipeline/respond.js";
import { getLeadById, updateLead, deleteLead, listNotes, listStageHistory, addNote, changeStage } from "../../../lib/pipeline/queries.js";
import { isValidCompanyScale, isValidPriority, isValidStage } from "../../../lib/pipeline/constants.js";
import { notifyTagged } from "../../../lib/email.js";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

async function handleGetDetail(req, res, id) {
  await withDbErrorHandling(res, async () => {
    const lead = await getLeadById(id);
    if (!lead) throw new NotFoundError("No pipeline lead with that id.");
    const [notes, stage_history] = await Promise.all([listNotes(id), listStageHistory(id)]);
    return { lead, notes, stage_history };
  });
}

async function handleUpdate(req, res, id) {
  await withDbErrorHandling(res, async () => {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "stage")) {
      throw new ValidationError("Stage can only be changed via POST /api/pipeline/:id?action=stage.");
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
}

async function handleDelete(req, res, id) {
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
}

async function handleChangeStage(req, res, id) {
  await withDbErrorHandling(res, async () => {
    const { to_stage, reason, actor } = req.body || {};
    if (!isValidStage(to_stage)) throw new ValidationError("Invalid to_stage.");
    if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");
    const lead = await changeStage(id, { to_stage, reason: reason || null, actor });
    if (!lead) throw new NotFoundError("No pipeline lead with that id.");
    return { lead };
  });
}

async function handleAddNote(req, res, id) {
  await withDbErrorHandling(res, async () => {
    const { body, author, tagged_emails } = req.body || {};
    if (!body || !String(body).trim()) throw new ValidationError("Note body is required.");
    if (!author || !String(author).trim()) throw new ValidationError("author (name tag) is required.");
    const lead = await getLeadById(id);
    if (!lead) throw new NotFoundError("No pipeline lead with that id.");

    // A malformed tag shouldn't block a valid note — drop anything that
    // doesn't look like an email rather than failing the whole request.
    const cleanTaggedEmails = [...new Set((tagged_emails || []).filter((e) => EMAIL_RE.test(e)))];
    const note = await addNote(id, { body, author, tagged_emails: cleanTaggedEmails });

    // Best-effort, after the note is already saved: a missing RESEND_API_KEY
    // or a Resend outage must never turn a successful note-add into a 500.
    await Promise.all(cleanTaggedEmails.map((to) =>
      notifyTagged({
        to, actor: author, leadId: id, noteBody: body, req,
        companyName: lead.company_name,
        contactName: lead.contact_name,
        stage: lead.stage,
        priority: lead.priority,
        dealSize: lead.deal_size,
      }).catch((err) => console.error(`notifyTagged failed for ${to}:`, err.message))
    ));

    return { note };
  });
}

export default async function handler(req, res) {
  const { id, action } = req.query;

  if (req.method === "GET") return handleGetDetail(req, res, id);
  if (req.method === "PATCH") return handleUpdate(req, res, id);
  if (req.method === "DELETE") return handleDelete(req, res, id);

  if (req.method === "POST") {
    if (action === "stage") return handleChangeStage(req, res, id);
    if (action === "notes") return handleAddNote(req, res, id);
    res.status(400).json({ error: "Missing or unrecognized ?action=." });
    return;
  }

  res.setHeader("Allow", "GET, PATCH, DELETE, POST");
  res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
