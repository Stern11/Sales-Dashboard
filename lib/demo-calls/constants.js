// Demo Calls vocabulary shared by the API layer and (mirrored) by the
// frontend's src/modules/demo-calls/constants.js. See lib/pipeline/constants.js
// for the pattern this follows.

export const OUTCOME_VALUES = ["completed", "no_show", "scheduled"];

export function isValidOutcome(value) {
  return OUTCOME_VALUES.includes(value);
}

export const STATUS_VALUES = ["active", "irrelevant"];

export function isValidStatus(value) {
  return STATUS_VALUES.includes(value);
}

// Mirrors lib/pipeline/constants.js's COMPANY_SCALE_OPTIONS exactly — same
// vocabulary, so a lead's scale means the same thing whether set here or
// after "Add to pipeline" carries it through (see demoCallLeadToPipelinePrefill).
export const COMPANY_SCALE_OPTIONS = [
  { value: "startup", label: "Startup (<50 employees)" },
  { value: "smb", label: "SMB (50–200)" },
  { value: "mid_market", label: "Mid-Market (200–1000)" },
  { value: "enterprise", label: "Enterprise (1000+)" },
];

// "" (an unselected <select>, e.g. straight from AddDemoCallLeadModal's
// default form state) is as valid/optional as null — createLead/updateLead
// already normalize it to null via blankToNull() before it reaches the DB.
export function isValidCompanyScale(value) {
  return value == null || value === "" || COMPANY_SCALE_OPTIONS.some((o) => o.value === value);
}
