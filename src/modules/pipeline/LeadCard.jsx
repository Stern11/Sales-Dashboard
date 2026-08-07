import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StatusPill } from "../../components/StatusPill.jsx";
import { ACTIVE_STAGES, currency, relativeTime, priorityMeta } from "./constants.js";

/**
 * Rendered via a portal into document.body, positioned with `position:
 * fixed` from the trigger button's own bounding rect — the detail drawer
 * (the only remaining user of this) sits inside an `overflow-y: auto`
 * container, which would otherwise clip an absolutely-positioned dropdown.
 *
 * On the Kanban board itself, stage moves (including Cold/Lost/Revive) are
 * done by dragging the card onto a column instead — see KanbanBoard's
 * handleDropLead. This menu only exists for the drawer, which has no drag
 * surface to drop onto.
 */
export function StageMenu({ lead, onOpenModal }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const isActive = ACTIVE_STAGES.some((s) => s.value === lead.stage);

  function handleOpen(e) {
    e.stopPropagation();
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function pick(action) {
    return (e) => { e.stopPropagation(); setOpen(false); action(); };
  }

  return (
    <div className="stage-menu">
      <button type="button" className="btn" ref={btnRef} onClick={handleOpen}>{isActive ? "Cold / Lost ▾" : "Revive ▾"}</button>
      {open && pos && createPortal(
        <div className="stage-menu-list" ref={menuRef} style={{ top: pos.top, left: pos.left }}>
          {isActive && <button type="button" className="danger" onClick={pick(() => onOpenModal("cold"))}>Mark Cold</button>}
          {isActive && <button type="button" className="danger" onClick={pick(() => onOpenModal("lost"))}>Mark Lost</button>}
          {!isActive && <button type="button" onClick={pick(() => onOpenModal("revive"))}>Revive…</button>}
        </div>,
        document.body
      )}
    </div>
  );
}

export function LeadCard({ lead, onSelect }) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      className={`lead-card ${isDragging ? "is-dragging" : ""}`}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        e.dataTransfer.effectAllowed = "move";
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
      onClick={() => onSelect(lead.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(lead.id); }}
    >
      <div className="lead-card-company">{lead.company_name}</div>
      <div className="lead-card-contact">{lead.contact_name}</div>
      <div className="lead-card-meta">
        {lead.deal_size != null && <span className="lead-card-deal-size">{currency.format(lead.deal_size)}</span>}
        <StatusPill variant={priorityMeta(lead.priority).pillVariant}>{priorityMeta(lead.priority).label}</StatusPill>
        {lead.region && <StatusPill variant="notstarted">{lead.region}</StatusPill>}
        <StatusPill variant={lead.is_supply_chain ? "supplychain" : "notstarted"}>
          {lead.is_supply_chain ? "Supply Chain" : "Non-Supply Chain"}
        </StatusPill>
      </div>
      <div className="lead-card-updated">Updated {relativeTime(lead.updated_at)} by {lead.updated_by}</div>
    </div>
  );
}
