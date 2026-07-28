// GET /api/sources?period=lifetime|monthly|weekly — live Lead Sources /
// attribution data: which channel (LinkedIn Ads, Paid Search, Organic,
// Offline, ...) each contact came from, their lifecycle-stage progress, and
// how many meetings have been booked with them.
//
// This exists in place of a HubSpot Marketing Campaigns module — this
// portal's token doesn't have `marketing.campaigns.read` (see
// docs/ARCHITECTURE.md), and campaign-level reporting isn't available on the
// current HubSpot plan. Every field used here comes from the contacts object
// (`hs_analytics_source`, `hs_analytics_source_data_1/2`, `lifecyclestage`)
// plus the Meetings CRM object — both already covered by the
// `crm.objects.contacts.read` scope this app already has, so this needs zero
// new HubSpot scopes. `hs_analytics_source_data_1` is the ad network/channel
// (e.g. "LinkedIn"); `hs_analytics_source_data_2` is the specific
// campaign/ad name — this is what stands in for "campaign" reporting.
//
// Single contacts fetch, deliberately NOT split into a capped/uncapped pair:
// an earlier version ran two paginated contact searches concurrently (one
// capped for the table, one uncapped for accurate KPIs) to save time, but
// HubSpot's rate limit is shared per-token across the whole app, not
// per request-stream — two paginated loops racing each other just triggered
// 429 backoff and made this endpoint *slower* (30s+, worse than doing one
// pass). One sequential pass over every matching contact (~2000 on this
// portal) takes ~10-12s for "lifetime" — see maxDuration in vercel.json.
// Deploying on a Vercel plan whose function timeout is below that will make
// "Lifetime" fail; "Monthly"/"Weekly" are far smaller and fast regardless.

import { getToken, hubspotGet, hubspotSearchAll, hubspotBatchAssociations } from "../../lib/hubspot.js";
import { withHubspotErrorHandling } from "../../lib/respond.js";

const CONTACT_PROPERTIES = [
  "hs_analytics_source", "hs_analytics_source_data_1", "hs_analytics_source_data_2",
  "lifecyclestage", "createdate", "email", "firstname", "lastname",
];
const MEETING_PROPERTIES = ["hs_meeting_start_time", "hs_meeting_outcome", "hs_meeting_title"];

function windowFilters(period) {
  if (period === "lifetime") return [];
  const days = period === "monthly" ? 30 : 7;
  const start = new Date();
  start.setDate(start.getDate() - days);
  return [{ propertyName: "createdate", operator: "GTE", value: String(start.getTime()) }];
}

function channelFor(p) {
  return p.hs_analytics_source_data_1 || p.hs_analytics_source || "Unknown";
}

async function buildSourcesPayload(token, period) {
  const filters = windowFilters(period);

  // Lifecycle stage definitions and meetings are independent of the contacts
  // fetch and cheap (1-2 requests each) — running them concurrently with the
  // contacts pagination is safe and shaves a little time without meaningfully
  // adding to rate-limit pressure.
  const [stageProp, contacts, meetingContactMap] = await Promise.all([
    // Pulled live so stage names/order match this portal's actual
    // configuration instead of a guessed default.
    hubspotGet(token, "/crm/v3/properties/contacts/lifecyclestage"),
    hubspotSearchAll(token, "contacts", {
      filterGroups: filters.length ? [{ filters }] : [],
      properties: CONTACT_PROPERTIES,
      sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
    }),
    // Meetings are few (tens, not thousands) — cheaper to fetch them all and
    // associate meetings→contacts than to associate contacts→meetings for
    // every one of potentially thousands of contacts.
    hubspotSearchAll(token, "meetings", { properties: MEETING_PROPERTIES }).then((meetings) =>
      meetings.length ? hubspotBatchAssociations(token, "meetings", "contacts", meetings.map((m) => m.id)) : new Map()
    ),
  ]);
  const stages = [...(stageProp.options || [])].sort((a, b) => a.displayOrder - b.displayOrder);

  const meetingCountByContact = new Map();
  let totalMeetings = 0;
  for (const contactIds of meetingContactMap.values()) {
    totalMeetings += contactIds.length;
    for (const cid of contactIds) meetingCountByContact.set(String(cid), (meetingCountByContact.get(String(cid)) || 0) + 1);
  }

  const leads = contacts.map((c) => {
    const p = c.properties || {};
    return {
      contact_id: c.id,
      name: `${p.firstname || ""} ${p.lastname || ""}`.trim() || p.email || "(no name)",
      email: p.email || null,
      channel: channelFor(p),
      campaign: p.hs_analytics_source_data_2 || null,
      lifecycle_stage: p.lifecyclestage || null,
      created_at: p.createdate || null,
      num_meetings: meetingCountByContact.get(String(c.id)) || 0,
    };
  });

  const channelCounts = {};
  for (const l of leads) channelCounts[l.channel] = (channelCounts[l.channel] || 0) + 1;
  const channels = Object.entries(channelCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([channel, count]) => ({ channel, count }));

  const summary = {
    total_leads: leads.length,
    total_meetings: totalMeetings,
    channels,
  };

  return { period, stages: stages.map((s) => ({ value: s.value, label: s.label })), summary, leads };
}

export default async function handler(req, res) {
  const period = ["monthly", "weekly"].includes(req.query.period) ? req.query.period : "lifetime";
  await withHubspotErrorHandling(res, () => buildSourcesPayload(getToken(), period));
}
