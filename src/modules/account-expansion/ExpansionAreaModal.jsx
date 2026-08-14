import { useState } from "react";
import { Modal } from "../../components/Modal.jsx";
import { useAccountExpansionMutations } from "./useAccountExpansionMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";
import { AREA_STATUS_OPTIONS, RELEVANCE_OPTIONS } from "./constants.js";

const EMPTY = { area: "", use_case: "", why_relevant: "", status: "idea", relevance: "medium", needs_validation: "", notes: "" };

/** Add (no `area` prop) or edit (`area` prop = existing row) one expansion hypothesis. */
export function ExpansionAreaModal({ accountId, area, onClose, onSaved }) {
  const [values, setValues] = useState(area ? { ...EMPTY, ...area } : EMPTY);
  const [formError, setFormError] = useState(null);
  const { addArea, updateArea, loading } = useAccountExpansionMutations();
  const { ensureName } = useNameTagContext();

  function patch(update) {
    setValues((v) => ({ ...v, ...update }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!values.area.trim()) {
      setFormError("Expansion area / function is required.");
      return;
    }
    const actor = await ensureName();
    if (!actor) return;
    try {
      if (area) {
        await updateArea(accountId, area.id, values, actor);
      } else {
        await addArea(accountId, values, actor);
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err.message);
    }
  }

  return (
    <Modal title={area ? "Edit expansion area" : "Add expansion area"} onClose={onClose} wide>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Expansion Area / Function
          <input type="text" value={values.area} onChange={(e) => patch({ area: e.target.value })} placeholder="e.g. Finance Operations" required />
        </label>
        <label>
          Potential Use Case
          <input type="text" value={values.use_case || ""} onChange={(e) => patch({ use_case: e.target.value })} />
        </label>
        <label>
          Why this may be relevant
          <textarea value={values.why_relevant || ""} onChange={(e) => patch({ why_relevant: e.target.value })} />
        </label>
        <div className="form-row">
          <label>
            Status
            <select value={values.status} onChange={(e) => patch({ status: e.target.value })}>
              {AREA_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label>
            Relevance
            <select value={values.relevance} onChange={(e) => patch({ relevance: e.target.value })}>
              {RELEVANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <label>
          What needs to be validated
          <textarea value={values.needs_validation || ""} onChange={(e) => patch({ needs_validation: e.target.value })} />
        </label>
        <label>
          Notes
          <textarea value={values.notes || ""} onChange={(e) => patch({ notes: e.target.value })} />
        </label>
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
