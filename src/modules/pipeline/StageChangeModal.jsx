import { useState } from "react";
import { Modal } from "../../components/Modal.jsx";
import { ACTIVE_STAGES } from "./constants.js";
import { usePipelineMutations } from "./usePipelineMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";

/**
 * targetStage: 'cold' | 'lost' (capture an optional reason) or 'revive'
 * (pick which active stage to return to, defaulting to prior_active_stage).
 */
export function StageChangeModal({ lead, targetStage, onClose, onChanged }) {
  const isRevive = targetStage === "revive";
  const [reason, setReason] = useState("");
  const [reviveStage, setReviveStage] = useState(lead.prior_active_stage || ACTIVE_STAGES[0].value);
  const { changeStage, loading, error } = usePipelineMutations();
  const { ensureName } = useNameTagContext();

  async function handleSubmit(e) {
    try {
      e.preventDefault();
      const actor = await ensureName();
      if (!actor) return;
      const to_stage = isRevive ? reviveStage : targetStage;
      const { lead: updated } = await changeStage(lead.id, { to_stage, reason: isRevive ? null : reason || null, actor });
      onChanged?.(updated);
      onClose();
    } catch (err) {
      // Caught so a failed write isn't an unhandled promise rejection.
      // The message itself is already on screen: the mutation hook stores
      // it in `error`, which this component renders below.
      console.error("handleSubmit failed:", err);
    }
  }

  return (
    <Modal title={isRevive ? "Revive lead" : `Mark as ${targetStage === "cold" ? "Cold" : "Lost"}`} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        {isRevive ? (
          <label>
            Move back to
            <select value={reviveStage} onChange={(e) => setReviveStage(e.target.value)}>
              {ACTIVE_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        ) : (
          <label>
            Reason (optional)
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this going cold/lost?" />
          </label>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving…" : "Confirm"}</button>
        </div>
      </form>
    </Modal>
  );
}
