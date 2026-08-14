// GET /api/abm?segment=logistics — live ABM outreach data (companies, leads,
// LinkedIn/Calling/Email funnels) for one segment. Segment ID lists live in
// lib/abm-segments/*.js; shaping logic lives in lib/abm.js. Everything else
// is fetched from HubSpot per request.
//
// There's deliberately no separate "combined totals" endpoint — the frontend
// fetches every active segment through this same endpoint in parallel and
// sums them client-side (src/modules/abm/useAbmData.js's useAllAbmData) for
// the "Overall ABM Effort" row. An earlier version had a dedicated
// api/abm/overview.js that rebuilt every segment server-side, which meant
// loading the ABM page fetched the selected segment's data twice (once for
// its own view, once again inside the overview loop). Doing it client-side
// means one fetch per segment total, and the response is cached per segment
// URL either way, so switching tabs reuses what's already been fetched.

import { getToken } from "../../lib/hubspot.js";
import { withHubspotErrorHandling } from "../../lib/respond.js";
import { buildAbmPayload } from "../../lib/abm.js";
import { findSegment } from "../../lib/abm-segments/index.js";

export default async function handler(req, res) {
  const segmentId = req.query.segment || "logistics";
  const segment = findSegment(segmentId);
  if (!segment) {
    res.status(404).json({ error: `Unknown ABM segment "${segmentId}".` });
    return;
  }
  if (segment.leads.length === 0) {
    res.status(200).json({
      generated_at: new Date().toISOString(),
      segment: { id: segment.id, label: segment.label },
      empty: true,
    });
    return;
  }

  await withHubspotErrorHandling(res, async () => {
    const token = getToken();
    // buildAbmPayload fetches the lifecycle stages itself, concurrently with
    // the contacts and associations it needs anyway.
    return buildAbmPayload(token, segment);
  });
}
