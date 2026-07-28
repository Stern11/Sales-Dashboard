// GET /api/abm?segment=logistics — live ABM outreach data (companies, leads,
// LinkedIn/Calling/Email funnels) for one segment. Segment ID lists live in
// lib/abm-segments/*.js; shaping logic lives in lib/abm.js (shared with
// api/abm/overview.js); everything else is fetched from HubSpot per request.

import { getToken } from "../../lib/hubspot.js";
import { withHubspotErrorHandling } from "../../lib/respond.js";
import { buildAbmPayload, getLifecycleStages } from "../../lib/abm.js";
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
    const stages = await getLifecycleStages(token);
    return buildAbmPayload(token, segment, stages);
  });
}
