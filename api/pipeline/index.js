// GET /api/pipeline?period=weekly|monthly — live Sales Pipeline data: stage
// funnel (open deal count + value per stage), a new-deals-created and
// closed-won-value trend, and the underlying deal list.
//
// Requires the `crm.objects.deals.read` scope on the HubSpot Private App —
// not granted as of this build (see docs/ARCHITECTURE.md). Until it's added,
// this renders a clear "missing scope" message instead of a raw 500.

import { getToken, hubspotGet, hubspotSearchAll } from "../../lib/hubspot.js";
import { withHubspotErrorHandling } from "../../lib/respond.js";
import { buildPeriodBuckets, bucketIndexFor } from "../../lib/dateBuckets.js";

const DEAL_PROPERTIES = [
  "dealname", "amount", "dealstage", "pipeline", "createdate", "closedate",
  "hs_is_closed_won", "hs_is_closed_lost",
];

const currency = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

async function buildPipelinePayload(token, period) {
  const pipelinesRes = await hubspotGet(token, "/crm/v3/pipelines/deals");
  const stageLabel = {};
  const stageOrder = [];
  for (const pipeline of pipelinesRes.results || []) {
    for (const stage of pipeline.stages || []) {
      stageLabel[stage.id] = stage.label;
      stageOrder.push(stage.id);
    }
  }

  const deals = await hubspotSearchAll(token, "deals", {
    properties: DEAL_PROPERTIES,
    sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
  });

  const dealsOut = deals.map((d) => {
    const p = d.properties || {};
    return {
      id: d.id,
      name: p.dealname || "(unnamed deal)",
      stage: stageLabel[p.dealstage] || p.dealstage || "Unknown",
      amount: Number(p.amount) || 0,
      created_at: p.createdate || null,
      close_date: p.closedate || null,
      is_closed_won: p.hs_is_closed_won === "true",
      is_closed_lost: p.hs_is_closed_lost === "true",
    };
  });

  const openDeals = dealsOut.filter((d) => !d.is_closed_won && !d.is_closed_lost);
  const stage_funnel = [...new Set(stageOrder)]
    .map((id) => stageLabel[id])
    .filter((label, i, arr) => arr.indexOf(label) === i)
    .map((label) => {
      const inStage = openDeals.filter((d) => d.stage === label);
      return { stage: label, count: inStage.length, formatted: currency.format(inStage.reduce((sum, d) => sum + d.amount, 0)) };
    })
    .filter((s) => s.count > 0 || stageOrder.length <= 10); // keep short pipelines fully visible even with empty stages

  const bucketCount = period === "monthly" ? 6 : 8;
  const buckets = buildPeriodBuckets(period, bucketCount);
  const newDealsTrend = buckets.map((b) => ({ label: b.label, value: 0 }));
  const closedWonTrend = buckets.map((b) => ({ label: b.label, value: 0 }));
  for (const d of dealsOut) {
    const createdIdx = bucketIndexFor(d.created_at, buckets);
    if (createdIdx >= 0) newDealsTrend[createdIdx].value += 1;
    if (d.is_closed_won) {
      const closedIdx = bucketIndexFor(d.close_date, buckets);
      if (closedIdx >= 0) closedWonTrend[closedIdx].value += d.amount;
    }
  }
  closedWonTrend.forEach((p) => { p.formatted = currency.format(p.value); });

  const summary = {
    total_open_deals: openDeals.length,
    total_open_value: currency.format(openDeals.reduce((sum, d) => sum + d.amount, 0)),
    total_closed_won: dealsOut.filter((d) => d.is_closed_won).length,
    total_closed_lost: dealsOut.filter((d) => d.is_closed_lost).length,
    stage_funnel,
  };

  return { period, summary, new_deals_trend: newDealsTrend, closed_won_trend: closedWonTrend, deals: dealsOut };
}

export default async function handler(req, res) {
  const period = req.query.period === "monthly" ? "monthly" : "weekly";
  await withHubspotErrorHandling(res, () => buildPipelinePayload(getToken(), period));
}
