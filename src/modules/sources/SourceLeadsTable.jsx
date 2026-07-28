import { DataTable } from "../../components/DataTable.jsx";
import { StatusPill } from "../../components/StatusPill.jsx";

export function SourceLeadsTable({ leads, stageLabel }) {
  const channelOptions = [...new Set(leads.map((l) => l.channel))].sort();
  const stageOptions = [...new Set(leads.map((l) => l.lifecycle_stage).filter(Boolean))];

  return (
    <DataTable
      rows={leads}
      rowKey={(l) => l.contact_id}
      searchPlaceholder="Search name, email, campaign…"
      searchKeys={["name", "email", "campaign"]}
      defaultSort={{ key: "created_at", dir: -1 }}
      filters={[
        { key: "channel", label: "All channels", options: channelOptions, getValue: (l) => l.channel },
        { key: "stage", label: "All stages", options: stageOptions, getValue: (l) => l.lifecycle_stage },
      ]}
      columns={[
        { key: "name", label: "Name", nameCell: true },
        { key: "email", label: "Email" },
        { key: "channel", label: "Channel", render: (l) => <StatusPill variant="stage">{l.channel}</StatusPill> },
        { key: "campaign", label: "Campaign" },
        { key: "lifecycle_stage", label: "Stage", render: (l) => (l.lifecycle_stage ? stageLabel(l.lifecycle_stage) : "—") },
        { key: "num_meetings", label: "Meetings" },
        { key: "created_at", label: "Created", render: (l) => (l.created_at ? new Date(l.created_at).toLocaleDateString() : "—") },
      ]}
    />
  );
}
