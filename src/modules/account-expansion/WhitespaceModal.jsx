import { useState } from "react";
import { Modal } from "../../components/Modal.jsx";
import { useAccountExpansionMutations } from "./useAccountExpansionMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";
import { WHITESPACE_STATUS_OPTIONS } from "./constants.js";

/** Add (no `row` prop) or edit (`row` prop) one whitespace area — area name + Current/Potential/Unknown status, nothing more. */
export function WhitespaceModal({ accountId, row, onClose, onSaved }) {
  const [area, setArea] = useState(row?.area || "");
  const [status, setStatus] = useState(row?.status || "unknown");
  const [formError, setFormError] = useState(null);
  const { setWhitespace, removeWhitespace, loading } = useAccountExpansionMutations();
  const { ensureName } = useNameTagContext();

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!area.trim()) {
      setFormError("Area is required.");
      return;
    }
    const actor = await ensureName();
    if (!actor) return;
    try {
      await setWhitespace(accountId, { area: area.trim(), status }, actor);
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleRemove() {
    try {
      await removeWhitespace(accountId, row.id);
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
    <Modal title={row ? "Edit whitespace area" : "Add whitespace area"} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Area
          <input type="text" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Finance" disabled={!!row} required />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {WHITESPACE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-row-actions">
          {row ? <button type="button" className="btn btn-danger" onClick={handleRemove}>Remove</button> : <span />}
          <div className="form-actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
