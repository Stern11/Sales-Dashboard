import { useMemo, useState } from "react";
import { DataTable } from "../../components/DataTable.jsx";
import { StatusPill } from "../../components/StatusPill.jsx";
import { safeUrl } from "../../lib/safeUrl.js";

const EMAIL_PILL_VARIANT = {
  "No Email On File": "missing",
  "Not Yet Contacted": "notstarted",
  "Sent, No Response": "stage",
  Opened: "stage",
  Clicked: "stage",
  Replied: "ready",
};

function callingVariant(lead) {
  if (lead.calling_status === "Not Called") return "notstarted";
  if (lead.calling_status === "Connected") return "ready";
  return "stage";
}

// Collapses the 4 outreach-channel statuses (previously 4 separate pill
// columns) into one compact cell — full detail is still filterable via the
// dropdowns above, it's just not repeated as a column per row anymore. Uses
// the app's own mousemove-tracked .tooltip (same pattern as FunnelChart)
// rather than a native `title` attribute, which is unreliable on elements
// this small.
function OutreachBadges({ lead }) {
  const [tooltip, setTooltip] = useState(null);

  function badgeProps(text) {
    return {
      onMouseMove: (e) => setTooltip({ x: e.clientX + 12, y: e.clientY + 12, text }),
      onMouseLeave: () => setTooltip(null),
    };
  }

  return (
    <div className="mini-badge-row">
      <span className={`mini-badge pill-${EMAIL_PILL_VARIANT[lead.email_funnel_stage] || "stage"}`} {...badgeProps(`Email: ${lead.email_funnel_stage}`)}>E</span>
      <span className={`mini-badge pill-${lead.linkedin_reachout_status ? "stage" : "notstarted"}`} {...badgeProps(`LinkedIn: ${lead.linkedin_reachout_status || "Not Started"}`)}>L</span>
      <span className={`mini-badge pill-${callingVariant(lead)}`} {...badgeProps(`Calling: ${lead.calling_status}`)}>C</span>
      <span className={`mini-badge pill-${lead.meeting_done ? "ready" : "notstarted"}`} {...badgeProps(`Meeting: ${lead.meeting_done ? "Done" : "Not Done"}`)}>M</span>
      {tooltip && (
        <div className="tooltip" style={{ display: "block", left: tooltip.x, top: tooltip.y }}>{tooltip.text}</div>
      )}
    </div>
  );
}

function PipelineCell({ lead, pipelineStatus, selectedIds, onToggleSelect }) {
  const status = pipelineStatus?.[String(lead.contact_id)];
  if (status) return <StatusPill variant="ready">In Pipeline</StatusPill>;
  return (
    <input
      type="checkbox"
      checked={selectedIds.has(lead.contact_id)}
      onChange={() => onToggleSelect(lead.contact_id)}
      title="Select to add to pipeline"
    />
  );
}

export function LeadTable({ leads, pipelineStatus, selectedIds, onToggleSelect }) {
  const rows = useMemo(() => leads.map((l) => ({ ...l, fullname: `${l.first} ${l.last}` })), [leads]);
  const companyOptions = useMemo(() => [...new Set(rows.map((l) => l.company))].sort(), [rows]);
  const statusOptions = ["Not Started", "Request Sent", "Request Accepted", "Message Sent", "Responded", "Meeting Scheduled"];

  return (
    <DataTable
      rows={rows}
      rowKey={(l) => l.contact_id}
      searchPlaceholder="Search name, title, company, email…"
      searchKeys={["fullname", "title", "company", "email"]}
      defaultSort={{ key: "company", dir: 1 }}
      filters={[
        { key: "company", label: "All companies", options: companyOptions, getValue: (l) => l.company },
        {
          key: "status",
          label: "All LinkedIn statuses",
          options: statusOptions,
          getValue: (l) => l.linkedin_reachout_status || "Not Started",
        },
        {
          key: "calling_status",
          label: "All calling statuses",
          options: ["Not Called", "Attempted", "Connected"],
          getValue: (l) => l.calling_status,
        },
        {
          key: "meeting_done",
          label: "All meeting statuses",
          options: ["Done", "Not Done"],
          getValue: (l) => (l.meeting_done ? "Done" : "Not Done"),
        },
        {
          key: "email_funnel_stage",
          label: "All email statuses",
          options: ["No Email On File", "Not Yet Contacted", "Sent, No Response", "Opened", "Clicked", "Replied"],
          getValue: (l) => l.email_funnel_stage,
        },
      ]}
      columns={[
        ...(onToggleSelect
          ? [{
              key: "pipeline", label: "Pipeline", sortable: false,
              render: (l) => <PipelineCell lead={l} pipelineStatus={pipelineStatus} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />,
            }]
          : []),
        { key: "company", label: "Company" },
        {
          key: "fullname",
          label: "Name",
          nameCell: true,
          render: (l) => (
            <>
              {l.flag ? <span className="flag-icon" title={l.flag}>⚑</span> : null}
              {l.fullname}
            </>
          ),
        },
        { key: "title", label: "Title" },
        {
          key: "outreach",
          label: "Outreach",
          sortable: false,
          render: (l) => <OutreachBadges lead={l} />,
        },
        {
          key: "linkedin_url",
          label: "LinkedIn",
          sortable: false,
          render: (l) =>
            safeUrl(l.linkedin_url)
              ? <a className="li-link" href={safeUrl(l.linkedin_url)} target="_blank" rel="noopener noreferrer">Open ↗</a>
              : <StatusPill variant="missing">Not found</StatusPill>,
        },
      ]}
    />
  );
}
