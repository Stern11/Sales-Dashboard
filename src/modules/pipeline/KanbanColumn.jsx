import { useState } from "react";
import { LeadCard } from "./LeadCard.jsx";
import { currency } from "./constants.js";

export function KanbanColumn({ stage, leads, onSelect, onDropLead }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const value = leads.reduce((sum, l) => sum + (Number(l.deal_size) || 0), 0);

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isDragOver) setIsDragOver(true);
  }

  // dragleave fires when the pointer moves over ANY child element inside
  // the column (each lead card), not just when it truly exits the column —
  // naively clearing isDragOver on every dragleave makes the highlight
  // flicker on/off as the pointer crosses card boundaries while hovering.
  // Only clear it once the pointer has actually left the column body.
  function handleDragLeave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId) onDropLead(leadId, stage.value);
  }

  return (
    <div className={`kanban-column ${stage.isActive ? "" : "is-side-state"}`} style={{ borderTopColor: stage.color, borderTopWidth: 3 }}>
      <div className="kanban-column-header">
        <span className="kanban-column-dot" style={{ background: stage.color }} />
        <span className="kanban-column-title">{stage.label}</span>
        <span className="kanban-column-count">{leads.length}</span>
      </div>
      {value > 0 && <div className="kanban-column-value">{currency.format(value)}</div>}
      <div
        className={`kanban-column-body ${isDragOver ? "is-drag-over" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {leads.length === 0 && <div className="kanban-column-empty">No leads</div>}
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
