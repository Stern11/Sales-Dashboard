import { useState } from "react";
import { StatusPill } from "../../components/StatusPill.jsx";
import { relationshipMeta } from "./constants.js";
import { StakeholderModal } from "./StakeholderModal.jsx";

function areaNameFor(areas, id) {
  return (areas || []).find((a) => a.id === id)?.area;
}

/** Compact table — no relationship scoring, no org-chart, per the spec. */
export function StakeholdersSection({ accountId, stakeholders, areas, onChanged }) {
  const [modalTarget, setModalTarget] = useState(null); // null closed, {} = add, stakeholder = edit

  return (
    <div className="lead-detail-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>Stakeholders</h4>
        <button type="button" className="btn btn-primary" onClick={() => setModalTarget({})}>+ Add stakeholder</button>
      </div>
      {(!stakeholders || stakeholders.length === 0) ? (
        <p className="notes-empty">No stakeholders identified yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Title</th>
              <th>Function</th>
              <th>Relationship</th>
              <th>Expansion Area</th>
            </tr>
          </thead>
          <tbody>
            {stakeholders.map((s) => (
              <tr key={s.id} className="row-clickable" onClick={() => setModalTarget(s)}>
                <td className="name-cell">{s.name || <span className="notes-empty">Not identified yet</span>}</td>
                <td>{s.title || "—"}</td>
                <td>{s.function || "—"}</td>
                <td><StatusPill variant={relationshipMeta(s.relationship).pillVariant}>{relationshipMeta(s.relationship).label}</StatusPill></td>
                <td>{areaNameFor(areas, s.expansion_area_id) || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modalTarget && (
        <StakeholderModal
          accountId={accountId}
          stakeholder={modalTarget.id ? modalTarget : null}
          areas={areas}
          onClose={() => setModalTarget(null)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
