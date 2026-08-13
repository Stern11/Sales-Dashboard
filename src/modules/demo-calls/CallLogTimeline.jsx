import { useState } from "react";
import { StatusPill } from "../../components/StatusPill.jsx";
import { useDemoCallsMutations } from "./useDemoCallsMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";
import { outcomeMeta, outcomeOptionsFor, relativeTime, formatCallDate } from "./constants.js";

const EMPTY_CALL_FORM = { call_date: "", outcome: "completed", notes: "", next_steps: "", transcript_url: "" };

function CallForm({ initial, onCancel, onSubmit, loading, submitLabel }) {
  // Pre-correct on mount too, not just on date changes below — editing an
  // existing call that was "Scheduled" for a date that's since arrived
  // shouldn't leave the select showing a now-invalid value.
  const [values, setValues] = useState(() => {
    const allowed = outcomeOptionsFor(initial.call_date);
    return allowed.some((o) => o.value === initial.outcome) ? initial : { ...initial, outcome: allowed[0].value };
  });
  function patch(update) {
    setValues((v) => {
      const next = { ...v, ...update };
      // A future call_date can only be "Scheduled"; any other date can't be
      // — switching the date can silently invalidate whatever outcome was
      // already picked, so re-pin it to the first still-valid choice.
      if ("call_date" in update) {
        const allowed = outcomeOptionsFor(next.call_date);
        if (!allowed.some((o) => o.value === next.outcome)) next.outcome = allowed[0].value;
      }
      return next;
    });
  }
  const outcomeOptions = outcomeOptionsFor(values.call_date);
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="form-row">
        <label>
          Date
          <input type="date" value={values.call_date || ""} onChange={(e) => patch({ call_date: e.target.value })} />
        </label>
        <label>
          Outcome
          <select value={values.outcome} onChange={(e) => patch({ outcome: e.target.value })}>
            {outcomeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <label>
        Meeting notes
        <textarea value={values.notes || ""} onChange={(e) => patch({ notes: e.target.value })} placeholder="What was discussed…" />
      </label>
      <label>
        Next steps
        <textarea value={values.next_steps || ""} onChange={(e) => patch({ next_steps: e.target.value })} placeholder="What happens next…" />
      </label>
      <label>
        Transcript link
        <input type="text" value={values.transcript_url || ""} onChange={(e) => patch({ transcript_url: e.target.value })} placeholder="https://…" />
      </label>
      <div className="form-actions">
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}

function CallEntry({ call, onSaved }) {
  const [editing, setEditing] = useState(false);
  const { updateCall, loading, error } = useDemoCallsMutations();
  const { ensureName } = useNameTagContext();

  async function handleSave(values) {
    const actor = await ensureName();
    if (!actor) return;
    const { call: updated } = await updateCall(call.lead_id, call.id, values, actor);
    setEditing(false);
    onSaved?.(updated);
  }

  if (editing) {
    return (
      <div className="note-item">
        <div className="note-item-meta"><span>Editing Meeting {call.call_number}</span></div>
        <CallForm
          initial={{
            call_date: call.call_date || "", outcome: call.outcome,
            notes: call.notes || "", next_steps: call.next_steps || "", transcript_url: call.transcript_url || "",
          }}
          onCancel={() => setEditing(false)}
          onSubmit={handleSave}
          loading={loading}
          submitLabel="Save"
        />
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  }

  const edited = call.updated_at && call.created_at && call.updated_at !== call.created_at;

  return (
    <div className="note-item">
      <div className="call-entry-header">
        <div className="call-entry-title">
          <span className="call-entry-number">Meeting {call.call_number}</span>
          <span className="call-entry-date">{formatCallDate(call.call_date) || "No date set"}</span>
          <StatusPill variant={outcomeMeta(call.outcome).pillVariant}>{outcomeMeta(call.outcome).label}</StatusPill>
        </div>
        <button type="button" className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit meeting">✎</button>
      </div>
      <div className="note-item-meta" style={{ marginBottom: 8 }}>
        <span>Logged by {call.created_by}</span>
        <span>{edited ? `Edited ${relativeTime(call.updated_at)}` : relativeTime(call.created_at)}</span>
      </div>
      {call.notes ? (
        <div className="call-entry-field">
          <div className="call-entry-field-label">Notes</div>
          <div className="note-item-body">{call.notes}</div>
        </div>
      ) : (
        <p className="notes-empty">No notes added.</p>
      )}
      {call.next_steps && (
        <div className="call-entry-field">
          <div className="call-entry-field-label">Next Steps</div>
          <div className="note-item-body">{call.next_steps}</div>
        </div>
      )}
      {call.transcript_url && (
        <div className="call-entry-field">
          <div className="call-entry-field-label">Transcript</div>
          <a href={call.transcript_url} target="_blank" rel="noopener noreferrer">{call.transcript_url} ↗</a>
        </div>
      )}
    </div>
  );
}

export function CallLogTimeline({ leadId, calls, onChanged }) {
  const [adding, setAdding] = useState(calls.length === 0);
  const { addCall, loading, error } = useDemoCallsMutations();
  const { ensureName } = useNameTagContext();

  async function handleAdd(values) {
    const actor = await ensureName();
    if (!actor) return;
    await addCall(leadId, values, actor);
    setAdding(false);
    onChanged?.();
  }

  return (
    <div>
      <div className="notes-timeline" style={{ marginBottom: 14 }}>
        {calls.map((c) => (
          <CallEntry key={c.id} call={{ ...c, lead_id: leadId }} onSaved={onChanged} />
        ))}
        {calls.length === 0 && !adding && <p className="notes-empty">No meetings logged yet.</p>}
      </div>
      {adding ? (
        <>
          <CallForm
            initial={EMPTY_CALL_FORM}
            onCancel={calls.length > 0 ? () => setAdding(false) : undefined}
            onSubmit={handleAdd}
            loading={loading}
            submitLabel={`Log Meeting ${calls.length + 1}`}
          />
          {error && <p className="form-error">{error}</p>}
        </>
      ) : (
        <button type="button" className="btn" onClick={() => setAdding(true)}>+ Log Meeting {calls.length + 1}</button>
      )}
    </div>
  );
}
