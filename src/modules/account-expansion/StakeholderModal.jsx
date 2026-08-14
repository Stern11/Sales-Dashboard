import { useState } from "react";
import { Modal } from "../../components/Modal.jsx";
import { useAccountExpansionMutations } from "./useAccountExpansionMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";
import { RELATIONSHIP_OPTIONS } from "./constants.js";

const EMPTY = { name: "", title: "", function: "", relationship: "unknown", expansion_area_id: "", notes: "" };

/** Add (no `stakeholder` prop) or edit (`stakeholder` prop) one stakeholder — name may be left blank if only the role is known. */
export function StakeholderModal({ accountId, stakeholder, areas, onClose, onSaved }) {
  const [values, setValues] = useState(stakeholder ? { ...EMPTY, ...stakeholder, expansion_area_id: stakeholder.expansion_area_id || "" } : EMPTY);
  const [formError, setFormError] = useState(null);
  const { addStakeholder, updateStakeholder, removeStakeholder, loading } = useAccountExpansionMutations();
  const { ensureName } = useNameTagContext();

  function patch(update) {
    setValues((v) => ({ ...v, ...update }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!values.name.trim() && !values.title.trim()) {
      setFormError("Give at least a name or a title/role.");
      return;
    }
    const actor = await ensureName();
    if (!actor) return;
    const payload = { ...values, expansion_area_id: values.expansion_area_id || null };
    try {
      if (stakeholder) {
        await updateStakeholder(accountId, stakeholder.id, payload, actor);
      } else {
        await addStakeholder(accountId, payload, actor);
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleRemove() {
    try {
      await removeStakeholder(accountId, stakeholder.id);
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
    <Modal title={stakeholder ? "Edit stakeholder" : "Add stakeholder"} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Name
            <input type="text" value={values.name || ""} onChange={(e) => patch({ name: e.target.value })} placeholder="Leave blank if not identified yet" />
          </label>
          <label>
            Title
            <input type="text" value={values.title || ""} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Head of AP" />
          </label>
        </div>
        <div className="form-row">
          <label>
            Function
            <input type="text" value={values.function || ""} onChange={(e) => patch({ function: e.target.value })} />
          </label>
          <label>
            Relationship
            <select value={values.relationship} onChange={(e) => patch({ relationship: e.target.value })}>
              {RELATIONSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
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
          {stakeholder ? <button type="button" className="btn btn-danger" onClick={handleRemove}>Remove</button> : <span />}
          <div className="form-actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
