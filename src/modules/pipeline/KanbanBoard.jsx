import { useState } from "react";
import { BOARD_STAGES } from "./constants.js";
import { KanbanColumn } from "./KanbanColumn.jsx";
import { StageChangeModal } from "./StageChangeModal.jsx";
import { usePipelineMutations } from "./usePipelineMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";

/**
 * Cold/Lost are side-branches, not part of the daily SQL→Won flow — shown
 * collapsed by default (summary counts only, one click to expand) so the 5
 * active stages get the horizontal room instead of competing for it with two
 * columns most people aren't looking at most of the time.
 */
export function KanbanBoard({ leads, showSideStates, onSelect, onChanged, onOptimisticMove }) {
  const [coldLostDrop, setColdLostDrop] = useState(null); // { lead, targetStage } — pending reason capture
  const [dropError, setDropError] = useState(null);
  const { changeStage } = usePipelineMutations();
  const { ensureName } = useNameTagContext();
  const activeStages = BOARD_STAGES.filter((s) => s.isActive);
  const sideStates = BOARD_STAGES.filter((s) => !s.isActive);

  // Dropping onto Cold/Lost opens a small modal to optionally capture why
  // (useful info, worth the one extra step). Every other drop — including
  // dragging a card OUT of Cold/Lost back onto an active column, i.e.
  // reviving it — applies immediately, no modal.
  async function handleDropLead(leadId, toStage) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === toStage) return;
    if (toStage === "cold" || toStage === "lost") {
      setColdLostDrop({ lead, targetStage: toStage });
      return;
    }
    const actor = await ensureName();
    if (!actor) return;
    onOptimisticMove?.(leadId, toStage); // move it in the UI immediately, don't wait on the network
    setDropError(null);
    try {
      await changeStage(leadId, { to_stage: toStage, actor });
    } catch (err) {
      // Without this the rejection was unhandled and the drag failed
      // silently: the card had already moved optimistically, so the board
      // showed a stage the server never accepted.
      setDropError(`Couldn't move ${lead.company_name}: ${err.message}`);
    } finally {
      onChanged?.(); // reconciles with server truth either way (confirms on success, corrects on failure)
    }
  }

  return (
    <div>
      {dropError && <p className="form-error" role="alert">{dropError}</p>}
      <div className="kanban-board">
        {activeStages.map((stage) => (
          <KanbanColumn
            key={stage.value}
            stage={stage}
            leads={leads.filter((l) => l.stage === stage.value)}
            onSelect={onSelect}
            onDropLead={handleDropLead}
          />
        ))}
        {showSideStates && sideStates.map((stage) => (
          <KanbanColumn
            key={stage.value}
            stage={stage}
            leads={leads.filter((l) => l.stage === stage.value)}
            onSelect={onSelect}
            onDropLead={handleDropLead}
          />
        ))}
      </div>
      {coldLostDrop && (
        <StageChangeModal
          lead={coldLostDrop.lead}
          targetStage={coldLostDrop.targetStage}
          onClose={() => setColdLostDrop(null)}
          onChanged={() => { setColdLostDrop(null); onChanged?.(); }}
        />
      )}
    </div>
  );
}
