// Shared ABM data-shaping logic for api/abm/index.js. The frontend combines
// multiple segments' worth of this into "Overall ABM Effort" client-side
// (src/modules/abm/useAbmData.js) rather than a server-side aggregate
// endpoint — see the comment in api/abm/index.js for why.
//
// Calling status comes from real logged Calls (crm/v4 associations + calls
// search) — no custom HubSpot property needed. Email funnel can't read the
// raw send-log (crm.objects.emails.read / sales-email-read scopes aren't
// available on this HubSpot plan — see docs/ARCHITECTURE.md), so it's built
// from two signals that already are: `hs_sales_email_last_opened/clicked/
// replied` (set once the recipient acts on a tracked email) and
// `notes_last_contacted` (HubSpot's generic "last contacted" rollup, which
// does get bumped by the Sales Chrome/Outlook extension logging a sent
// email — confirmed against real data on 2026-07-30: leads with a fresh
// `notes_last_contacted` and zero associated Calls). Without the latter,
// "sent but not yet opened" was indistinguishable from "never contacted at
// all" — everyone landed in the same bucket regardless.

import { hubspotGet, hubspotSearch, hubspotBatchAssociations } from "./hubspot.js";

const CONTACT_PROPERTIES = [
  "firstname", "lastname", "email", "jobtitle", "hs_linkedin_url",
  "linkedin_reachout_status", "hs_lead_status", "lifecyclestage", "createdate",
  "hs_sales_email_last_opened", "hs_sales_email_last_clicked", "hs_sales_email_last_replied",
  "notes_last_contacted", "num_notes",
];

const CALL_PROPERTIES = ["hs_call_status", "hs_call_direction", "hs_timestamp"];

// hs_call_status is a fixed HubSpot enum (unlike hs_call_disposition, which is
// a per-portal custom list) — collapsing it to 3 stages keeps the funnel
// meaningful without depending on disposition values that vary by account.
const CALL_STATUS_STAGE = {
  COMPLETED: "Connected",
  BUSY: "Attempted", NO_ANSWER: "Attempted", FAILED: "Attempted", CANCELED: "Attempted", MISSED: "Attempted",
  CONNECTING: "Attempted", IN_PROGRESS: "Attempted", QUEUED: "Attempted", RINGING: "Attempted",
  HOLD: "Attempted", CALLING_CRM_USER: "Attempted",
};

export const LINKEDIN_STAGES = ["Not Started", "Request Sent", "Request Accepted", "Message Sent", "Responded", "Meeting Scheduled"];
export const CALLING_STAGES = ["Not Called", "Attempted", "Connected"];
export const EMAIL_STAGES = ["No Email On File", "Not Yet Contacted", "Sent, No Response", "Opened", "Clicked", "Replied"];

function callingStatusFor(calls) {
  if (!calls.length) return "Not Called";
  const latest = [...calls].sort((a, b) => new Date(b.hs_timestamp || 0) - new Date(a.hs_timestamp || 0))[0];
  return CALL_STATUS_STAGE[latest.hs_call_status] || "Attempted";
}

/** Furthest stage reached in the one-to-one email funnel (mutually exclusive). */
function emailStageFor(lead) {
  if (!lead.email) return "No Email On File";
  if (lead.email_replied) return "Replied";
  if (lead.email_clicked) return "Clicked";
  if (lead.email_opened) return "Opened";
  if (lead.contacted) return "Sent, No Response";
  return "Not Yet Contacted";
}

/**
 * Live lifecycle-stage definitions (value/label/order) for this portal.
 * Fetched once and passed into buildAbmPayload — a "Demo Call / meeting
 * happened" isn't its own property; it's `lifecyclestage` reaching the stage
 * this portal has labeled "Demo Call" (value `opportunity`). That's a
 * different signal than the LinkedIn funnel's "Meeting Scheduled" stage,
 * which only reflects the LinkedIn outreach sequence, not whether a demo
 * actually happened.
 */
export async function getLifecycleStages(token) {
  const stageProp = await hubspotGet(token, "/crm/v3/properties/contacts/lifecyclestage");
  return [...(stageProp.options || [])].sort((a, b) => a.displayOrder - b.displayOrder);
}

