import { describe, it, expect } from "vitest";
import {
  EXPANSION_OUTLOOK_OPTIONS, outlookMeta,
  AREA_STATUS_OPTIONS, areaStatusMeta,
  RELEVANCE_OPTIONS, relevanceMeta,
  WHITESPACE_STATUS_OPTIONS, whitespaceStatusMeta,
  SIGNAL_TYPE_OPTIONS, signalTypeLabel,
  RELATIONSHIP_OPTIONS, relationshipMeta,
  QUESTION_PRIORITY_OPTIONS, questionPriorityMeta,
  formatShortDate,
} from "../../../../src/modules/account-expansion/constants.js";
import {
  EXPANSION_OUTLOOK_VALUES, AREA_STATUS_VALUES, RELEVANCE_VALUES,
  WHITESPACE_STATUS_VALUES, SIGNAL_TYPE_VALUES, RELATIONSHIP_VALUES, QUESTION_PRIORITY_VALUES,
} from "../../../../lib/account-expansion/constants.js";

// Every frontend option list must mirror the backend's valid-value list
// exactly (same values, same order isn't required but coverage is) — the two
// files have no shared source, so this is the only thing that catches drift.
describe("frontend option lists mirror the backend valid-value lists", () => {
  it("EXPANSION_OUTLOOK_OPTIONS", () => {
    expect(EXPANSION_OUTLOOK_OPTIONS.map((o) => o.value).sort()).toEqual([...EXPANSION_OUTLOOK_VALUES].sort());
  });
  it("AREA_STATUS_OPTIONS", () => {
    expect(AREA_STATUS_OPTIONS.map((o) => o.value).sort()).toEqual([...AREA_STATUS_VALUES].sort());
  });
  it("RELEVANCE_OPTIONS", () => {
    expect(RELEVANCE_OPTIONS.map((o) => o.value).sort()).toEqual([...RELEVANCE_VALUES].sort());
  });
  it("WHITESPACE_STATUS_OPTIONS", () => {
    expect(WHITESPACE_STATUS_OPTIONS.map((o) => o.value).sort()).toEqual([...WHITESPACE_STATUS_VALUES].sort());
  });
  it("SIGNAL_TYPE_OPTIONS", () => {
    expect(SIGNAL_TYPE_OPTIONS.map((o) => o.value).sort()).toEqual([...SIGNAL_TYPE_VALUES].sort());
  });
  it("RELATIONSHIP_OPTIONS", () => {
    expect(RELATIONSHIP_OPTIONS.map((o) => o.value).sort()).toEqual([...RELATIONSHIP_VALUES].sort());
  });
  it("QUESTION_PRIORITY_OPTIONS", () => {
    expect(QUESTION_PRIORITY_OPTIONS.map((o) => o.value).sort()).toEqual([...QUESTION_PRIORITY_VALUES].sort());
  });
});

describe("meta lookup helpers", () => {
  it("return the matching option for every known value", () => {
    for (const o of EXPANSION_OUTLOOK_OPTIONS) expect(outlookMeta(o.value)).toBe(o);
    for (const o of AREA_STATUS_OPTIONS) expect(areaStatusMeta(o.value)).toBe(o);
    for (const o of RELEVANCE_OPTIONS) expect(relevanceMeta(o.value)).toBe(o);
    for (const o of WHITESPACE_STATUS_OPTIONS) expect(whitespaceStatusMeta(o.value)).toBe(o);
    for (const o of RELATIONSHIP_OPTIONS) expect(relationshipMeta(o.value)).toBe(o);
    for (const o of QUESTION_PRIORITY_OPTIONS) expect(questionPriorityMeta(o.value)).toBe(o);
  });

  it("fall back to a generic shape instead of throwing on an unknown value", () => {
    expect(outlookMeta("bogus").label).toBe("Not set");
    expect(areaStatusMeta("bogus").label).toBe("bogus");
    expect(relevanceMeta("bogus").label).toBe("bogus");
    expect(whitespaceStatusMeta("bogus").label).toBe("bogus");
    expect(relationshipMeta("bogus").label).toBe("bogus");
    expect(questionPriorityMeta("bogus").label).toBe("bogus");
  });

  it("outlookMeta treats null/undefined the same as an unset value", () => {
    expect(outlookMeta(null).label).toBe("Not set");
    expect(outlookMeta(undefined).label).toBe("Not set");
  });
});

describe("signalTypeLabel", () => {
  it("returns the matching label for every known value", () => {
    for (const o of SIGNAL_TYPE_OPTIONS) expect(signalTypeLabel(o.value)).toBe(o.label);
  });
  it("falls back to the raw value for an unknown type", () => {
    expect(signalTypeLabel("bogus")).toBe("bogus");
  });
});

describe("formatShortDate", () => {
  it("formats a plain YYYY-MM-DD string", () => {
    expect(formatShortDate("2026-08-14")).toBe("Aug 14, 2026");
  });
  it("returns null for a missing date rather than throwing", () => {
    expect(formatShortDate(null)).toBeNull();
    expect(formatShortDate(undefined)).toBeNull();
    expect(formatShortDate("")).toBeNull();
  });
});
