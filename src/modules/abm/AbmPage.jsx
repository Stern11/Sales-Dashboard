import { useEffect, useMemo, useState } from "react";
import { AsyncState } from "../../components/AsyncState.jsx";
import { KpiRow } from "../../components/KpiRow.jsx";
import { FunnelChart } from "../../components/FunnelChart.jsx";
import { PeriodToggle } from "../../components/PeriodToggle.jsx";
import { PageMeta } from "../../components/Sidebar.jsx";
import { LeadTable } from "./LeadTable.jsx";
import { useSegments, useAllAbmData } from "./useAbmData.js";
import { usePipelineCheck, abmLeadToPipelinePrefill } from "../../lib/pipelineIntegration.js";
import { usePipelineMutations } from "../pipeline/usePipelineMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";

function aggregateOverview(payloads) {
  return {
    total_companies: payloads.reduce((sum, p) => sum + p.summary.total_companies, 0),
    total_leads: payloads.reduce((sum, p) => sum + p.summary.total_leads, 0),
    meetings_done: payloads.reduce((sum, p) => sum + p.summary.meetings_done, 0),
    meetings_by_channel: {
      email: payloads.reduce((sum, p) => sum + p.summary.meetings_by_channel.email, 0),
      linkedin: payloads.reduce((sum, p) => sum + p.summary.meetings_by_channel.linkedin, 0),
      calls: payloads.reduce((sum, p) => sum + p.summary.meetings_by_channel.calls, 0),
    },
  };
}

