import { useState } from "react";
import { Modal } from "../../components/Modal.jsx";
import { useDemoCallsMutations } from "./useDemoCallsMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";
import { ImportFromHubspotPanel } from "./ImportFromHubspotPanel.jsx";
import { outcomeOptionsFor, COMPANY_SCALE_OPTIONS, SOURCE_CATEGORIES, SOURCE_OTHER } from "./constants.js";
import { confirmIfBeforeBooked, confirmIfAnyBeforeBooked } from "./confirmBackdated.js";

const EMPTY = { company_name: "", contact_name: "", email: "", phone: "", company_scale: "", source: "" };
const NOT_LOGGED = "";

// This lead doesn't exist yet — created_at will be `now()` at insert time,
// so "today" is the right Booked date to check a same-submit first call
// against. (A hubspot_contact_id lead may end up with an earlier
// demo_stage_entered_at once the server-side lookup runs, but that isn't
// knowable client-side ahead of creating the row — see
// api/demo-calls/index.js's lookupStageEnteredAt.)
function todayAsBookedDate() {
  return new Date().toISOString();
}

/**
 * Manual entry ("+ Add Opportunity"), and also the target when a rep clicks a
 * live-but-untracked row (`prefill` carries company_name/contact_name/email/
 * hubspot_contact_id/hubspot_origin_module from useLiveDemoCallContacts.js —
 * those fields are locked since they come straight from HubSpot). Either
 * way, the first call can optionally be logged in the same submit
 * (createLead's `first_call` payload) — leaving the outcome unset skips it.
 */
