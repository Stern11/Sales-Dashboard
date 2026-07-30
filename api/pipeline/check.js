// GET /api/pipeline/check?contact_ids=1,2,3 — bulk "already in pipeline"
// lookup by HubSpot contact id, used by the ABM/Marketing "Add to pipeline"
// retrofit so it can badge already-added leads instead of one request per row.
//
// Note: as a literal path, this file takes precedence over api/pipeline/[id]/
// for the exact route /api/pipeline/check (Vercel resolves static routes
// before dynamic ones) — worth knowing since it's the only place in this app
// where that ordering matters.

import { withDbErrorHandling } from "../../lib/pipeline/respond.js";
import { checkContactIds } from "../../lib/pipeline/queries.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: `Method ${req.method} not allowed.` });
    return;
  }

  await withDbErrorHandling(res, async () => {
    const raw = req.query.contact_ids;
    const ids = (Array.isArray(raw) ? raw.join(",") : raw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const rows = await checkContactIds(ids);
    const in_pipeline = Object.fromEntries(rows.map((r) => [r.hubspot_contact_id, { id: r.id, stage: r.stage }]));
    return { in_pipeline };
  });
}
