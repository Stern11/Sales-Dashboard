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

// "" (an unselected <select>, e.g. straight from AddDemoCallLeadModal's
// default form state) is as valid/optional as null — createLead/updateLead
// already normalize it to null via blankToNull() before it reaches the DB.

// Where a manually-entered lead actually came from — same dropdown-plus-Other
// pattern as lib/pipeline/constants.js's SOURCE_CATEGORIES. Free text, not a
// DB enum (same reasoning as pipeline_leads.source in db/schema.sql), so
// there's no isValidSource — any string (via the "Other" option) is valid.
export const SOURCE_CATEGORIES = ["Website Inbound", "Referral", "ABM", "Event", "Ads", "Partner", "Demo Call"];
export const SOURCE_OTHER = "Other";

// Shared with the other server module — see lib/companyScale.js.
export { COMPANY_SCALE_OPTIONS, isValidCompanyScale } from "../companyScale.js";
