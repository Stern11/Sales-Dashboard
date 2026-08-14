// Account Expansion vocabulary shared by the API layer and (mirrored) by the
// frontend's src/modules/abm/expansion/constants.js. See
// lib/demo-calls/constants.js for the pattern this follows.

export const EXPANSION_OUTLOOK_VALUES = ["high", "medium", "early"];
export function isValidExpansionOutlook(value) {
  return value == null || value === "" || EXPANSION_OUTLOOK_VALUES.includes(value);
}

export const AREA_STATUS_VALUES = ["idea", "researching", "validated"];
export function isValidAreaStatus(value) {
  return AREA_STATUS_VALUES.includes(value);
}

export const RELEVANCE_VALUES = ["high", "medium", "low"];
export function isValidRelevance(value) {
  return RELEVANCE_VALUES.includes(value);
}

export const WHITESPACE_STATUS_VALUES = ["current", "potential", "unknown"];
export function isValidWhitespaceStatus(value) {
  return WHITESPACE_STATUS_VALUES.includes(value);
}

export const SIGNAL_TYPE_VALUES = [
  "company_strategy", "leadership", "transformation", "hiring",
  "technology", "operations", "internal_learning", "other",
];
export function isValidSignalType(value) {
  return SIGNAL_TYPE_VALUES.includes(value);
}

export const RELATIONSHIP_VALUES = ["known", "need_intro", "research", "unknown"];
export function isValidRelationship(value) {
  return RELATIONSHIP_VALUES.includes(value);
}

export const QUESTION_PRIORITY_VALUES = ["high", "medium", "low"];
export function isValidQuestionPriority(value) {
  return QUESTION_PRIORITY_VALUES.includes(value);
}
