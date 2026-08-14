import { useState } from "react";
import { Modal } from "../../components/Modal.jsx";
import { useAccountExpansionMutations } from "./useAccountExpansionMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";
import { SIGNAL_TYPE_OPTIONS } from "./constants.js";

const EMPTY = { signal_date: "", signal_type: "company_strategy", finding: "", source_url: "", expansion_area_id: "", notes: "" };

/** Add (no `signal` prop) or edit (`signal` prop) one research signal. */
export function SignalModal({ accountId, signal, areas, onClose, onSaved }) {
  const [values, setValues] = useState(signal ? { ...EMPTY, ...signal, expansion_area_id: signal.expansion_area_id || "" } : EMPTY);
  const [formError, setFormError] = useState(null);
  const { addSignal, updateSignal, removeSignal, loading } = useAccountExpansionMutations();
  const { ensureName } = useNameTagContext();

  function patch(update) {
    setValues((v) => ({ ...v, ...update }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!values.signal_date) {
      setFormError("Date is required.");
      return;
    }
    if (!values.finding.trim()) {
      setFormError("Finding is required.");
      return;
    }
    const actor = await ensureName();
    if (!actor) return;
    const payload = { ...values, expansion_area_id: values.expansion_area_id || null };
    try {
      if (signal) {
        await updateSignal(accountId, signal.id, payload, actor);
      } else {
        await addSignal(accountId, payload, actor);
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleRemove() {
    try {
      await removeSignal(accountId, signal.id);
      onSaved();
      onClose();
    } catch (err) {
      // Caught so a failed write isn't an unhandled promise rejection.
      // The message itself is already on screen: the mutation hook stores
      // it in `error`, which this component renders below.
      console.error("handleRemove failed:", err);
    }
  }

  return (
    <Modal title={signal ? "Edit research signal" : "Add research signal"} onClose={onClose} wide>
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Date
            <input type="date" value={values.signal_date} onChange={(e) => patch({ signal_date: e.target.value })} required />
          </label>
          <label>
            Signal Type
            <select value={values.signal_type} onChange={(e) => patch({ signal_type: e.target.value })}>
              {SIGNAL_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <label>
          Finding
          <textarea value={values.finding} onChange={(e) => patch({ finding: e.target.value })} placeholder="What was observed…" required />
        </label>
        <label>
          Source / URL
          <input type="text" value={values.source_url || ""} onChange={(e) => patch({ source_url: e.target.value })} placeholder="https://…" />
        </label>
        <label>
          Relevant Expansion Area
          <select value={values.expansion_area_id || ""} onChange={(e) => patch({ expansion_area_id: e.target.value })}>
            <option value="">—</option>
            {(areas || []).filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.area}</option>)}
          </select>
        </label>
        <label>
          Notes
          <textarea value={values.notes || ""} onChange={(e) => patch({ notes: e.target.value })} />
        </label>
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-row-actions">
          {signal ? <button type="button" className="btn btn-danger" onClick={handleRemove}>Remove</button> : <span />}
          <div className="form-actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
