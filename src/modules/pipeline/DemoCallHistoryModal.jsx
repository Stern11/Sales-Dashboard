import { Modal } from "../../components/Modal.jsx";
import { StatusPill } from "../../components/StatusPill.jsx";
import { outcomeMeta, statusMeta, formatCallDate } from "../demo-calls/constants.js";

/**
 * Read-only view of a lead's Demo Calls history, opened from
 * LeadDetailDrawer.jsx once a lead has been handed off via "Add to
 * pipeline" — the call log isn't copied or deleted on handoff (see
 * demoCallLeadToPipelinePrefill in src/lib/pipelineIntegration.js), so this
 * is how it stays reachable instead of getting lost. Deliberately read-only
 * here: the source of truth for editing a call stays the Demo Calls module.
 */
export function DemoCallHistoryModal({ lead, calls, onClose }) {
  return (
    <Modal title={`Demo Call History — ${lead.company_name}`} onClose={onClose} wide>
      <div className="lead-detail-current-stage">
        <StatusPill variant={statusMeta(lead.status).pillVariant}>{statusMeta(lead.status).label}</StatusPill>
        {lead.irrelevant_reason && <span className="subtitle">Reason: {lead.irrelevant_reason}</span>}
      </div>
      <div className="notes-timeline">
        {calls.length === 0 && <p className="notes-empty">No calls were logged before this lead was added to pipeline.</p>}
        {calls.map((call) => (
          <div className="note-item" key={call.id}>
            <div className="call-entry-header">
              <div className="call-entry-title">
                <span className="call-entry-number">Call {call.call_number}</span>
                <span className="call-entry-date">{formatCallDate(call.call_date) || "No date set"}</span>
                <StatusPill variant={outcomeMeta(call.outcome).pillVariant}>{outcomeMeta(call.outcome).label}</StatusPill>
              </div>
            </div>
            <div className="note-item-meta" style={{ marginBottom: 8 }}>
              <span>Logged by {call.created_by}</span>
            </div>
            {call.notes ? (
              <div className="call-entry-field">
                <div className="call-entry-field-label">Notes</div>
                <div className="note-item-body">{call.notes}</div>
              </div>
            ) : (
              <p className="notes-empty">No notes added.</p>
            )}
            {call.next_steps && (
              <div className="call-entry-field">
                <div className="call-entry-field-label">Next Steps</div>
                <div className="note-item-body">{call.next_steps}</div>
              </div>
            )}
            {call.transcript_url && (
              <div className="call-entry-field">
                <div className="call-entry-field-label">Transcript</div>
                <a href={call.transcript_url} target="_blank" rel="noopener noreferrer">{call.transcript_url} ↗</a>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
