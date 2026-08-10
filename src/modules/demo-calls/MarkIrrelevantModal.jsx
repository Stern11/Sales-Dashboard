import { useState } from "react";
import { Modal } from "../../components/Modal.jsx";
import { useDemoCallsMutations } from "./useDemoCallsMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";

export function MarkIrrelevantModal({ lead, onClose, onChanged }) {
  const [reason, setReason] = useState("");
  const { setStatus, loading, error } = useDemoCallsMutations();
  const { ensureName } = useNameTagContext();

  async function handleSubmit(e) {
    e.preventDefault();
    const actor = await ensureName();
    if (!actor) return;
    const { lead: updated } = await setStatus(lead.id, { status: "irrelevant", reason: reason || null, actor });
    onChanged?.(updated);
    onClose();
  }

  return (
    <Modal title="Mark as irrelevant" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Reason (optional)
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why isn't this a fit?" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-danger-solid" disabled={loading}>{loading ? "Saving…" : "Mark irrelevant"}</button>
        </div>
      </form>
    </Modal>
  );
}
