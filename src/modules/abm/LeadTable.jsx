import { useMemo } from "react";
import { DataTable } from "../../components/DataTable.jsx";
import { StatusPill } from "../../components/StatusPill.jsx";

const EMAIL_PILL_VARIANT = {
  "No Email On File": "missing",
  "Not Yet Contacted": "notstarted",
  "Sent, No Response": "stage",
  Opened: "stage",
  Clicked: "stage",
  Replied: "ready",
};

function EmailPill({ lead }) {
  return <StatusPill variant={EMAIL_PILL_VARIANT[lead.email_funnel_stage] || "stage"}>{lead.email_funnel_stage}</StatusPill>;
}

function LinkedInPill({ lead }) {
  if (!lead.linkedin_reachout_status) return <StatusPill variant="notstarted">Not Started</StatusPill>;
  return <StatusPill variant="stage">{lead.linkedin_reachout_status}</StatusPill>;
}

function CallingPill({ lead }) {
  if (lead.calling_status === "Not Called") return <StatusPill variant="notstarted">Not Called</StatusPill>;
  if (lead.calling_status === "Connected") return <StatusPill variant="ready">Connected</StatusPill>;
  return <StatusPill variant="stage">Attempted</StatusPill>;
}

function MeetingPill({ lead }) {
  return lead.meeting_done
    ? <StatusPill variant="ready">Done</StatusPill>
    : <StatusPill variant="notstarted">Not Done</StatusPill>;
}

export function LeadTable({ leads }) {
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
        { key: "email_funnel_stage", label: "Email", sortable: false, render: (l) => <EmailPill lead={l} /> },
        {
          key: "linkedin_reachout_status",
          label: "LinkedIn Reachout",
          sortable: false,
          render: (l) => <LinkedInPill lead={l} />,
        },
        {
          key: "calling_status",
          label: "Calling",
          render: (l) => <CallingPill lead={l} />,
        },
        {
          key: "meeting_done",
          label: "Meeting",
          render: (l) => <MeetingPill lead={l} />,
        },
        {
          key: "linkedin_url",
          label: "LinkedIn",
          sortable: false,
          render: (l) =>
            l.linkedin_url
              ? <a className="li-link" href={l.linkedin_url} target="_blank" rel="noopener noreferrer">Open ↗</a>
              : <StatusPill variant="missing">Not found</StatusPill>,
        },
      ]}
    />
  );
}
