// POST /api/pipeline/:id/notes — append a note (the "Next steps" timeline).
// Notes are an append-only table, not an editable field, so this is the only
// write path for them — see the reasoning in db/schema.sql.

import { withDbErrorHandling, ValidationError, NotFoundError } from "../../../lib/pipeline/respond.js";
import { addNote, getLeadById } from "../../../lib/pipeline/queries.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: `Method ${req.method} not allowed.` });
    return;
  }

  const { id } = req.query;

  await withDbErrorHandling(res, async () => {
    const { body, author } = req.body || {};
    if (!body || !String(body).trim()) throw new ValidationError("Note body is required.");
    if (!author || !String(author).trim()) throw new ValidationError("author (name tag) is required.");
    const lead = await getLeadById(id);
    if (!lead) throw new NotFoundError("No pipeline lead with that id.");
    const note = await addNote(id, { body, author });
    return { note };
  });
}
