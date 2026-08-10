// POST /api/demo-calls/:id/link-pipeline — records that a Demo Calls lead was
// copied into Sales Pipeline. Called by the frontend *after* its own
// POST /api/pipeline succeeds (src/lib/pipelineIntegration.js's
// demoCallLeadToPipelinePrefill) — keeps the two modules loosely coupled the
// same way ABM/Marketing -> Pipeline already is, rather than one backend
// calling another module's query layer directly.

import { withDbErrorHandling, ValidationError, NotFoundError } from "../../../lib/demo-calls/respond.js";
import { linkPipeline } from "../../../lib/demo-calls/queries.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: `Method ${req.method} not allowed.` });
    return;
  }

  const { id } = req.query;

  await withDbErrorHandling(res, async () => {
    const { pipeline_lead_id, actor } = req.body || {};
    if (!pipeline_lead_id) throw new ValidationError("pipeline_lead_id is required.");
    if (!actor || !String(actor).trim()) throw new ValidationError("actor (name tag) is required.");
    const lead = await linkPipeline(id, pipeline_lead_id, actor);
    if (!lead) throw new NotFoundError("No demo call lead with that id.");
    return { lead };
  });
}
