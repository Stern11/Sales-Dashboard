// POST /api/pipeline/:id/notes — append a note (the "Next steps" timeline).
// Notes are an append-only table, not an editable field, so this is the only
// write path for them — see the reasoning in db/schema.sql.

import { withDbErrorHandling, ValidationError, NotFoundError } from "../../../lib/pipeline/respond.js";
import { addNote, getLeadById } from "../../../lib/pipeline/queries.js";
import { notifyTagged } from "../../../lib/email.js";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: `Method ${req.method} not allowed.` });
    return;
  }

  const { id } = req.query;

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
