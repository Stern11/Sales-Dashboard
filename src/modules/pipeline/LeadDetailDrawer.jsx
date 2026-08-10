import { useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer.jsx";
import { AsyncState } from "../../components/AsyncState.jsx";
import { StatusPill } from "../../components/StatusPill.jsx";
import { LeadFieldsForm } from "./LeadFieldsForm.jsx";
import { NotesTimeline } from "./NotesTimeline.jsx";
import { StageMenu } from "./LeadCard.jsx";
import { StageChangeModal } from "./StageChangeModal.jsx";
import { DeleteLeadModal } from "./DeleteLeadModal.jsx";
import { DemoCallHistoryModal } from "./DemoCallHistoryModal.jsx";
import { usePipelineLead } from "./usePipelineData.js";
import { usePipelineMutations } from "./usePipelineMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";
import { useApiData } from "../../hooks/useApiData.js";
import { stageMeta, relativeTime, ACTIVE_STAGES } from "./constants.js";

export function LeadDetailDrawer({ leadId, onClose, onChanged }) {
  const { data, loading, error, refresh } = usePipelineLead(leadId);
  const [values, setValues] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [modalTarget, setModalTarget] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const { updateLead, changeStage, loading: saving } = usePipelineMutations();
  const { ensureName } = useNameTagContext();

  // Most pipeline leads have no Demo Calls origin — this is a cheap, silent
  // 200-with-null-lead miss in that case, not an error (see api/demo-calls/
  // by-pipeline-lead/[pipelineLeadId].js). The button only appears on a hit.
  const { data: demoHistory } = useApiData(leadId ? `/api/demo-calls/by-pipeline-lead/${leadId}` : null);

  useEffect(() => {
    if (data?.lead) setValues(data.lead);
  }, [data?.lead]);

  function patch(update) {
    setValues((v) => ({ ...v, ...update }));
  }

  // Compares against the last-loaded/last-saved snapshot (data.lead, which
  // useEffect above resets `values` to) rather than tracking individual
  // field touches — simpler, and correct as long as nothing transforms a
  // field's shape between load and re-serialization (it doesn't: every
  // LeadFieldsForm/patch() write round-trips the same string/boolean/number
  // types the API returned).
  const isDirty = !!(values && data?.lead && JSON.stringify(values) !== JSON.stringify(data.lead));

  async function handleSave(e) {
    e.preventDefault();
    setSaveError(null);
    const actor = await ensureName();
    if (!actor) return;
    try {
      await updateLead(leadId, {
        company_name: values.company_name,
        contact_name: values.contact_name,
        email: values.email,
        phone: values.phone,
        source: values.source,
        company_scale: values.company_scale || null,
        region: values.region || null,
        is_supply_chain: values.is_supply_chain,
        priority: values.priority,
        deal_size: values.deal_size === "" ? null : Number(values.deal_size),
        project_description: values.project_description,
      }, actor);
      refresh();
      onChanged?.();
    } catch (err) {
      setSaveError(err.message);
    }
  }

  async function handleQuickMove(toStage) {
    const actor = await ensureName();
    if (!actor) return;
    await changeStage(leadId, { to_stage: toStage, actor });
    refresh();
    onChanged?.();
  }

  function handleStageChanged() {
    refresh();
    onChanged?.();
  }

  return (
    <Drawer title={values?.company_name || "Lead detail"} onClose={onClose}>
      <AsyncState loading={loading && !data} error={error}>
        {values && (
          <>
            <div className="lead-detail-current-stage">
              <StatusPill color={stageMeta(values.stage).color}>{stageMeta(values.stage).label}</StatusPill>
              {stageMeta(values.stage).isActive && (
                <select
                  value={values.stage}
                  onChange={(e) => handleQuickMove(e.target.value)}
                  disabled={saving}
                  style={{ background: stageMeta(values.stage).color, color: "#fff", borderColor: stageMeta(values.stage).color }}
                >
                  {ACTIVE_STAGES.map((s) => <option key={s.value} value={s.value} style={{ background: s.color, color: "#fff" }}>{s.label}</option>)}
                </select>
              )}
              <StageMenu lead={values} onOpenModal={setModalTarget} />
            </div>
            {values.cold_lost_reason && (
              <p className="subtitle" style={{ marginBottom: 14 }}>Reason: {values.cold_lost_reason}</p>
            )}
            {demoHistory?.lead && (
              <button
                type="button"
                className="btn"
                style={{ marginBottom: 14 }}
                onClick={() => setHistoryModalOpen(true)}
              >
                View Demo Call History ({demoHistory.calls.length} call{demoHistory.calls.length === 1 ? "" : "s"})
              </button>
            )}

            <div className="lead-detail-section">
              <h4>Lead details</h4>
              <form className="form-grid" onSubmit={handleSave}>
                <LeadFieldsForm values={values} onChange={patch} sourceLocked={values.source_locked} hideProjectDescription hideDealSize />
                {saveError && <p className="form-error">{saveError}</p>}
                <div className="form-row-actions">
                  <label className="field-narrow">
                    Deal size ($)
                    <input
                      type="number" min="0" step="1"
                      value={values.deal_size ?? ""}
                      onChange={(e) => patch({ deal_size: e.target.value })}
                      disabled={saving}
                    />
                  </label>
                  <button type="submit" className="btn btn-primary" disabled={saving || !isDirty}>{saving ? "Saving…" : "Save changes"}</button>
                </div>
              </form>
            </div>

            <div className="lead-detail-section lead-detail-section-featured">
              <h4>Next steps</h4>
              <NotesTimeline leadId={leadId} notes={data.notes || []} onNoteAdded={refresh} />
            </div>

            <div className="lead-detail-section">
              <h4>Project description</h4>
              <div className="form-grid">
                <label>
                  <textarea
                    value={values.project_description || ""}
                    onChange={(e) => patch({ project_description: e.target.value })}
                    placeholder="What is this project about?"
                  />
                </label>
              </div>
              <p className="subtitle" style={{ marginTop: 6 }}>Saved together with the Lead details form above.</p>
            </div>

            {data.stage_history?.length > 0 && (
              <div className="lead-detail-section">
                <h4>Stage history</h4>
                <div className="notes-timeline">
                  {data.stage_history.map((h) => (
                    <div className="note-item" key={h.id}>
                      <div className="note-item-meta">
                        <span>{h.from_stage ? `${stageMeta(h.from_stage).label} → ${stageMeta(h.to_stage).label}` : `Created at ${stageMeta(h.to_stage).label}`}</span>
                        <span>{relativeTime(h.changed_at)}</span>
                      </div>
                      <div className="note-item-body">
                        {h.changed_by}{h.reason ? ` — ${h.reason}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="subtitle">Added by {values.created_by} · {new Date(values.created_at).toLocaleDateString()}</p>

            <div className="lead-detail-danger-zone">
              <button type="button" className="btn btn-danger" onClick={() => setDeleteModalOpen(true)}>
                Delete this lead
              </button>
            </div>
          </>
        )}
      </AsyncState>
      {modalTarget && (
        <StageChangeModal
          lead={values}
          targetStage={modalTarget}
          onClose={() => setModalTarget(null)}
          onChanged={handleStageChanged}
        />
      )}
      {deleteModalOpen && (
        <DeleteLeadModal
          lead={values}
          onClose={() => setDeleteModalOpen(false)}
          onDeleted={() => { setDeleteModalOpen(false); onChanged?.(); onClose(); }}
        />
      )}
      {historyModalOpen && demoHistory?.lead && (
        <DemoCallHistoryModal lead={demoHistory.lead} calls={demoHistory.calls} onClose={() => setHistoryModalOpen(false)} />
      )}
    </Drawer>
  );
}
