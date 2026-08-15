// GET /api/sources?period=lifetime|monthly|weekly|custom[&from=YYYY-MM-DD][&to=YYYY-MM-DD]
// — live attribution data:
// which channel (LinkedIn Ads, Paid Search, Organic, Offline, ...) each
// contact came from, their lifecycle-stage progress, and how many meetings
// have been booked with them. Powers the Performance Marketing page
// (src/modules/marketing), which filters this down to the LinkedIn channel —
// the endpoint itself stays general so adding another ad channel later
// (Google/Meta Ads) is a frontend filter change, not a backend rewrite.
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Midnight UTC on the Monday of `now`'s week. */
function startOfUtcWeek(now) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  d.setUTCDate(d.getUTCDate() + ((day === 0 ? -6 : 1) - day));
  return d;
}

/** Midnight UTC on the 1st of `now`'s month. */
function startOfUtcMonth(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Filters scoping the contacts search to a period.
 *
 * "monthly"/"weekly" are calendar-aligned (the 1st of the current month;
 * the Monday of the current week), not a trailing 30/7-day window — "This
 * Month" on the 2nd of August means just those two days, not late July
 * onward. Anchored in UTC since this runs in a serverless function with no
 * "local" timezone of its own; matches the UTC-anchored week bucketing
 * src/modules/demo-calls/constants.js already uses for the same reason.
 *
 * "custom" builds an explicit GTE/LTE range from `from`/`to` query params
 * (either may be omitted for an open-ended range); anything that isn't a
 * well-formed YYYY-MM-DD is ignored rather than passed through to
 * HubSpot's filter API, which would otherwise reject the whole request
 * over one bad query param.
 */
function windowFilters(period, from, to) {
  if (period === "custom") {
    const filters = [];
    if (DATE_RE.test(from)) filters.push({ propertyName: "createdate", operator: "GTE", value: String(new Date(`${from}T00:00:00`).getTime()) });
    if (DATE_RE.test(to)) filters.push({ propertyName: "createdate", operator: "LTE", value: String(new Date(`${to}T23:59:59.999`).getTime()) });
    return filters;
  }
  if (period === "lifetime") return [];
  const now = new Date();
  const start = period === "monthly" ? startOfUtcMonth(now) : startOfUtcWeek(now);
  return [{ propertyName: "createdate", operator: "GTE", value: String(start.getTime()) }];
}

function channelFor(p) {
  return p.hs_analytics_source_data_1 || p.hs_analytics_source || "Unknown";
}

async function buildSourcesPayload(token, period, from, to) {
  const filters = windowFilters(period, from, to);

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
    // hubspotSearchAll stops after DEFAULT_MAX_SEARCH_PAGES (4000 contacts)
    // and marks the result `.truncated`; its own docblock asks callers to
    // surface that rather than present a partial count as the whole picture.
    // `contacts.map(...)` above drops the array's extra properties, so both
    // are read from the source array here.
    truncated: contacts.truncated === true,
    // HubSpot's true match count for the filter, which exceeds total_leads
    // whenever the page cap cut the scan short.
    total_matching: contacts.total ?? leads.length,
  };

  return { period, stages: stages.map((s) => ({ value: s.value, label: s.label })), summary, leads };
}

export default async function handler(req, res) {
  const { period: rawPeriod, from, to } = req.query;
  const period = ["monthly", "weekly", "custom"].includes(rawPeriod) ? rawPeriod : "lifetime";
  await withHubspotErrorHandling(res, () => buildSourcesPayload(getToken(), period, from, to));
}

export { windowFilters };
