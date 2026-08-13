// Read-only HubSpot lookup backing the Demo Calls "Import from HubSpot"
// panel — pulls what HubSpot already has on file for a contact so a rep
// backfilling old calls isn't typing dates/notes from scratch. See
// docs/ARCHITECTURE.md's "Demo Calls data model" for the full reasoning;
// the short version:
//
// - Only Meetings and Notes are fetched. HubSpot's Calls object is SDR
//   cold-calling activity (dialing a lead), a different thing entirely from
//   a Demo Call in this app (the team meeting a lead live, e.g. Google
//   Meet) — importing a Call as a demo-call log entry would be wrong, not
//   just noisy, so Calls are never fetched here.
// - `no_show_hint` is a HubSpot-reported fact (hs_meeting_outcome ===
//   "NO_SHOW"), not a suggestion this module trusts — HubSpot's outcome
//   field is frequently never filled in by reps, so its *absence* means
//   nothing either way. The caller (the frontend panel) surfaces the hint
//   as a badge only; it never uses it to pre-fill the outcome a rep
//   confirms before saving.
import { hubspotBatchAssociations, hubspotSearch, HubspotScopeError } from "../hubspot.js";

const MEETING_PROPERTIES = ["hs_meeting_start_time", "hs_meeting_title", "hs_meeting_body", "hs_meeting_outcome"];
const NOTE_PROPERTIES = ["hs_timestamp", "hs_note_body"];

async function fetchAssociatedObjects(token, contactId, objectType, properties) {
  const assocMap = await hubspotBatchAssociations(token, "contacts", objectType, [contactId]);
  const ids = assocMap.get(String(contactId)) || [];
  if (!ids.length) return [];
  return hubspotSearch(token, objectType, ids, properties);
}

// hs_note_body/hs_meeting_body come back as rich-text HTML from HubSpot's
// editor — this module's own notes field is plain text (rendered as-is, not
// dangerouslySetInnerHTML, see CallLogTimeline.jsx), so raw markup would
// show up as literal <div>/<p> tags in the UI. A regex strip is enough here:
// this is trusted HubSpot data being flattened for display, not user input
// being rendered as HTML, so no sanitizer/DOM parser is needed.
function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeMeeting(m) {
  const p = m.properties || {};
  return {
    id: m.id,
    type: "meeting",
    timestamp: p.hs_meeting_start_time || null,
    title: p.hs_meeting_title || "(untitled meeting)",
    body: stripHtml(p.hs_meeting_body),
    no_show_hint: p.hs_meeting_outcome === "NO_SHOW",
    recording_url: null,
  };
}

function normalizeNote(n) {
  const p = n.properties || {};
  return {
    id: n.id,
    type: "note",
    timestamp: p.hs_timestamp || null,
    title: "Note",
    body: stripHtml(p.hs_note_body),
    no_show_hint: false,
    recording_url: null,
  };
}

/**
 * Fetches Meetings (+ Notes, if that scope happens to be granted) logged
 * against a HubSpot contact, normalized and sorted chronologically. Notes
 * failing on a missing scope degrades to `notes_available: false` rather
 * than failing the whole request — Meetings are the feature's real
 * candidate; Notes are a bonus if available.
 */
export async function fetchEngagementsForContact(token, contactId) {
  const meetings = (await fetchAssociatedObjects(token, contactId, "meetings", MEETING_PROPERTIES)).map(normalizeMeeting);

  let notes = [];
  let notesAvailable = true;
  try {
    notes = (await fetchAssociatedObjects(token, contactId, "notes", NOTE_PROPERTIES)).map(normalizeNote);
  } catch (err) {
    if (err instanceof HubspotScopeError) {
      notesAvailable = false;
    } else {
      throw err;
    }
  }

  const engagements = [...meetings, ...notes].sort(
    (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
  );

  return { engagements, notes_available: notesAvailable };
}
