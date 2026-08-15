import { useCallback, useEffect, useMemo, useState } from "react";
import { AsyncState } from "../../components/AsyncState.jsx";
import { KpiRow } from "../../components/KpiRow.jsx";
import { FunnelChart } from "../../components/FunnelChart.jsx";
import { DateRangeFilter } from "../../components/DateRangeFilter.jsx";
import { PageMeta } from "../../components/Sidebar.jsx";
import { AdLeadsTable } from "./AdLeadsTable.jsx";
import { useAdLeadsData, useAdSpendData } from "./useMarketingData.js";
import { usePipelineCheck, marketingLeadToPipelinePrefill } from "../../lib/pipelineIntegration.js";
import { usePipelineMutations } from "../pipeline/usePipelineMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";

const PERIOD_OPTIONS = [
  { value: "lifetime", label: "Lifetime" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom Range" },
];

const currency = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// LinkedIn Ads is the only paid channel scoped in today — see docs/ARCHITECTURE.md
// for how to add another (Google/Meta ads) alongside it.
const AD_CHANNEL = "linkedin";

export function MarketingPage() {
  const [period, setPeriod] = useState("lifetime");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const { data, loading, error, refresh } = useAdLeadsData(period, customFrom, customTo);
  const spend = useAdSpendData();

  const stageLabel = (value) => data?.stages.find((s) => s.value === value)?.label || value;

  const adLeads = useMemo(() => {
    if (!data) return [];
    return data.leads.filter((l) => l.channel.toLowerCase() === AD_CHANNEL);
  }, [data]);

  // Stage value -> position, built once per data change. Every count below
  // needs "how far along is this lead", and resolving that with findIndex
  // inside a filter made each one O(leads x stages); the funnel did it once
  // per stage on top of that. A Map makes each lookup O(1).
  const stageOrder = useMemo(() => {
    const order = new Map();
    (data?.stages || []).forEach((s, i) => order.set(s.value, i));
    return order;
  }, [data]);

  const stageIdx = useCallback((value) => (stageOrder.has(value) ? stageOrder.get(value) : -1), [stageOrder]);

  const funnel = useMemo(() => {
    if (!data) return [];
    return data.stages.map((s, i) => ({
      stage: s.label,
      count: adLeads.filter((l) => stageIdx(l.lifecycle_stage) >= i).length,
    }));
  }, [data, adLeads, stageIdx]);

  // Cumulative — reached this stage or any stage beyond it — not just
  // currently sitting there. A lead that did a demo call and has since moved
  // on to SQL still counts toward "Demo Calls"; lifecyclestage only holds
  // the *current* stage, so counting exact matches undercounts total
  // activity by however many leads have since progressed further.
  //
  // Memoized: these ran twice over every ad lead on every render, including
  // renders caused by typing in the table's search box.
  const { demoCallCount, sqlCount } = useMemo(() => {
    const demoCallIdx = stageIdx("opportunity");
    const sqlIdx = stageIdx("salesqualifiedlead");
    let demo = 0;
    let sql = 0;
    for (const l of adLeads) {
      const idx = stageIdx(l.lifecycle_stage);
      if (demoCallIdx >= 0 && idx >= demoCallIdx) demo += 1;
      if (sqlIdx >= 0 && idx >= sqlIdx) sql += 1;
    }
    return { demoCallCount: demo, sqlCount: sql };
  }, [adLeads, stageIdx]);

  const contactIds = useMemo(() => adLeads.map((l) => l.contact_id), [adLeads]);
  const { inPipeline, refresh: refreshPipelineCheck } = usePipelineCheck(contactIds);
  const { createLead } = usePipelineMutations();
  const { ensureName } = useNameTagContext();
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkStatus, setBulkStatus] = useState(null);

  // A period/range switch changes which leads are even visible — drop any
  // selection made under the old filter rather than silently bulk-adding
  // leads no longer on screen (same pattern as DemoCallsPage's own filters).
  useEffect(() => { setSelectedIds(new Set()); setBulkStatus(null); }, [period, customFrom, customTo]);

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
    const toAdd = adLeads.filter((l) => selectedIds.has(l.contact_id));
    // Independent writes (different contacts) — run concurrently rather than
    // one-at-a-time; each createLead() is a separate ~1-2s Neon round-trip,
    // so serializing N of them made bulk-add take N times as long for no
    // reason. Promise.allSettled so one failure (e.g. a race against another
    // "already in pipeline" add) doesn't abort the rest of the batch.
    const results = await Promise.allSettled(toAdd.map((lead) => createLead(marketingLeadToPipelinePrefill(lead), actor)));
    const added = results.filter((r) => r.status === "fulfilled").length;
    const skipped = results.length - added;
    setBulkLoading(false);
    setSelectedIds(new Set());
    refreshPipelineCheck();
    setBulkStatus(`Added ${added} lead${added === 1 ? "" : "s"} to the pipeline.${skipped ? ` ${skipped} skipped (already in pipeline).` : ""} Company names were guessed from email domain — check them in the pipeline.`);
  }

  return (
    <div>
      <div className="pipeline-toolbar">
        <DateRangeFilter
          options={PERIOD_OPTIONS}
          period={period}
          onPeriodChange={setPeriod}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
        {data && <PageMeta lastUpdated={data.generated_at} onRefresh={refresh} style={{ marginBottom: 0 }} />}
      </div>
      <AsyncState loading={loading} error={error}>
        {data && (
          <>
            <KpiRow
              items={[
                {
                  label: "Ad Spend",
                  value: spend.data ? currency.format(spend.data.total_spend) : "—",
                  sub: spend.error ? "Not available yet" : undefined,
                },
                {
                  label: "Live Campaigns",
                  value: spend.data ? spend.data.live_campaigns : "—",
                  sub: spend.error ? "Not available yet" : undefined,
                },
                { label: "LinkedIn Ad Leads", value: adLeads.length },
                { label: "Demo Calls", value: demoCallCount, sub: "reached this stage or beyond" },
                { label: "SQL", value: sqlCount, sub: "reached this stage or beyond" },
              ]}
            />
            {data.summary?.truncated && (
              <p className="subtitle" style={{ marginBottom: 16 }} role="status">
                Showing the {data.summary.total_leads.toLocaleString()} most recent of{" "}
                {data.summary.total_matching.toLocaleString()} matching contacts — HubSpot paging is
                capped per request, so the figures below cover that subset, not the full portal.
              </p>
            )}
            {spend.error && (
              <p className="subtitle" style={{ marginBottom: 16 }}>
                Ad Spend / Live Campaigns: {spend.error} — LinkedIn Ad Leads, Demo Calls, SQL, and the funnel below
                don't depend on this and are live.
              </p>
            )}
            <section>
              <h2>LinkedIn Ads — Lifecycle Funnel</h2>
              <FunnelChart stages={funnel} />
            </section>
            <section>
              <h2>LinkedIn Ad Leads ({adLeads.length})</h2>
              <p className="subtitle" style={{ marginBottom: 10 }}>
                Check the Pipeline column to select leads, then add them in bulk. This data has
                no company field — company name is guessed from the email domain and worth double-checking after adding.
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
              <AdLeadsTable
                leads={adLeads}
                stageLabel={stageLabel}
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
