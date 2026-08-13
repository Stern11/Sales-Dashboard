import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AsyncState } from "../../components/AsyncState.jsx";
import { KpiRow } from "../../components/KpiRow.jsx";
import { PageMeta } from "../../components/TopNav.jsx";
import { DemoCallsTable } from "./DemoCallsTable.jsx";
import { DemoCallLeadDrawer } from "./DemoCallLeadDrawer.jsx";
import { AddDemoCallLeadModal } from "./AddDemoCallLeadModal.jsx";
import { DateRangeFilter } from "./DateRangeFilter.jsx";
import { WeeklyTrendChart } from "./WeeklyTrendChart.jsx";
import { useDemoCallsList } from "./useDemoCallsData.js";
import { useDemoCallsMutations } from "./useDemoCallsMutations.js";
import { useLiveDemoCallContacts } from "./useLiveDemoCallContacts.js";
import { summarizeLeads, resolvePeriodRange, isWithinRange, weeklyFunnelTrend } from "./constants.js";
import { demoCallLeadToPipelinePrefill } from "../../lib/pipelineIntegration.js";
import { usePipelineMutations } from "../pipeline/usePipelineMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";

function formatRangeLabel(from, to) {
  if (!from && !to) return "All time";
  const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (from && to) return `Booked ${fmt(from)} – ${fmt(to)}`;
  if (from) return `Booked since ${fmt(from)}`;
  return `Booked through ${fmt(to)}`;
}

