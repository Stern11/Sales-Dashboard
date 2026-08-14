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

import { getToken, hubspotGet, mapWithConcurrency } from "../../lib/hubspot.js";
import { withHubspotErrorHandling } from "../../lib/respond.js";

async function buildSpendPayload(token) {
  const campaignList = await hubspotGet(token, "/marketing/v3/campaigns?limit=100");
  const campaigns = campaignList.results || [];

  // One budget-items request per campaign, run a few at a time instead of
  // strictly one after another. Serially this was up to 101 sequential
  // round trips against a 30s function limit (vercel.json), which on a
  // portal with a full campaign list would time out before returning
  // anything. The concurrency cap keeps it well inside HubSpot's per-second
  // limit, which is shared across the whole account.
  const campaignsOut = await mapWithConcurrency(campaigns, 5, async (c) => {
    const status = String(c.status || c.properties?.hs_campaign_status || "UNKNOWN").toUpperCase();

    let spend = 0;
    let spendAvailable = true;
    try {
      const budget = await hubspotGet(token, `/marketing/v3/campaigns/${c.id}/budget-items`);
      spend = (budget.results || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    } catch (err) {
      // Don't fail the whole page over one campaign — but don't silently
      // report $0 either. A bare `spend = 0` here made a rate-limited or
      // scope-denied response indistinguishable from a campaign that
      // genuinely spent nothing.
      spendAvailable = false;
      console.error(`budget-items unavailable for campaign ${c.id}:`, err.message);
    }

    return { id: c.id, name: c.name || "(unnamed campaign)", status, spend, spend_available: spendAvailable };
  });

  const isLive = (status) => status === "ACTIVE" || status === "LIVE" || status === "IN_PROGRESS";

  return {
    total_spend: campaignsOut.reduce((sum, c) => sum + c.spend, 0),
    live_campaigns: campaignsOut.filter((c) => isLive(c.status)).length,
    total_campaigns: campaignsOut.length,
    // So the UI can say "spend is partial" rather than presenting an
    // understated total as complete.
    spend_partial: campaignsOut.some((c) => !c.spend_available),
    campaigns: campaignsOut,
  };
}

export default async function handler(req, res) {
  await withHubspotErrorHandling(res, () => buildSpendPayload(getToken()));
}
