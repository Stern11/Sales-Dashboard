import { describe, it, expect } from "vitest";
import {
  EXPANSION_OUTLOOK_VALUES, isValidExpansionOutlook,
  AREA_STATUS_VALUES, isValidAreaStatus,
  RELEVANCE_VALUES, isValidRelevance,
  WHITESPACE_STATUS_VALUES, isValidWhitespaceStatus,
  SIGNAL_TYPE_VALUES, isValidSignalType,
  RELATIONSHIP_VALUES, isValidRelationship,
  QUESTION_PRIORITY_VALUES, isValidQuestionPriority,
} from "../../../lib/account-expansion/constants.js";

describe("isValidExpansionOutlook", () => {
  it("accepts every declared value", () => {
    for (const v of EXPANSION_OUTLOOK_VALUES) expect(isValidExpansionOutlook(v)).toBe(true);
  });
  it("null/undefined/'' are all valid — outlook is optional", () => {
    expect(isValidExpansionOutlook(null)).toBe(true);
    expect(isValidExpansionOutlook(undefined)).toBe(true);
    expect(isValidExpansionOutlook("")).toBe(true);
  });
  it("rejects an unknown value", () => {
    expect(isValidExpansionOutlook("bogus")).toBe(false);
  });
});

describe("isValidAreaStatus", () => {
  it("accepts every declared value", () => {
    for (const v of AREA_STATUS_VALUES) expect(isValidAreaStatus(v)).toBe(true);
  });
  it("rejects unknown/empty values — status is required, not optional", () => {
    expect(isValidAreaStatus("bogus")).toBe(false);
    expect(isValidAreaStatus("")).toBe(false);
    expect(isValidAreaStatus(undefined)).toBe(false);
  });
});

describe("isValidRelevance", () => {
  it("accepts every declared value", () => {
    for (const v of RELEVANCE_VALUES) expect(isValidRelevance(v)).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isValidRelevance("bogus")).toBe(false);
  });
});

describe("isValidWhitespaceStatus", () => {
  it("accepts every declared value", () => {
    for (const v of WHITESPACE_STATUS_VALUES) expect(isValidWhitespaceStatus(v)).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isValidWhitespaceStatus("bogus")).toBe(false);
  });
});

describe("isValidSignalType", () => {
  it("accepts every declared value", () => {
    for (const v of SIGNAL_TYPE_VALUES) expect(isValidSignalType(v)).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isValidSignalType("bogus")).toBe(false);
  });
});

describe("isValidRelationship", () => {
  it("accepts every declared value", () => {
    for (const v of RELATIONSHIP_VALUES) expect(isValidRelationship(v)).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isValidRelationship("bogus")).toBe(false);
  });
});

describe("isValidQuestionPriority", () => {
  it("accepts every declared value", () => {
    for (const v of QUESTION_PRIORITY_VALUES) expect(isValidQuestionPriority(v)).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isValidQuestionPriority("bogus")).toBe(false);
  });
});
