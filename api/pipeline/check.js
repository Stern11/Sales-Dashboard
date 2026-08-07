// POST /api/pipeline/check { contact_ids: [...] } — bulk "already in
// pipeline" lookup by HubSpot contact id, used by the ABM/Marketing "Add to
// pipeline" retrofit so it can badge already-added leads instead of one
// request per row.
//
// POST (ids in the body), not GET with them comma-joined into the query
// string: Marketing's "Lifetime" view can pass hundreds-to-low-thousands of
// ids (see api/sources/index.js), which as a URL risks exceeding typical
// proxy/server URL-length limits as the ad-lead dataset grows.
//
// Note: as a literal path, this file takes precedence over api/pipeline/[id]/
// for the exact route /api/pipeline/check (Vercel resolves static routes
// before dynamic ones) — worth knowing since it's the only place in this app
// where that ordering matters.

import { withDbErrorHandling } from "../../lib/pipeline/respond.js";
import { checkContactIds } from "../../lib/pipeline/queries.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: `Method ${req.method} not allowed.` });
    return;
  }

  await withDbErrorHandling(res, async () => {
    const raw = req.body?.contact_ids;
    const ids = (Array.isArray(raw) ? raw : []).map((s) => String(s).trim()).filter(Boolean);
    const rows = await checkContactIds(ids);
    const in_pipeline = Object.fromEntries(rows.map((r) => [r.hubspot_contact_id, { id: r.id, stage: r.stage }]));
    return { in_pipeline };
  });
}
