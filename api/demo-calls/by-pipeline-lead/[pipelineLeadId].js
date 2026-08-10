// GET /api/demo-calls/by-pipeline-lead/:pipelineLeadId — reverse lookup used
// by the Sales Pipeline lead drawer's "View Demo Call History" button. Most
// pipeline leads have no Demo Calls origin at all, so a miss is a normal
// 200 { lead: null, calls: [] }, not a 404 — this endpoint answers "is
// there history for this lead," it doesn't require one to exist.

import { withDbErrorHandling } from "../../../lib/demo-calls/respond.js";
import { getLeadByPipelineLeadId, listCalls } from "../../../lib/demo-calls/queries.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: `Method ${req.method} not allowed.` });
    return;
  }

  const { pipelineLeadId } = req.query;

  await withDbErrorHandling(res, async () => {
    const lead = await getLeadByPipelineLeadId(pipelineLeadId);
    if (!lead) return { lead: null, calls: [] };
    const calls = await listCalls(lead.id);
    return { lead, calls };
  });
}
