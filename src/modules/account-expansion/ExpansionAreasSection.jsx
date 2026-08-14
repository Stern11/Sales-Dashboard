import { useState } from "react";
import { StatusPill } from "../../components/StatusPill.jsx";
import { useAccountExpansionMutations } from "./useAccountExpansionMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";
import { areaStatusMeta, relevanceMeta } from "./constants.js";
import { ExpansionAreaModal } from "./ExpansionAreaModal.jsx";

function AreaCard({ area, onEdit, onToggleArchived }) {
  return (
    <div className="note-item">
      <div className="note-item-meta">
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <strong style={{ color: "var(--text-primary)", fontSize: 12.5 }}>{area.area}</strong>
          <StatusPill variant={areaStatusMeta(area.status).pillVariant}>{areaStatusMeta(area.status).label}</StatusPill>
          <StatusPill variant={relevanceMeta(area.relevance).pillVariant}>{relevanceMeta(area.relevance).label}</StatusPill>
        </span>
        <span>{new Date(area.updated_at).toLocaleDateString()}</span>
      </div>
      {area.use_case && <div className="note-item-body" style={{ marginBottom: 6 }}>{area.use_case}</div>}
      {area.why_relevant && (
        <div className="call-entry-field">
          <div className="call-entry-field-label">Why relevant</div>
          <div className="note-item-body">{area.why_relevant}</div>
        </div>
      )}
      {area.needs_validation && (
        <div className="call-entry-field">
          <div className="call-entry-field-label">Need to validate</div>
          <div className="note-item-body">{area.needs_validation}</div>
        </div>
      )}
      {area.notes && (
        <div className="call-entry-field">
          <div className="call-entry-field-label">Notes</div>
          <div className="note-item-body">{area.notes}</div>
        </div>
      )}
      <div className="form-actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn" onClick={() => onToggleArchived(area)}>{area.archived ? "Unarchive" : "Archive"}</button>
        <button type="button" className="btn btn-primary" onClick={() => onEdit(area)}>Edit</button>
      </div>
    </div>
  );
}

/** Main section — each expansion hypothesis as a compact card. Add/Edit/Archive, per the spec. */
export function ExpansionAreasSection({ accountId, areas, onChanged }) {
  const [modalTarget, setModalTarget] = useState(null); // null closed, {} = add, area object = edit
  const [showArchived, setShowArchived] = useState(false);
  const { updateArea } = useAccountExpansionMutations();
  const { ensureName } = useNameTagContext();

  const visible = (areas || []).filter((a) => (showArchived ? true : !a.archived));

  async function toggleArchived(area) {
    const actor = await ensureName();
    if (!actor) return;
    await updateArea(accountId, area.id, { archived: !area.archived }, actor);
    onChanged();
  }

  return (
    <div className="lead-detail-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>Expansion Areas</h4>
        <div>
          {areas?.some((a) => a.archived) && (
            <button type="button" className="btn" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? "Hide archived" : "Show archived"}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => setModalTarget({})}>+ Add area</button>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="notes-empty">No expansion areas identified yet — add one to start tracking a hypothesis.</p>
      ) : (
        <div className="notes-timeline">
          {visible.map((area) => (
            <AreaCard key={area.id} area={area} onEdit={setModalTarget} onToggleArchived={toggleArchived} />
          ))}
        </div>
      )}
      {modalTarget && (
        <ExpansionAreaModal
          accountId={accountId}
          area={modalTarget.id ? modalTarget : null}
          onClose={() => setModalTarget(null)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
