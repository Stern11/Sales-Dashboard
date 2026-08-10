// Sales Pipeline vocabulary shared by the API layer and (mirrored) by the
// frontend's src/modules/pipeline/constants.js. Kept as plain arrays/objects
// (not DB enums) so adding a scale bucket or source preset is a one-file
// code change — see db/schema.sql's comment on `company_scale`/`source`.

export const STAGES = [
  { value: "sql", label: "SQL", isActive: true, isTerminal: false },
  { value: "discovery", label: "Discovery", isActive: true, isTerminal: false },
  { value: "proposal", label: "Proposal", isActive: true, isTerminal: false },
  { value: "commercial", label: "Commercial", isActive: true, isTerminal: false },
  { value: "won", label: "Won", isActive: true, isTerminal: true },
  { value: "cold", label: "Cold", isActive: false, isTerminal: false },
  { value: "lost", label: "Lost", isActive: false, isTerminal: true },
];

export const STAGE_VALUES = STAGES.map((s) => s.value);
export const ACTIVE_STAGE_VALUES = STAGES.filter((s) => s.isActive).map((s) => s.value);

export function isValidStage(value) {
  return STAGE_VALUES.includes(value);
}

export function isActiveStage(value) {
  return ACTIVE_STAGE_VALUES.includes(value);
}

export const COMPANY_SCALE_OPTIONS = [
  { value: "startup", label: "Startup (<50 employees)" },
  { value: "smb", label: "SMB (50–200)" },
  { value: "mid_market", label: "Mid-Market (200–1000)" },
  { value: "enterprise", label: "Enterprise (1000+)" },
];

export function isValidCompanyScale(value) {
  return value == null || COMPANY_SCALE_OPTIONS.some((o) => o.value === value);
}

export const PRIORITY_VALUES = ["low", "medium", "high"];

export function isValidPriority(value) {
  return PRIORITY_VALUES.includes(value);
}

// Fixed source categories shown in the frontend dropdown (src/modules/pipeline/constants.js
// mirrors this) — "Other" allows any free text. Not DB-enforced (see the
// `source` column comment in db/schema.sql), just kept in sync for docs/consistency.
export const SOURCE_CATEGORIES = ["ABM", "Event", "Ads", "Partner", "Referral", "Demo Call"];
export const SOURCE_OTHER = "Other";
export const SOURCE_PRESETS = [...SOURCE_CATEGORIES, SOURCE_OTHER];

// Same pattern as source: fixed categories + free-text "Other". Optional
// (nullable) — unlike source, a lead's region isn't always known up front.
export const REGION_CATEGORIES = ["US", "UK", "APAC", "India"];
export const REGION_OTHER = "Other";
export const REGION_PRESETS = [...REGION_CATEGORIES, REGION_OTHER];
