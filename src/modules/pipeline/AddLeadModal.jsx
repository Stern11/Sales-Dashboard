import { useState } from "react";
import { Modal } from "../../components/Modal.jsx";
import { LeadFieldsForm } from "./LeadFieldsForm.jsx";
import { usePipelineMutations } from "./usePipelineMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";

const EMPTY = {
  company_name: "", contact_name: "", email: "", phone: "", source: "",
  company_scale: "", region: null, is_supply_chain: false, priority: "medium", deal_size: "", project_description: "",
};

/**
 * Manual entry, and also the "Add to pipeline" target from ABM/Marketing —
 * `prefill` carries company_name/contact_name/email/source/hubspot_contact_id/
 * hubspot_origin_module/source_locked in the latter case (see
 * src/lib/pipelineIntegration.js).
 */
export function AddLeadModal({ onClose, onCreated, prefill }) {
  const [values, setValues] = useState({ ...EMPTY, ...prefill });
  const [formError, setFormError] = useState(null);
  const { createLead, loading } = usePipelineMutations();
  const { ensureName } = useNameTagContext();

  function patch(update) {
    setValues((v) => ({ ...v, ...update }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!values.company_name.trim() || !values.contact_name.trim() || !values.source.trim()) {
      setFormError("Company name, contact name, and source are required.");
      return;
    }
    const actor = await ensureName();
    if (!actor) return; // user cancelled the name prompt

    try {
      const { lead } = await createLead(
        {
          ...values,
          deal_size: values.deal_size === "" ? null : Number(values.deal_size),
          company_scale: values.company_scale || null,
        },
        actor
      );
      onCreated?.(lead);
      onClose();
    } catch (err) {
      if (err.status === 409) {
        setFormError(`Already in the pipeline (stage: ${err.body?.existing_lead?.stage || "unknown"}).`);
      } else {
        setFormError(err.message);
      }
    }
  }

  return (
    <Modal title="Add lead to pipeline" onClose={onClose} wide>
      <form className="form-grid" onSubmit={handleSubmit}>
        <LeadFieldsForm values={values} onChange={patch} sourceLocked={!!values.source_locked} />
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Adding…" : "Add lead"}</button>
        </div>
      </form>
    </Modal>
  );
}