export function AddDemoCallLeadModal({ onClose, onCreated, prefill }) {
  const [values, setValues] = useState({ ...EMPTY, ...prefill });
  const [callValues, setCallValues] = useState({ call_date: "", outcome: NOT_LOGGED, notes: "", next_steps: "", transcript_url: "" });
  const [formError, setFormError] = useState(null);
  const [importing, setImporting] = useState(false);
  const { createLead, addCall, loading } = useDemoCallsMutations();
  const { ensureName } = useNameTagContext();
  const locked = !!prefill;

  // The dropdown shows one of the fixed categories, or "Other" whenever the
  // current value isn't one of them (covers both "user picked Other and is
  // typing" and a blank/never-chosen value) — same pattern as Sales
  // Pipeline's LeadFieldsForm.jsx.
  const sourceCategory = SOURCE_CATEGORIES.includes(values.source) ? values.source : SOURCE_OTHER;

  function patch(update) {
    setValues((v) => ({ ...v, ...update }));
  }
  function patchCall(update) {
    setCallValues((v) => {
      const next = { ...v, ...update };
      // A future call_date can only be "Scheduled"; any other date can't be
      // — switching the date can silently invalidate an already-picked
      // outcome. NOT_LOGGED ("— not logged yet —") is always left alone,
      // it's not one of outcomeOptionsFor()'s real outcome values.
      if ("call_date" in update && next.outcome) {
        const allowed = outcomeOptionsFor(next.call_date);
        if (!allowed.some((o) => o.value === next.outcome)) next.outcome = allowed[0].value;
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!values.company_name.trim() || !values.contact_name.trim()) {
      setFormError("Company name and contact name are required.");
      return;
    }
    // Source only applies to true manual entry — a locked/prefilled lead's
    // origin is already captured by hubspot_origin_module (which live view
    // surfaced it), so there's nothing for a rep to pick there.
    if (!locked && !values.source.trim()) {
      setFormError("Source is required.");
      return;
    }
    if (callValues.outcome && !confirmIfBeforeBooked(callValues.call_date, todayAsBookedDate())) return;
    const actor = await ensureName();
    if (!actor) return;

    try {
      const { lead } = await createLead(
        { ...values, company_scale: values.company_scale || null, first_call: callValues.outcome ? callValues : null },
        actor
      );
      onCreated?.(lead);
      onClose();
    } catch (err) {
      if (err.status === 409) {
        setFormError(`Already being tracked (id: ${err.body?.existing_lead?.id || "unknown"}).`);
      } else {
        setFormError(err.message);
      }
    }
  }

  // Selected engagements from ImportFromHubspotPanel come pre-chronological.
  // createLead's first_call payload only carries one call, so the first
  // selected engagement rides along with lead creation and the rest are
  // appended one at a time — sequentially, not in parallel, since addCall
  // assigns call_number from the current row count and parallel requests
  // would race on that read.
  async function handleImportFromHubspot(payloads) {
    if (!payloads.length) return;
    setFormError(null);
    if (!values.company_name.trim() || !values.contact_name.trim()) {
      setFormError("Company name and contact name are required.");
      return;
    }
    if (!confirmIfAnyBeforeBooked(payloads.map((p) => p.call_date), todayAsBookedDate())) return;
    const actor = await ensureName();
    if (!actor) return;

    setImporting(true);
    try {
      const [first, ...rest] = payloads;
      const { lead } = await createLead(
        { ...values, company_scale: values.company_scale || null, first_call: first },
        actor
      );
      for (const payload of rest) {
        await addCall(lead.id, payload, actor);
      }
      onCreated?.(lead);
      onClose();
    } catch (err) {
      if (err.status === 409) {
        setFormError(`Already being tracked (id: ${err.body?.existing_lead?.id || "unknown"}).`);
      } else {
        setFormError(err.message);
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal title={locked ? "Log first meeting" : "Add opportunity to Meetings"} onClose={onClose} wide>
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Company name
            <input type="text" value={values.company_name} onChange={(e) => patch({ company_name: e.target.value })} disabled={locked} required />
          </label>
          <label>
            Contact name
            <input type="text" value={values.contact_name} onChange={(e) => patch({ contact_name: e.target.value })} disabled={locked} required />
          </label>
        </div>
        <div className="form-row">
          <label>
            Email
            <input type="email" value={values.email} onChange={(e) => patch({ email: e.target.value })} disabled={locked} />
          </label>
          <label>
            Phone
            <input type="tel" value={values.phone} onChange={(e) => patch({ phone: e.target.value })} />
          </label>
        </div>
        {!locked && (
          <>
            <label>
              Source
              <select
                value={sourceCategory}
                onChange={(e) => patch({ source: e.target.value === SOURCE_OTHER ? "" : e.target.value })}
                required
              >
                <option value="" disabled hidden>— Select —</option>
                {SOURCE_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value={SOURCE_OTHER}>{SOURCE_OTHER}</option>
              </select>
            </label>
            {sourceCategory === SOURCE_OTHER && (
              <label>
                Where did this lead come from?
                <input
                  type="text"
                  value={values.source}
                  onChange={(e) => patch({ source: e.target.value })}
                  placeholder="e.g. Cold outbound, trade show…"
                  required
                />
              </label>
            )}
          </>
        )}
        <label>
          Scale of company
          <select value={values.company_scale || ""} onChange={(e) => patch({ company_scale: e.target.value })}>
            <option value="">—</option>
            {COMPANY_SCALE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        {prefill?.hubspot_contact_id && (
          <ImportFromHubspotPanel
            contactId={prefill.hubspot_contact_id}
            onImport={handleImportFromHubspot}
            importing={importing}
          />
        )}

        <h4 style={{ margin: "6px 0 0", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-muted)" }}>
          First meeting (optional — you can log it later instead)
        </h4>
        <div className="form-row">
          <label>
            Date
            <input type="date" value={callValues.call_date} onChange={(e) => patchCall({ call_date: e.target.value })} />
          </label>
          <label>
            Outcome
            <select value={callValues.outcome} onChange={(e) => patchCall({ outcome: e.target.value })}>
              <option value={NOT_LOGGED}>— not logged yet —</option>
              {outcomeOptionsFor(callValues.call_date).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        {callValues.outcome && (
          <>
            <label>
              Meeting notes
              <textarea value={callValues.notes} onChange={(e) => patchCall({ notes: e.target.value })} />
            </label>
            <label>
              Next steps
              <textarea value={callValues.next_steps} onChange={(e) => patchCall({ next_steps: e.target.value })} />
            </label>
            <label>
              Transcript link
              <input type="text" value={callValues.transcript_url} onChange={(e) => patchCall({ transcript_url: e.target.value })} placeholder="https://…" />
            </label>
          </>
        )}

        {formError && <p className="form-error">{formError}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
