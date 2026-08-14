import { useMemo, useState } from "react";
import { EMPTY_ARRAY } from "../../lib/empty.js";
import { AsyncState } from "../../components/AsyncState.jsx";
import { StatusPill } from "../../components/StatusPill.jsx";
import { useHubspotEngagements } from "./useDemoCallsData.js";
import { OUTCOME_OPTIONS } from "./constants.js";

const TYPE_LABELS = { meeting: "Meeting", note: "Note" };

// engagement.timestamp is an ISO-8601 string from HubSpot; converted to the
// local calendar date so it matches what a rep sees/expects from a plain
// <input type="date"> elsewhere in this module — not UTC, which can land on
// the wrong day depending on the meeting's actual local time.
function toLocalDateInputValue(isoTimestamp) {
  if (!isoTimestamp) return "";
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function EngagementRow({ engagement, selected, onToggle, outcome, onOutcomeChange }) {
  return (
    <div className="note-item">
      <div className="note-item-meta">
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={selected} onChange={onToggle} />
          <span>{TYPE_LABELS[engagement.type] || engagement.type}</span>
        </label>
        <span>{engagement.timestamp ? new Date(engagement.timestamp).toLocaleDateString() : "No date on file"}</span>
        {engagement.no_show_hint && <StatusPill variant="lost">HubSpot: No Show</StatusPill>}
      </div>
      <div className="note-item-body" style={{ fontWeight: 600 }}>{engagement.title}</div>
      {engagement.body ? (
        <p className="note-item-body" style={{ whiteSpace: "pre-wrap" }}>{engagement.body}</p>
      ) : (
        <p className="notes-empty">No notes text on this record.</p>
      )}
      {selected && (
        <label style={{ marginTop: 8, display: "block", maxWidth: 220 }}>
          Outcome for this meeting
          <select value={outcome} onChange={(e) => onOutcomeChange(e.target.value)}>
            <option value="">— not logged yet —</option>
            {OUTCOME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

/**
 * Review panel for backfilling call log entries from HubSpot Meetings/Notes
 * on file for a contact. Deliberately never fetches or shows HubSpot Calls
 * (SDR cold-calling activity, not a Demo Call in this app's vocabulary —
 * see lib/demo-calls/hubspotEngagements.js) and never pre-fills an outcome:
 * HubSpot's own attendance field is frequently unset, so every row starts
 * with outcome unset and importing is blocked until each selected row has
 * one picked explicitly. `onImport` receives an array of
 * {call_date, outcome, notes, next_steps, transcript_url} payloads in
 * chronological order — the caller is responsible for actually creating the
 * lead/call log entries (createLead/addCall), since that differs by call site.
 */
export function ImportFromHubspotPanel({ contactId, onImport, importing }) {
  const [open, setOpen] = useState(false);
  const { data, loading, error } = useHubspotEngagements(open ? contactId : null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [outcomes, setOutcomes] = useState({});

  const engagements = data?.engagements ?? EMPTY_ARRAY;

  function toggle(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selected = useMemo(() => engagements.filter((e) => selectedIds.has(e.id)), [engagements, selectedIds]);
  const readyToImport = selected.length > 0 && selected.every((e) => outcomes[e.id]);

  function handleImport() {
    const payloads = selected.map((e) => ({
      call_date: toLocalDateInputValue(e.timestamp),
      outcome: outcomes[e.id],
      notes: e.body || "",
      next_steps: "",
      transcript_url: "",
    }));
    onImport(payloads);
    setSelectedIds(new Set());
    setOutcomes({});
  }

  if (!contactId) return null;

  return (
    <div className="lead-detail-section">
      <button type="button" className="btn" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide" : "Import from HubSpot"}
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          <p className="subtitle">
            Meetings and Notes HubSpot has on file for this contact — confirm what actually
            happened before importing. HubSpot's own attendance field is often not filled in,
            so nothing here is pre-marked "Completed."
          </p>
          <AsyncState loading={loading} error={error} empty={!loading && !error && engagements.length === 0} emptyMessage="Nothing logged in HubSpot for this contact.">
            <div className="notes-timeline" style={{ marginBottom: 12 }}>
              {engagements.map((e) => (
                <EngagementRow
                  key={e.id}
                  engagement={e}
                  selected={selectedIds.has(e.id)}
                  onToggle={() => toggle(e.id)}
                  outcome={outcomes[e.id] || ""}
                  onOutcomeChange={(v) => setOutcomes((prev) => ({ ...prev, [e.id]: v }))}
                />
              ))}
            </div>
            {data && data.notes_available === false && (
              <p className="subtitle">
                HubSpot Notes aren't readable with the current token — add
                <code> crm.objects.notes.read</code> in the Private App to include those too
                (no redeploy needed).
              </p>
            )}
            <button type="button" className="btn btn-primary" onClick={handleImport} disabled={!readyToImport || importing}>
              {importing ? "Importing…" : `Import ${selected.length || ""} selected`.trim()}
            </button>
          </AsyncState>
        </div>
      )}
    </div>
  );
}
