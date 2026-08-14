import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Drawer } from "../../components/Drawer.jsx";
import { AsyncState } from "../../components/AsyncState.jsx";
import { StatusPill } from "../../components/StatusPill.jsx";
import { CallLogTimeline } from "./CallLogTimeline.jsx";
import { MarkIrrelevantModal } from "./MarkIrrelevantModal.jsx";
import { DeleteDemoCallLeadModal } from "./DeleteDemoCallLeadModal.jsx";
import { ImportFromHubspotPanel } from "./ImportFromHubspotPanel.jsx";
import { LinkExistingPipelineLeadPanel } from "./LinkExistingPipelineLeadPanel.jsx";
import { useDemoCallLead } from "./useDemoCallsData.js";
import { useDemoCallsMutations } from "./useDemoCallsMutations.js";
import { usePipelineMutations } from "../pipeline/usePipelineMutations.js";
import { demoCallLeadToPipelinePrefill } from "../../lib/pipelineIntegration.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";
import { statusMeta, effectiveStatus, COMPANY_SCALE_OPTIONS, SOURCE_CATEGORIES, SOURCE_OTHER } from "./constants.js";

export function DemoCallLeadDrawer({ leadId, onClose, onChanged }) {
  const { data, loading, error, refresh } = useDemoCallLead(leadId);
  const [values, setValues] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [irrelevantModalOpen, setIrrelevantModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linking, setLinking] = useState(false);
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
        source: values.source || null,
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
    let pipelineLeadId;
    let linkedExisting = false;
    try {
      const { lead: pipelineLead } = await createPipelineLead(demoCallLeadToPipelinePrefill(values), actor);
      pipelineLeadId = pipelineLead.id;
    } catch (err) {
      // A pipeline lead for this HubSpot contact can already exist without
      // this demo call lead ever having been linked to it — e.g. added
      // through a different module (Marketing/ABM bulk-add, a manual entry
      // that happened to reference the same contact), or a previous "Add to
      // pipeline" attempt here that created the pipeline lead but then
      // failed on the link step below. Link to that existing lead instead of
      // just reporting the conflict and leaving the two records out of sync.
      if (err.status === 409 && err.body?.existing_lead?.id) {
        pipelineLeadId = err.body.existing_lead.id;
        linkedExisting = true;
      } else {
        setPipelineStatus({ ok: false, message: err.message });
        return;
      }
    }
    try {
      await linkPipeline(leadId, pipelineLeadId, actor);
      refresh();
      onChanged?.();
      setPipelineStatus({ ok: true, pipelineLeadId, linkedExisting });
    } catch (err) {
      setPipelineStatus({ ok: false, message: err.message });
    }
  }

  /**
   * The explicit fallback for when there's no hubspot_contact_id to
   * auto-match on at all (both records entered by hand) — a rep searches and
   * picks the pipeline lead themselves rather than the system trying to
   * guess by company name, which risks linking two different companies that
   * just happen to share one.
   */
  async function handleLinkExisting(pipelineLead) {
    setPipelineStatus(null);
    const actor = await ensureName();
    if (!actor) return;
    setLinking(true);
    try {
      await linkPipeline(leadId, pipelineLead.id, actor);
      refresh();
      onChanged?.();
      setLinkPickerOpen(false);
      setPipelineStatus({ ok: true, pipelineLeadId: pipelineLead.id, linkedExisting: true });
    } catch (err) {
      setPipelineStatus({ ok: false, message: err.message });
    } finally {
      setLinking(false);
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
                {!values.hubspot_origin_module && (
                  <>
                    <label>
                      Source
                      <select
                        value={SOURCE_CATEGORIES.includes(values.source) ? values.source : SOURCE_OTHER}
                        onChange={(e) => patch({ source: e.target.value === SOURCE_OTHER ? "" : e.target.value })}
                      >
                        <option value="" disabled hidden>— Select —</option>
                        {SOURCE_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
                        <option value={SOURCE_OTHER}>{SOURCE_OTHER}</option>
                      </select>
                    </label>
                    {!SOURCE_CATEGORIES.includes(values.source) && (
                      <label>
                        Where did this lead come from?
                        <input
                          type="text"
                          value={values.source || ""}
                          onChange={(e) => patch({ source: e.target.value })}
                          placeholder="e.g. Cold outbound, trade show…"
                        />
                      </label>
                    )}
                  </>
                )}
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
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-primary" onClick={handleAddToPipeline} disabled={addingToPipeline}>
                      {addingToPipeline ? "Adding…" : "Add to pipeline"}
                    </button>
                    <button type="button" className="link-btn" onClick={() => setLinkPickerOpen((v) => !v)}>
                      {linkPickerOpen ? "Cancel" : "or link to an existing pipeline lead"}
                    </button>
                  </div>
                  {linkPickerOpen && (
                    <LinkExistingPipelineLeadPanel onLink={handleLinkExisting} linking={linking} />
                  )}
                  {pipelineStatus && (
                    <p className={pipelineStatus.ok ? "subtitle" : "form-error"} style={{ marginTop: 8 }}>
                      {pipelineStatus.ok
                        ? (pipelineStatus.linkedExisting
                          ? "Linked to the existing pipeline lead for this contact."
                          : "Added to the pipeline.")
                        : pipelineStatus.message}
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
