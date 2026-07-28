import { useEffect, useMemo, useState } from "react";
import { AsyncState } from "../../components/AsyncState.jsx";
import { KpiRow } from "../../components/KpiRow.jsx";
import { FunnelChart } from "../../components/FunnelChart.jsx";
import { PeriodToggle } from "../../components/PeriodToggle.jsx";
import { PageMeta } from "../../components/TopNav.jsx";
import { LeadTable } from "./LeadTable.jsx";
import { useSegments, useAllAbmData } from "./useAbmData.js";

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
        <PeriodToggle
          options={segments.map((s) => ({ value: s.id, label: s.label }))}
          value={segmentId}
          onChange={setSegmentId}
        />
      )}
      <AsyncState loading={loading && !data} error={error}>
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