/** Fetches and shapes one segment's full companies/leads/funnels from HubSpot. */
export async function buildAbmPayload(token, segment) {
  const contactIds = segment.leads.map((l) => l.id);

  // All three are independent — the lifecycle-stage property definitions
  // don't depend on which contacts are in the segment. The caller used to
  // await the stages first and only then call this, which put that round
  // trip in front of every ABM request for no reason (api/sources already
  // fetched its equivalent concurrently; the two disagreed).
  const [stages, contacts, contactCallIds] = await Promise.all([
    getLifecycleStages(token),
    hubspotSearch(token, "contacts", contactIds, CONTACT_PROPERTIES),
    hubspotBatchAssociations(token, "contacts", "calls", contactIds),
  ]);

  const demoStageIndex = stages.findIndex((s) => s.value === "opportunity");
  const stageIndex = (value) => stages.findIndex((s) => s.value === value);

  const allCallIds = [...new Set([].concat(...contactCallIds.values()))];
  let callById = {};
  if (allCallIds.length) {
    const calls = await hubspotSearch(token, "calls", allCallIds, CALL_PROPERTIES);
    callById = Object.fromEntries(calls.map((c) => [String(c.id), c.properties || {}]));
  }

  const contactById = Object.fromEntries(contacts.map((c) => [String(c.id), c.properties || {}]));

  const leads = segment.leads.map((l) => {
    const p = contactById[String(l.id)] || {};
    const email = p.email || null;
    const calls = (contactCallIds.get(String(l.id)) || []).map((id) => callById[String(id)]).filter(Boolean);
    const lead = {
      contact_id: l.id,
      company: l.co,
      flag: l.flag,
      first: p.firstname || "",
      last: p.lastname || "",
      title: p.jobtitle || "",
      email,
      email_status: email ? "Ready to Send (email on file)" : "No Email Found (Apollo)",
      linkedin_url: p.hs_linkedin_url || null,
      linkedin_reachout_status: p.linkedin_reachout_status || null,
      contacted: !!p.notes_last_contacted,
      email_opened: !!p.hs_sales_email_last_opened,
      email_clicked: !!p.hs_sales_email_last_clicked,
      email_replied: !!p.hs_sales_email_last_replied,
      num_calls: calls.length,
      calling_status: callingStatusFor(calls),
      lifecycle_stage: p.lifecyclestage || null,
      // Only consumed today by useLiveDemoCallContacts.js, to age off very
      // old "not yet logged" placeholder rows on the Meetings page — not
      // otherwise shown or used within ABM itself.
      created_at: p.createdate || null,
      meeting_done: demoStageIndex >= 0 && stageIndex(p.lifecyclestage) >= demoStageIndex,
    };
    lead.email_funnel_stage = emailStageFor(lead);
    return lead;
  });

  const notStarted = leads.filter((l) => !l.linkedin_reachout_status).length;
  const linkedin_funnel = [
    { stage: "Not Started", count: notStarted },
    ...LINKEDIN_STAGES.slice(1).map((stage) => ({
      stage,
      count: leads.filter((l) => l.linkedin_reachout_status === stage).length,
    })),
  ];

  const calling_funnel = CALLING_STAGES.map((stage) => ({
    stage,
    count: leads.filter((l) => l.calling_status === stage).length,
  }));

  const email_funnel = EMAIL_STAGES.map((stage) => ({
    stage,
    count: leads.filter((l) => l.email_funnel_stage === stage).length,
  }));

  const meetingLeads = leads.filter((l) => l.meeting_done);

  const summary = {
    total_companies: segment.companies.length,
    total_leads: segment.leads.length,
    emails_on_file: leads.filter((l) => l.email).length,
    emails_missing: leads.filter((l) => !l.email).length,
    meetings_done: meetingLeads.length,
    // Not mutually exclusive — a lead can show engagement on more than one
    // channel before converting, so these don't have to sum to meetings_done.
    // There's no single "this channel booked this meeting" field in HubSpot;
    // this is "was that channel engaged" among leads that reached Demo Call.
    meetings_by_channel: {
      email: meetingLeads.filter((l) => l.contacted || l.email_opened || l.email_clicked || l.email_replied).length,
      linkedin: meetingLeads.filter((l) => l.linkedin_reachout_status).length,
      calls: meetingLeads.filter((l) => l.num_calls > 0).length,
    },
    linkedin_funnel,
    calling_funnel,
    email_funnel,
    email_engagement: {
      opened: leads.filter((l) => l.email_opened).length,
      clicked: leads.filter((l) => l.email_clicked).length,
      replied: leads.filter((l) => l.email_replied).length,
    },
  };

  return { segment: { id: segment.id, label: segment.label }, summary, leads };
}
