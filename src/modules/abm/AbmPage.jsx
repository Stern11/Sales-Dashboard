import { useEffect, useState } from "react";
import { AsyncState } from "../../components/AsyncState.jsx";
import { KpiRow } from "../../components/KpiRow.jsx";
import { FunnelChart } from "../../components/FunnelChart.jsx";
import { PeriodToggle } from "../../components/PeriodToggle.jsx";
import { PageMeta } from "../../components/TopNav.jsx";
import { LeadTable } from "./LeadTable.jsx";
import { useSegments, useAbmData, useAbmOverview } from "./useAbmData.js";

export function AbmPage() {
  const { data: segmentsData, loading: segmentsLoading, error: segmentsError } = useSegments();
  const [segmentId, setSegmentId] = useState(null);

  useEffect(() => {
    if (!segmentId && segmentsData?.segments?.length) {
      setSegmentId(segmentsData.segments[0].id);
    }
  }, [segmentsData, segmentId]);

  const { data, loading, error, refresh } = useAbmData(segmentId);
  const hasMultipleSegments = (segmentsData?.segments?.length || 0) > 1;
  const overview = useAbmOverview(); // only rendered (and only useful) once there's more than one segment

  if (segmentsLoading || (loading && !segmentId)) return <div className="loading">Loading live data from HubSpot…</div>;
  if (segmentsError) return <div className="error">Couldn't load live data: {segmentsError}</div>;

  const segments = segmentsData?.segments || [];
  if (segments.length === 0) {
    return <div className="empty">No ABM segments have been configured with a lead roster yet.</div>;
  }

  return (
    <div>
      {hasMultipleSegments && (
        <section>
          <h2>Overall ABM Effort</h2>
          <AsyncState loading={overview.loading} error={overview.error}>
            {overview.data && (
              <>
                <KpiRow
                  items={[
                    { label: "Target Accounts", value: overview.data.summary.total_companies },
                    { label: "Total Leads", value: overview.data.summary.total_leads },
                    { label: "Meetings — Email", value: overview.data.summary.meetings_by_channel.email },
                    { label: "Meetings — LinkedIn", value: overview.data.summary.meetings_by_channel.linkedin },
                    { label: "Meetings — Calls", value: overview.data.summary.meetings_by_channel.calls },
                  ]}
                />
                <p className="subtitle" style={{ marginTop: -10, marginBottom: 4 }}>
                  {overview.data.summary.meetings_done} total Demo Call{overview.data.summary.meetings_done === 1 ? "" : "s"} reached
                  — a lead can count toward more than one channel above if it was engaged on several before converting.
                </p>
                <p className="subtitle" style={{ marginTop: 0, marginBottom: 0 }}>
                  {overview.data.segments.map((s) => `${s.label}: ${s.num_leads} leads`).join(" · ")}
                </p>
              </>
            )}
          </AsyncState>
        </section>
      )}
      {hasMultipleSegments && (
        <PeriodToggle
          options={segments.map((s) => ({ value: s.id, label: s.label }))}
          value={segmentId}
          onChange={setSegmentId}
        />
      )}
      <AsyncState loading={loading} error={error}>
        {data && (
          <>
            <PageMeta lastUpdated={data.generated_at} onRefresh={refresh} />
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
                Filter by the "All companies" dropdown below to view a single account.
              </p>
              <LeadTable leads={data.leads} />
            </section>
          </>
        )}
      </AsyncState>
    </div>
  );
}
