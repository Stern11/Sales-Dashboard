import { useMemo } from "react";
import { AsyncState } from "../../components/AsyncState.jsx";
import { KpiRow } from "../../components/KpiRow.jsx";
import { PageMeta } from "../../components/Sidebar.jsx";
import { OverviewTrendTable } from "./OverviewTrendTable.jsx";
import { buildMonthlyOverview } from "./overviewMath.js";
import { useDemoCallsList } from "../demo-calls/useDemoCallsData.js";
import { summarizeLeads as summarizeDemoCallsLeads } from "../demo-calls/constants.js";
import { usePipelineList } from "../pipeline/usePipelineData.js";
import { summarizeLeads as summarizePipelineLeads, currency } from "../pipeline/constants.js";

/**
 * Cross-module snapshot for a stakeholder who wants the platform's state in
 * one glance — the Sales Pipeline and Meetings pages exist for someone
 * working a given funnel; this page exists for someone who isn't.
 *
 * Scoped to Sales Pipeline + Meetings (Performance Marketing/ABM Outreach
 * deliberately excluded) — both are this app's own database, with a
 * reliable per-record date to build a real trend from, unlike Marketing/ABM
 * which are live HubSpot reads.
 *
 * Split into two parts:
 * - A KPI row pulling the single most important headline numbers — all-time/
 *   current totals, no period filter applied anywhere (labeled explicitly
 *   below so that's never ambiguous).
 * - A monthly trend table, floored at July (MIN_TREND_MONTH_START in
 *   overviewMath.js) and growing a column at a time as more gets added —
 *   there's no historical data to backfill, so it isn't faked.
 */
export function OverviewPage() {
  const { data: pipelineData, loading: pipelineLoading, error: pipelineError, refresh: refreshPipeline } = usePipelineList();
  const { data: demoCallsData, loading: demoCallsLoading, error: demoCallsError, refresh: refreshDemoCalls } = useDemoCallsList();

  const pipelineLeads = pipelineData?.leads || [];
  const demoCallLeads = demoCallsData?.leads || [];
  const pipelineSummary = useMemo(() => summarizePipelineLeads(pipelineLeads), [pipelineLeads]);
  const demoCallsSummary = useMemo(() => summarizeDemoCallsLeads(demoCallLeads), [demoCallLeads]);

  const monthlyBuckets = useMemo(
    () => buildMonthlyOverview(pipelineLeads, demoCallLeads),
    [pipelineLeads, demoCallLeads]
  );

  function refreshAll() {
    refreshPipeline();
    refreshDemoCalls();
  }

  return (
    <div>
      <AsyncState loading={pipelineLoading || demoCallsLoading} error={pipelineError || demoCallsError}>
        {pipelineData && demoCallsData && (
          <>
            {/* Neither Pipeline's nor Demo Calls' API sets generated_at (both are our own
                DB, not a live HubSpot read) — PageMeta already handles that gracefully by
                just omitting the "Updated: …" text and keeping the button, same as
                PipelinePage.jsx's own `data.generated_at || undefined`. */}
            <PageMeta lastUpdated={demoCallsData.generated_at} onRefresh={refreshAll} />
            <p className="subtitle" style={{ marginBottom: 14 }}>
              All time — current totals, not scoped to any date range.
            </p>
            <KpiRow
              items={[
                { label: "Meetings Booked", value: demoCallsSummary.total },
                { label: "Added to Pipeline", value: demoCallsSummary.added_to_pipeline },
                { label: "Open Pipeline Value", value: currency.format(pipelineSummary.open_pipeline_value) },
                { label: "Closed Won", value: currency.format(pipelineSummary.closed_won_value) },
              ]}
            />
            <section>
              <h2>Monthly Trend</h2>
              <p className="subtitle" style={{ marginBottom: 10 }}>
                Meetings and pipeline activity by month, starting July — grows one column at a time as real data
                accumulates, current month always last.
              </p>
              <OverviewTrendTable buckets={monthlyBuckets} />
            </section>
          </>
        )}
      </AsyncState>
    </div>
  );
}
