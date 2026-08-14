import { useMemo } from "react";
import { DataTable } from "../../components/DataTable.jsx";
import { StatusPill } from "../../components/StatusPill.jsx";
import { outlookMeta, formatShortDate } from "./constants.js";

const CHIP_OVERFLOW_LIMIT = 3;

function ExpansionAreaChips({ areaNames }) {
  const names = areaNames || [];
  if (!names.length) return <span className="notes-empty">None yet</span>;
  const shown = names.slice(0, CHIP_OVERFLOW_LIMIT);
  const overflow = names.length - shown.length;
  return (
    <div className="chip-row">
      {shown.map((name) => <span key={name} className="pill pill-stage">{name}</span>)}
      {overflow > 0 && <span className="pill pill-notstarted">+{overflow}</span>}
    </div>
  );
}

/**
 * Account portfolio — one row per account tracked in this module (existing
 * clients being expanded, not ABM prospects). The roster *is* this table:
 * every row comes straight from listAccounts(), no merge against an
 * external company list.
 */
export function AccountsTable({ accounts, onOpenAccount }) {
  const rows = useMemo(
    () =>
      (accounts || []).map((a) => ({
        id: a.id,
        company_name: a.company_name,
        segment_id: a.segment_id || null,
        footprint_use_case: a.footprint_use_case || null,
        area_names: a.area_names || [],
        // Postgres count(*) comes back as a string over JSON — coerce so
        // sorting/summing treat these as numbers, not lexicographic strings.
        area_count: Number(a.area_count || 0),
        validated_count: Number(a.validated_count || 0),
        expansion_outlook: a.expansion_outlook || null,
        latest_signal_finding: a.latest_signal_finding || null,
        latest_signal_date: a.latest_signal_date || null,
        updated_at: a.updated_at,
      })),
    [accounts]
  );

  const segmentOptions = useMemo(
    () => [...new Set(rows.map((r) => r.segment_id).filter(Boolean))].sort(),
    [rows]
  );

  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      searchPlaceholder="Search company…"
      searchKeys={["company_name"]}
      defaultSort={{ key: "company_name", dir: 1 }}
      onRowClick={(r) => onOpenAccount(r.id)}
      filters={[
        {
          key: "expansion_outlook",
          label: "All outlooks",
          options: [
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "early", label: "Early" },
          ],
          getValue: (r) => r.expansion_outlook,
        },
        ...(segmentOptions.length
          ? [{ key: "segment_id", label: "All industries", options: segmentOptions, getValue: (r) => r.segment_id }]
          : []),
      ]}
      columns={[
        { key: "company_name", label: "Company", nameCell: true },
        {
          key: "footprint_use_case",
          label: "Current Scope",
          sortValue: (r) => r.footprint_use_case || "",
          render: (r) => r.footprint_use_case || <span className="notes-empty">Not documented yet</span>,
        },
        {
          key: "area_names",
          label: "Expansion Areas",
          sortValue: (r) => r.area_count,
          render: (r) => <ExpansionAreaChips areaNames={r.area_names} />,
        },
        {
          key: "expansion_outlook",
          label: "Expansion Outlook",
          sortValue: (r) => r.expansion_outlook || "",
          render: (r) => <StatusPill variant={outlookMeta(r.expansion_outlook).pillVariant}>{outlookMeta(r.expansion_outlook).label}</StatusPill>,
        },
        {
          key: "latest_signal_finding",
          label: "Latest Signal",
          sortValue: (r) => r.latest_signal_date || "",
          render: (r) =>
            r.latest_signal_finding
              ? `${formatShortDate(r.latest_signal_date)} · ${r.latest_signal_finding}`
              : <span className="notes-empty">None yet</span>,
        },
        {
          key: "updated_at",
          label: "Last Updated",
          sortValue: (r) => r.updated_at || "",
          render: (r) => (r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "—"),
        },
      ]}
    />
  );
}
