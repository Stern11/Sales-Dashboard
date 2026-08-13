import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Drawer } from "../../components/Drawer.jsx";
import { AsyncState } from "../../components/AsyncState.jsx";
import { StatusPill } from "../../components/StatusPill.jsx";
import { CallLogTimeline } from "./CallLogTimeline.jsx";
import { MarkIrrelevantModal } from "./MarkIrrelevantModal.jsx";
import { DeleteDemoCallLeadModal } from "./DeleteDemoCallLeadModal.jsx";
import { ImportFromHubspotPanel } from "./ImportFromHubspotPanel.jsx";
import { useDemoCallLead } from "./useDemoCallsData.js";
import { useDemoCallsMutations } from "./useDemoCallsMutations.js";
import { usePipelineMutations } from "../pipeline/usePipelineMutations.js";
import { demoCallLeadToPipelinePrefill } from "../../lib/pipelineIntegration.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";
import { statusMeta, effectiveStatus, COMPANY_SCALE_OPTIONS } from "./constants.js";

export function DemoCallLeadDrawer({ leadId, onClose, onChanged }) {
  const { data, loading, error, refresh } = useDemoCallLead(leadId);
  const [values, setValues] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [irrelevantModalOpen, setIrrelevantModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [importing, setImporting] = useState(false);
  const { updateLead, setStatus, linkPipeline, addCall, loading: saving } = useDemoCallsMutations();
  const { createLead: createPipelineLead, loading: addingToPipeline } = usePipelineMutations();
  const { ensureName } = useNameTagContext();

  useEffect(() => {
    if (data?.lead) setValues(data.lead);
  }, [data?.lead]);

  function patch(update) {
    setValues((v) => ({ ...v, ...update }));
  }

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
        company_scale: values.company_scale || null,
      }, actor);
      refresh();
      onChanged?.();
    } catch (err) {
      setSaveError(err.message);
    }
  }

  async function handleReactivate() {
    const actor = await ensureName();
    if (!actor) return;
    await setStatus(leadId, { status: "active", actor });
    refresh();
    onChanged?.();
  }

  function handleIrrelevantChanged() {
    refresh();
    onChanged?.();
  }

  // Sequential, not parallel — addCall assigns call_number from the current
  // row count, so importing several selected engagements at once would race
  // on that read (same reasoning as AddDemoCallLeadModal's import handler).
  async function handleImportFromHubspot(payloads) {
    if (!payloads.length) return;
    const actor = await ensureName();
    if (!actor) return;
    setImporting(true);
    try {
      for (const payload of payloads) {
        await addCall(leadId, payload, actor);
      }
      refresh();
      onChanged?.();
    } finally {
      setImporting(false);
    }
  }

  async function handleAddToPipeline() {
    setPipelineStatus(null);
    const actor = await ensureName();
    if (!actor) return;
    try {
      const { lead: pipelineLead } = await createPipelineLead(demoCallLeadToPipelinePrefill(values), actor);
      await linkPipeline(leadId, pipelineLead.id, actor);
      refresh();
      onChanged?.();
      setPipelineStatus({ ok: true, pipelineLeadId: pipelineLead.id });
    } catch (err) {
      if (err.status === 409) {
        setPipelineStatus({ ok: false, message: `Already in the pipeline (${err.body?.existing_lead?.stage || "unknown stage"}).` });
      } else {
        setPipelineStatus({ ok: false, message: err.message });
      }
    }
  }

  // listCalls() orders ascending by call_number, so the last array entry is
  // the most recent call — the detail fetch doesn't carry a precomputed
  // last_call_outcome the way the list endpoint's lateral join does.
  const calls = data?.calls || [];
  const lastCallOutcome = calls.length ? calls[calls.length - 1].outcome : null;
  const effStatus = values ? effectiveStatus(values.status, lastCallOutcome) : "active";

  return (
    <Drawer title={values?.company_name || "Meeting opportunity"} onClose={onClose}>
      <AsyncState loading={loading && !data} error={error}>
        {values && (
          <>
            <div className="lead-detail-current-stage">
              <StatusPill variant={statusMeta(effStatus).pillVariant}>{statusMeta(effStatus).label}</StatusPill>
              {values.status === "active" ? (
                <button type="button" className="btn" onClick={() => setIrrelevantModalOpen(true)}>Mark irrelevant</button>
              ) : (
                <button type="button" className="btn" onClick={handleReactivate}>Reactivate</button>
              )}
            </div>
            {effStatus === "no_show" && (
              <p className="subtitle" style={{ marginBottom: 14 }}>Last meeting was a no-show — log a follow-up meeting to clear this.</p>
            )}
            {values.irrelevant_reason && (
              <p className="subtitle" style={{ marginBottom: 14 }}>Reason: {values.irrelevant_reason}</p>
            )}

            <div className="lead-detail-section">
              <h4>Opportunity details</h4>
              <form className="form-grid" onSubmit={handleSave}>
                <div className="form-row">
                  <label>
                    Company name
                    <input type="text" value={values.company_name} onChange={(e) => patch({ company_name: e.target.value })} />
                  </label>
                  <label>
                    Contact name
                    <input type="text" value={values.contact_name} onChange={(e) => patch({ contact_name: e.target.value })} />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Email
                    <input type="email" value={values.email || ""} onChange={(e) => patch({ email: e.target.value })} />
                  </label>
                  <label>
                    Phone
                    <input type="tel" value={values.phone || ""} onChange={(e) => patch({ phone: e.target.value })} />
                  </label>
                </div>
                <label>
                  Scale of company
                  <select value={values.company_scale || ""} onChange={(e) => patch({ company_scale: e.target.value })}>
                    <option value="">—</option>
                    {COMPANY_SCALE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                {saveError && <p className="form-error">{saveError}</p>}
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={saving || !isDirty}>{saving ? "Saving…" : "Save changes"}</button>
                </div>
              </form>
            </div>

            {values.hubspot_contact_id && (
              <ImportFromHubspotPanel
                contactId={values.hubspot_contact_id}
                onImport={handleImportFromHubspot}
                importing={importing}
              />
            )}

            <div className="lead-detail-section lead-detail-section-featured">
              <h4>Meeting log</h4>
              <CallLogTimeline leadId={leadId} calls={data.calls || []} onChanged={refresh} />
            </div>

            <div className="lead-detail-section">
              <h4>Sales Pipeline</h4>
              {values.pipeline_lead_id ? (
                <p className="subtitle">
                  Already added — <Link to={`/pipeline?lead=${values.pipeline_lead_id}`}>view in Pipeline ↗</Link>
                </p>
              ) : effStatus !== "active" ? (
                <p className="subtitle">
                  {effStatus === "no_show"
                    ? "Can't add to pipeline while the last meeting is an unresolved no-show — log a follow-up meeting first."
                    : "Can't add an irrelevant opportunity to pipeline."}
                </p>
              ) : (
                <>
                  <button type="button" className="btn btn-primary" onClick={handleAddToPipeline} disabled={addingToPipeline}>
                    {addingToPipeline ? "Adding…" : "Add to pipeline"}
                  </button>
                  {pipelineStatus && (
                    <p className={pipelineStatus.ok ? "subtitle" : "form-error"} style={{ marginTop: 8 }}>
                      {pipelineStatus.ok ? "Added to the pipeline." : pipelineStatus.message}
                    </p>
                  )}
                </>
              )}
            </div>

            <p className="subtitle">Added by {values.created_by} · {new Date(values.created_at).toLocaleDateString()}</p>

            <div className="lead-detail-danger-zone">
              <button type="button" className="btn btn-danger" onClick={() => setDeleteModalOpen(true)}>
                Delete this opportunity
              </button>
            </div>
          </>
        )}
      </AsyncState>
      {irrelevantModalOpen && (
        <MarkIrrelevantModal lead={values} onClose={() => setIrrelevantModalOpen(false)} onChanged={handleIrrelevantChanged} />
      )}
      {deleteModalOpen && (
        <DeleteDemoCallLeadModal
          lead={values}
          onClose={() => setDeleteModalOpen(false)}
          onDeleted={() => { setDeleteModalOpen(false); onChanged?.(); onClose(); }}
        />
      )}
    </Drawer>
  );
}