export function AbmPage() {
  const { data: segmentsData, loading: segmentsLoading, error: segmentsError } = useSegments();
  const [segmentId, setSegmentId] = useState(null);
  const segments = segmentsData?.segments || [];
  const segmentIds = useMemo(() => segments.map((s) => s.id), [segments]);
  const hasMultipleSegments = segments.length > 1;

  useEffect(() => {
    if (!segmentId && segments.length) setSegmentId(segments[0].id);
  }, [segments, segmentId]);

  // One fetch per segment, in parallel — the selected segment's detail and
  // the combined "Overall ABM Effort" totals both read from this same map,
  // so switching tabs never re-fetches data already in hand.
  const { dataById, loading, error, refresh } = useAllAbmData(segmentIds);
  const data = segmentId ? dataById[segmentId] : null;
  const overview = useMemo(() => {
    const payloads = Object.values(dataById);
    return payloads.length ? aggregateOverview(payloads) : null;
  }, [dataById]);

  const contactIds = useMemo(() => (data?.leads || []).map((l) => l.contact_id), [data]);
  const { inPipeline, refresh: refreshPipelineCheck } = usePipelineCheck(contactIds);
  const { createLead } = usePipelineMutations();
  const { ensureName } = useNameTagContext();
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkStatus, setBulkStatus] = useState(null);

  // Selections are per-segment — switching tabs shouldn't carry a stale
  // selection over to a different lead list.
  useEffect(() => { setSelectedIds(new Set()); setBulkStatus(null); }, [segmentId]);

  function toggleSelect(contactId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId); else next.add(contactId);
      return next;
    });
  }

  async function handleBulkAdd() {
    const actor = await ensureName();
    if (!actor) return;
    setBulkLoading(true);
    setBulkStatus(null);
    const toAdd = (data?.leads || []).filter((l) => selectedIds.has(l.contact_id));
    // Independent writes (different contacts) — run concurrently rather than
    // one-at-a-time; each createLead() is a separate ~1-2s Neon round-trip,
    // so serializing N of them made bulk-add take N times as long for no
    // reason. Promise.allSettled so one failure (e.g. a race against another
    // "already in pipeline" add) doesn't abort the rest of the batch.
    const results = await Promise.allSettled(toAdd.map((lead) => createLead(abmLeadToPipelinePrefill(lead), actor)));
    const added = results.filter((r) => r.status === "fulfilled").length;
    const skipped = results.length - added;
    setBulkLoading(false);
    setSelectedIds(new Set());
    refreshPipelineCheck();
    setBulkStatus(`Added ${added} lead${added === 1 ? "" : "s"} to the pipeline.${skipped ? ` ${skipped} skipped (already in pipeline).` : ""}`);
  }

  if (segmentsLoading) return <div className="loading">Loading live data from HubSpot…</div>;
  if (segmentsError) return <div className="error">Couldn't load live data: {segmentsError}</div>;
  if (segments.length === 0) {
    return <div className="empty">No ABM segments have been configured with a lead roster yet.</div>;
  }

  return (
    <div>
      {hasMultipleSegments && overview && (
        <section>
          <h2>Overall ABM Effort</h2>
          <KpiRow
            items={[
              { label: "Target Accounts", value: overview.total_companies },
              { label: "Total Leads", value: overview.total_leads },
              { label: "Meetings — Email", value: overview.meetings_by_channel.email },
              { label: "Meetings — LinkedIn", value: overview.meetings_by_channel.linkedin },
              { label: "Meetings — Calls", value: overview.meetings_by_channel.calls },
            ]}
          />
          <p className="subtitle" style={{ marginTop: -10, marginBottom: 4 }}>
            {overview.meetings_done} total Demo Call{overview.meetings_done === 1 ? "" : "s"} reached
            — a lead can count toward more than one channel above if it was engaged on several before converting.
          </p>
          <p className="subtitle" style={{ marginTop: 0, marginBottom: 0 }}>
            {segments.map((s) => `${s.label}: ${dataById[s.id]?.summary?.total_leads ?? s.num_leads} leads`).join(" · ")}
          </p>
        </section>
      )}
      {hasMultipleSegments && (
        <div className="pipeline-toolbar">
          <PeriodToggle
            options={segments.map((s) => ({ value: s.id, label: s.label }))}
            value={segmentId}
            onChange={setSegmentId}
          />
          {data && <PageMeta lastUpdated={data.generated_at} onRefresh={refresh} style={{ marginBottom: 0 }} />}
        </div>
      )}
      <AsyncState loading={loading && !data} error={error}>
        {data && (
          <>
            {/* No period toggle to pair with when there's only one segment — falls back to its own row. */}
            {!hasMultipleSegments && <PageMeta lastUpdated={data.generated_at} onRefresh={refresh} />}
            <KpiRow
              items={[
                { label: "Target Accounts", value: data.summary.total_companies },
                { label: "Total Leads", value: data.summary.total_leads },
                {
                  label: "Demo Calls / Meetings",
                  value: `${data.summary.meetings_done} / ${data.summary.total_leads}`,
                },
                {
                  label: "Emails On File",
                  value: `${data.summary.emails_on_file} / ${data.summary.total_leads}`,
                  sub: `${Math.round((100 * data.summary.emails_on_file) / data.summary.total_leads)}%`,
                },
                {
                  label: "LinkedIn Reachout Started",
                  value: `${data.summary.total_leads - data.summary.linkedin_funnel[0].count} / ${data.summary.total_leads}`,
                },
                {
                  label: "Calls Connected",
                  value: `${data.summary.calling_funnel.find((s) => s.stage === "Connected")?.count ?? 0} / ${data.summary.total_leads}`,
                },
              ]}
            />
            <section>
              <h2>LinkedIn Reachout Funnel</h2>
              <FunnelChart stages={data.summary.linkedin_funnel} />
            </section>
            <section>
              <h2>Calling Funnel</h2>
              <FunnelChart stages={data.summary.calling_funnel} />
            </section>
            <section>
              <h2>Email Funnel</h2>
              <FunnelChart stages={data.summary.email_funnel} />
            </section>
            <section>
              <h2>All {data.leads.length} Leads</h2>
              <p className="subtitle" style={{ marginBottom: 10 }}>
                Filter by the dropdowns below to narrow by company or outreach status. The
                "Outreach" column is E=Email, L=LinkedIn, C=Calling, M=Meeting — hover a badge for its exact status.
                Check the Pipeline column to select leads, then add them in bulk.
              </p>
              {selectedIds.size > 0 && (
                <div className="bulk-action-bar">
                  <span>{selectedIds.size} selected</span>
                  <button type="button" className="btn btn-primary" onClick={handleBulkAdd} disabled={bulkLoading}>
                    {bulkLoading ? "Adding…" : `Add ${selectedIds.size} to Pipeline`}
                  </button>
                  <button type="button" className="btn" onClick={() => setSelectedIds(new Set())}>Clear</button>
                </div>
              )}
              {bulkStatus && <p className="subtitle" style={{ marginBottom: 10 }}>{bulkStatus}</p>}
              <LeadTable
                leads={data.leads}
                pipelineStatus={inPipeline}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            </section>
          </>
        )}
      </AsyncState>
    </div>
  );
}
