// Frontend-facing mirror of lib/pipeline/constants.js — labels, order, and
// pill colors for the UI. Kept as plain data (not DB enums) so adding a
// stage/scale/source is a one-file-per-side change; see db/schema.sql.

export const STAGES = [
  { value: "sql", label: "SQL", isActive: true, isTerminal: false, pillVariant: "notstarted", color: "var(--stage-sql)" },
  { value: "discovery", label: "Discovery", isActive: true, isTerminal: false, pillVariant: "stage", color: "var(--stage-discovery)" },
  { value: "proposal", label: "Proposal", isActive: true, isTerminal: false, pillVariant: "stage", color: "var(--stage-proposal)" },
  { value: "commercial", label: "Commercial", isActive: true, isTerminal: false, pillVariant: "stage", color: "var(--stage-commercial)" },
  { value: "won", label: "Won", isActive: true, isTerminal: true, pillVariant: "ready", color: "var(--stage-won)" },
  { value: "cold", label: "Cold", isActive: false, isTerminal: false, pillVariant: "cold", color: "var(--stage-cold)" },
  { value: "lost", label: "Lost", isActive: false, isTerminal: true, pillVariant: "lost", color: "var(--stage-lost)" },
];

export const BOARD_STAGES = STAGES; // all 7 shown as columns in v1 (see plan's open-risk note on cold/lost column treatment)
export const ACTIVE_STAGES = STAGES.filter((s) => s.isActive);

export function stageMeta(value) {
  return STAGES.find((s) => s.value === value) || { value, label: value, pillVariant: "stage" };
}

export const COMPANY_SCALE_OPTIONS = [
  { value: "startup", label: "Startup (<50 employees)" },
  { value: "smb", label: "SMB (50–200)" },
  { value: "mid_market", label: "Mid-Market (200–1000)" },
  { value: "enterprise", label: "Enterprise (1000+)" },
];

export function scaleLabel(value) {
  return COMPANY_SCALE_OPTIONS.find((o) => o.value === value)?.label || "—";
}

export const PRIORITY_OPTIONS = [
  { value: "high", label: "P0", formLabel: "P0 — High", pillVariant: "lost" },
  { value: "medium", label: "P1", formLabel: "P1 — Medium", pillVariant: "stage" },
  { value: "low", label: "P2", formLabel: "P2 — Low", pillVariant: "cold" },
];

export function priorityMeta(value) {
  return PRIORITY_OPTIONS.find((o) => o.value === value) || PRIORITY_OPTIONS[1];
}

// Fixed source categories — a lead's `source` is one of these, or (when
// SOURCE_OTHER is picked) any free text the user types describing where it
// actually came from. See LeadFieldsForm.jsx for the dropdown + "Other" text
// box this drives.
export const SOURCE_CATEGORIES = ["ABM", "Event", "Ads", "Partner", "Referral"];
export const SOURCE_OTHER = "Other";
export const SOURCE_PRESETS = [...SOURCE_CATEGORIES, SOURCE_OTHER];

export const currency = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function relativeTime(isoString) {
  if (!isoString) return "—";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}
