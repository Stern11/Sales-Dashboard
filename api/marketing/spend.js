// GET /api/marketing/spend — ad spend and live-campaign count, sourced from
// HubSpot's Campaigns API (budget/spend items sync onto a Campaign once an
// ad account — e.g. the connected LinkedIn Ads account — is associated with
// it). This needs `marketing.campaigns.read`, which isn't available on this
// HubSpot plan as of 2026-07-30 (confirmed: the base `/marketing/v3/campaigns`
// request already 403s with MISSING_SCOPES, same as when this was checked
// for the old Marketing Campaigns module — see docs/ARCHITECTURE.md).
//
// There is no separate standalone "Ads API" to fall back on either — HubSpot
// doesn't expose one; ad spend/budget only surfaces via a Campaign object's
// budget-items once synced. So this is gated on the exact same scope as
// Campaigns, and wired up now so it starts working the moment that scope is
// granted (or a direct LinkedIn Ads API integration replaces it) — the
// budget-items field names below are HubSpot's documented shape as of the
// July 2025 Campaign budget-items API update and haven't been verified
// against a live response, since the scope has never been available to
// check them against. Re-verify before trusting the numbers once this stops
// throwing a scope error.

import { getToken, hubspotGet } from "../../lib/hubspot.js";
import { withHubspotErrorHandling } from "../../lib/respond.js";

async function buildSpendPayload(token) {
  const campaignList = await hubspotGet(token, "/marketing/v3/campaigns?limit=100");
  const campaigns = campaignList.results || [];

  let totalSpend = 0;
  let liveCampaigns = 0;
  const campaignsOut = [];
  for (const c of campaigns) {
    const status = String(c.status || c.properties?.hs_campaign_status || "UNKNOWN").toUpperCase();
    if (status === "ACTIVE" || status === "LIVE" || status === "IN_PROGRESS") liveCampaigns += 1;

    let spend = 0;
    try {
      const budget = await hubspotGet(token, `/marketing/v3/campaigns/${c.id}/budget-items`);
      spend = (budget.results || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    } catch {
      spend = 0; // budget-items missing/unavailable for this campaign — don't fail the whole page over one campaign
    }
    totalSpend += spend;
    campaignsOut.push({ id: c.id, name: c.name || "(unnamed campaign)", status, spend });
  }

  return {
    total_spend: totalSpend,
    live_campaigns: liveCampaigns,
    total_campaigns: campaignsOut.length,
    campaigns: campaignsOut,
  };
}

export default async function handler(req, res) {
  await withHubspotErrorHandling(res, () => buildSpendPayload(getToken()));
}
