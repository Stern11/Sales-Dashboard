import { useState } from "react";
import { Modal } from "../../components/Modal.jsx";
import { useAccountExpansionMutations } from "./useAccountExpansionMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";
import { EXPANSION_OUTLOOK_OPTIONS } from "./constants.js";

const EMPTY = {
  company_name: "", segment_id: "",
  expansion_outlook: "", footprint_use_case: "", footprint_function: "", footprint_geography: "",
  footprint_value: "", footprint_start_date: "", footprint_stakeholder: "", footprint_notes: "",
};

const FOOTPRINT_KEYS = [
  "expansion_outlook", "footprint_use_case", "footprint_function", "footprint_geography",
  "footprint_value", "footprint_start_date", "footprint_stakeholder", "footprint_notes",
];

/**
 * Company name is the only required field — everything else (expansion
 * areas, whitespace, signals, stakeholders, questions) still gets filled in
 * on the account's own detail page after creation. Current Heizen Footprint
 * is captured here too, though, since it's usually already known at the
 * moment someone decides to start tracking an account — asking for it up
 * front means the detail page can show it read-only by default instead of
 * an always-open edit form taking up permanent space.
 */
export function AddAccountModal({ onClose, onCreated }) {
  const [values, setValues] = useState(EMPTY);
  const [formError, setFormError] = useState(null);
  const { createAccount, updateFootprint, loading } = useAccountExpansionMutations();
  const { ensureName } = useNameTagContext();

  function patch(update) {
    setValues((v) => ({ ...v, ...update }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!values.company_name.trim()) {
      setFormError("Company name is required.");
      return;
    }
    const actor = await ensureName();
    if (!actor) return;
    try {
      const detail = await createAccount({ company_name: values.company_name.trim(), segment_id: values.segment_id.trim() || null }, actor);
      const hasFootprint = FOOTPRINT_KEYS.some((k) => String(values[k] || "").trim());
      if (hasFootprint) {
        await updateFootprint(detail.account.id, {
          expansion_outlook: values.expansion_outlook || null,
          footprint_use_case: values.footprint_use_case,
          footprint_function: values.footprint_function,
          footprint_geography: values.footprint_geography,
          footprint_value: values.footprint_value === "" ? null : values.footprint_value,
          footprint_start_date: values.footprint_start_date || null,
          footprint_stakeholder: values.footprint_stakeholder,
          footprint_notes: values.footprint_notes,
        }, actor);
      }
      onCreated(detail.account.id);
    } catch (err) {
      setFormError(err.message);
    }
  }

  return (
    <Modal title="Add account" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Company name
            <input
              type="text"
              value={values.company_name}
              onChange={(e) => patch({ company_name: e.target.value })}
              autoFocus
              placeholder="e.g. Acme Corp"
            />
          </label>
          <label>
            Industry / Segment (optional)
            <input
              type="text"
              value={values.segment_id}
              onChange={(e) => patch({ segment_id: e.target.value })}
              placeholder="e.g. Logistics"
            />
          </label>
        </div>

        <h4 style={{ margin: "6px 0 0", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-muted)" }}>
          Current Heizen Footprint (optional — you can add this later instead)
        </h4>
        <label>
          Expansion Outlook
          <select value={values.expansion_outlook} onChange={(e) => patch({ expansion_outlook: e.target.value })}>
            <option value="">— Not set —</option>
            {EXPANSION_OUTLOOK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <div className="form-row">
          <label>
            Current use case / workflow
            <input type="text" value={values.footprint_use_case} onChange={(e) => patch({ footprint_use_case: e.target.value })} />
          </label>
          <label>
            Function
            <input type="text" value={values.footprint_function} onChange={(e) => patch({ footprint_function: e.target.value })} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Business unit / geography
            <input type="text" value={values.footprint_geography} onChange={(e) => patch({ footprint_geography: e.target.value })} />
          </label>
          <label>
            Current commercial value ($)
            <input type="number" min="0" step="1" value={values.footprint_value} onChange={(e) => patch({ footprint_value: e.target.value })} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Start date
            <input type="date" value={values.footprint_start_date} onChange={(e) => patch({ footprint_start_date: e.target.value })} />
          </label>
          <label>
            Key stakeholder
            <input type="text" value={values.footprint_stakeholder} onChange={(e) => patch({ footprint_stakeholder: e.target.value })} />
          </label>
        </div>
        <label>
          Notes on what Heizen currently does
          <textarea value={values.footprint_notes} onChange={(e) => patch({ footprint_notes: e.target.value })} />
        </label>

        {formError && <p className="form-error">{formError}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Adding…" : "Add account"}</button>
        </div>
      </form>
    </Modal>
  );
}
