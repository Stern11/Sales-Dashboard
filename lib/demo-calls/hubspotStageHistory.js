// Determines when a HubSpot contact first reached a given lifecycle stage
// (or any stage at/beyond it), via HubSpot's Property History API.
//
// Why this exists: demo_call_leads.created_at is when the tracking row was
// inserted, not when the contact actually reached the Demo Call stage in
// HubSpot. For a lead an SDR tracks the same day they call it, those are
// the same thing. For a lead tracked days or weeks later — or backfilled
// via "Import from HubSpot" — they can differ by months, which is what
// produced a lead reading "Booked this week" carrying a meeting logged for
// a date back in June. demo_stage_entered_at (see migration 0015) is the
// more accurate date; this module is how it gets computed.

import { hubspotGet } from "../hubspot.js";

/**
 * Returns the ISO timestamp of the earliest lifecyclestage history entry
 * whose value is at or beyond `targetStageValue` in `stages` order (the
 * same ordered list getLifecycleStages() returns), or null if the contact
 * has no such entry on file.
 *
 * "No entry on file" is a real, unremarkable case, not just an error path:
 * HubSpot doesn't always retroactively record a history entry for whatever
 * value a property held at contact-creation time, so a contact created
 * directly into (or before this integration existed) the Demo Call stage
 * can have no matching transition in its history. Callers should fall back
 * to created_at when this returns null — see bookedDateOf() in
 * src/modules/demo-calls/constants.js.
 */
export async function fetchStageEnteredAt(token, contactId, stages, targetStageValue) {
  const stageIndex = (value) => stages.findIndex((s) => s.value === value);
  const targetIdx = stageIndex(targetStageValue);
  if (targetIdx < 0) return null;

  const contact = await hubspotGet(
    token,
    `/crm/v3/objects/contacts/${contactId}?properties=lifecyclestage&propertiesWithHistory=lifecyclestage`
  );
  const history = contact?.propertiesWithHistory?.lifecyclestage || [];
  if (!history.length) return null;

  // HubSpot returns history newest-first; sort ascending so "find" below
  // returns the *first* time they reached the target, not the most recent —
  // a contact who regressed and re-progressed should still be dated from
  // when they first got there.
  const ascending = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const entered = ascending.find((h) => stageIndex(h.value) >= targetIdx);
  return entered?.timestamp || null;
}
