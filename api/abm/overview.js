// GET /api/abm/overview — combined ABM totals across every active segment
// (Logistics, Health and Personal Care, ...), for the summary row shown
// above the segment toggle. Reuses lib/abm.js's buildAbmPayload per segment
// so these numbers can never drift from what each segment's own page shows,
// then sums them and drops the per-lead detail (not needed for a KPI row).
//
// Segments are fetched sequentially, not concurrently — an earlier attempt
// at concurrent HubSpot pagination in api/sources/index.js tripped rate
// limiting and ended up slower than sequential. These fetches are much
// lighter (ID-list batches, not full-portal pagination), so sequential stays
// fast in practice.

import { getToken } from "../../lib/hubspot.js";
import { withHubspotErrorHandling } from "../../lib/respond.js";
import { buildAbmPayload, getLifecycleStages, LINKEDIN_STAGES, CALLING_STAGES, EMAIL_STAGES } from "../../lib/abm.js";
import { SEGMENTS } from "../../lib/abm-segments/index.js";

function sumFunnel(stageNames, payloads, key) {
  return stageNames.map((stage, i) => ({
    stage,
    count: payloads.reduce((sum, p) => sum + p.summary[key][i].count, 0),
  }));
}

async function buildOverviewPayload(token) {
  const active = SEGMENTS.filter((s) => s.leads.length > 0);
  const stages = await getLifecycleStages(token); // fetched once, reused across every segment below
  const payloads = [];
  for (const segment of active) {
    payloads.push(await buildAbmPayload(token, segment, stages));
  }

  const summary = {
    total_companies: payloads.reduce((sum, p) => sum + p.summary.total_companies, 0),
    total_leads: payloads.reduce((sum, p) => sum + p.summary.total_leads, 0),
    emails_on_file: payloads.reduce((sum, p) => sum + p.summary.emails_on_file, 0),
    meetings_done: payloads.reduce((sum, p) => sum + p.summary.meetings_done, 0),
    meetings_by_channel: {
      email: payloads.reduce((sum, p) => sum + p.summary.meetings_by_channel.email, 0),
      linkedin: payloads.reduce((sum, p) => sum + p.summary.meetings_by_channel.linkedin, 0),
      calls: payloads.reduce((sum, p) => sum + p.summary.meetings_by_channel.calls, 0),
    },
    linkedin_funnel: sumFunnel(LINKEDIN_STAGES, payloads, "linkedin_funnel"),
    calling_funnel: sumFunnel(CALLING_STAGES, payloads, "calling_funnel"),
    email_funnel: sumFunnel(EMAIL_STAGES, payloads, "email_funnel"),
  };

  const segments = payloads.map((p) => ({
    id: p.segment.id,
    label: p.segment.label,
    num_leads: p.summary.total_leads,
    num_companies: p.summary.total_companies,
  }));

  return { summary, segments };
}

export default async function handler(req, res) {
  await withHubspotErrorHandling(res, () => buildOverviewPayload(getToken()));
}