export function DemoCallsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedLeadId, setSelectedLeadId] = useState(() => searchParams.get("lead"));
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [logCallPrefill, setLogCallPrefill] = useState(null);
  const [period, setPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const { data, loading, error, refresh } = useDemoCallsList();
  const { liveContacts } = useLiveDemoCallContacts();
  const { createLead: createPipelineLead } = usePipelineMutations();
  const { linkPipeline } = useDemoCallsMutations();
  const { ensureName } = useNameTagContext();
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkStatus, setBulkStatus] = useState(null);

  // A period switch changes which leads are even visible — drop any
  // selection made under the old filter rather than silently bulk-adding
  // leads the user can no longer see.
  useEffect(() => { setSelectedIds(new Set()); setBulkStatus(null); }, [period, customFrom, customTo]);

  function selectLead(id) {
    setSelectedLeadId(id);
    setSearchParams(id ? { lead: id } : {}, { replace: true });
  }

  const leads = data?.leads || [];
  const trackedHubspotIds = useMemo(
    () => new Set(leads.map((l) => l.hubspot_contact_id).filter(Boolean)),
    [leads]
  );
  const untrackedContacts = useMemo(
    () => liveContacts.filter((c) => !trackedHubspotIds.has(c.contact_id)),
    [liveContacts, trackedHubspotIds]
  );

  // "Booked" = a tracked lead's created_at. The date filter only scopes the
  // funnel/KPIs and the tracked half of the table — untracked/"virtual" rows
  // (not booked yet) always show regardless of the selected period.
  const { from, to } = useMemo(() => resolvePeriodRange(period, customFrom, customTo), [period, customFrom, customTo]);
  const bookedLeads = useMemo(
    () => (from || to ? leads.filter((l) => isWithinRange(l.created_at, from, to)) : leads),
    [leads, from, to]
  );

  const rows = useMemo(() => [
    ...bookedLeads.map((l) => ({ ...l, _kind: "tracked" })),
    ...untrackedContacts.map((c) => ({ ...c, id: `live-${c.contact_id}`, _kind: "virtual" })),
  ], [bookedLeads, untrackedContacts]);

  const summary = useMemo(() => summarizeLeads(bookedLeads), [bookedLeads]);
  // Its own time dimension already — always the full, unfiltered lead history,
  // independent of the "Booked" period selector above (filtering it too would
  // just zero out every week but one).
  const weeklyTrend = useMemo(() => weeklyFunnelTrend(leads), [leads]);

  function openLogFirstCall(contact) {
    setLogCallPrefill({
      company_name: contact.company_name,
      contact_name: contact.contact_name,
      email: contact.email,
      hubspot_contact_id: contact.contact_id,
      hubspot_origin_module: contact.hubspot_origin_module,
    });
  }

  function handleAddModalCreated(lead) {
    refresh();
    selectLead(lead.id);
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /**
   * Two writes per lead (create the Pipeline row, then link it back) — same
   * shape as the drawer's single-lead "Add to pipeline"
   * (DemoCallLeadDrawer.jsx), just run concurrently across the selection.
   * Promise.allSettled so one failure (e.g. a stale/already-added row) doesn't
   * abort the rest of the batch.
   */
  async function handleBulkAdd() {
    const actor = await ensureName();
    if (!actor) return;
    setBulkLoading(true);
    setBulkStatus(null);
    const toAdd = bookedLeads.filter((l) => selectedIds.has(l.id));
    const results = await Promise.allSettled(toAdd.map(async (lead) => {
      const { lead: pipelineLead } = await createPipelineLead(demoCallLeadToPipelinePrefill(lead), actor);
      await linkPipeline(lead.id, pipelineLead.id, actor);
    }));
    const added = results.filter((r) => r.status === "fulfilled").length;
    const skipped = results.length - added;
    setBulkLoading(false);
    setSelectedIds(new Set());
    refresh();
    setBulkStatus(`Added ${added} opportunit${added === 1 ? "y" : "ies"} to the pipeline.${skipped ? ` ${skipped} skipped (already in pipeline).` : ""}`);
  }

  return (
    <div>
      <AsyncState loading={loading} error={error}>
        {data && (
          <>
            <div className="pipeline-toolbar">
              <DateRangeFilter
                period={period}
                onPeriodChange={setPeriod}
                customFrom={customFrom}
                customTo={customTo}
                onCustomFromChange={setCustomFrom}
                onCustomToChange={setCustomTo}
              />
              <PageMeta lastUpdated={data.generated_at} onRefresh={refresh} />
            </div>
            <p className="subtitle" style={{ marginBottom: 14 }}>{formatRangeLabel(from, to)} — {summary.total} opportunit{summary.total === 1 ? "y" : "ies"}</p>
            <KpiRow
              items={[
                { label: "Total Meetings Booked", value: summary.total },
                { label: "First Meeting Done", value: summary.call_1_done },
                { label: "Second Meeting Done", value: summary.call_2_done },
                { label: "No Shows", value: summary.no_shows },
                { label: "Not Relevant", value: summary.irrelevant },
                { label: "Mid-Market Booked", value: summary.by_scale.mid_market },
                { label: "Enterprise Booked", value: summary.by_scale.enterprise },
              ]}
            />
            <section>
              <h2>Week-on-Week Trend</h2>
              <p className="subtitle" style={{ marginBottom: 10 }}>
                Each week shows the current state of opportunities booked that week — how many completed a meeting,
                moved to a second, converted to pipeline, or turned out irrelevant.
              </p>
              <WeeklyTrendChart buckets={weeklyTrend} />
            </section>
            <div className="pipeline-toolbar" style={{ justifyContent: "flex-end" }}>
              <div className="pipeline-toolbar-group">
                <button type="button" className="btn btn-primary" onClick={() => setAddModalOpen(true)}>+ Add Opportunity</button>
              </div>
            </div>
            <section>
              <p className="subtitle" style={{ marginBottom: 10 }}>
                Check the Pipeline column to select opportunities, then add them in bulk.
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
              <DemoCallsTable
                rows={rows}
                onOpenLead={selectLead}
                onLogFirstCall={openLogFirstCall}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            </section>
          </>
        )}
      </AsyncState>

      {selectedLeadId && (
        <DemoCallLeadDrawer leadId={selectedLeadId} onClose={() => selectLead(null)} onChanged={refresh} />
      )}
      {addModalOpen && (
        <AddDemoCallLeadModal onClose={() => setAddModalOpen(false)} onCreated={handleAddModalCreated} />
      )}
      {logCallPrefill && (
        <AddDemoCallLeadModal
          prefill={logCallPrefill}
          onClose={() => setLogCallPrefill(null)}
          onCreated={(lead) => { setLogCallPrefill(null); handleAddModalCreated(lead); }}
        />
      )}
    </div>
  );
}
