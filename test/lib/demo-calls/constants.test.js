import { describe, it, expect } from "vitest";
import { OUTCOME_VALUES, isValidOutcome, STATUS_VALUES, isValidStatus, COMPANY_SCALE_OPTIONS, isValidCompanyScale } from "../../../lib/demo-calls/constants.js";

describe("isValidOutcome", () => {
  it("accepts every declared outcome value", () => {
    for (const v of OUTCOME_VALUES) expect(isValidOutcome(v)).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isValidOutcome("bogus")).toBe(false);
    expect(isValidOutcome("")).toBe(false);
    expect(isValidOutcome(undefined)).toBe(false);
  });
});

describe("isValidStatus", () => {
  it("accepts every declared status value", () => {
    for (const v of STATUS_VALUES) expect(isValidStatus(v)).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isValidStatus("bogus")).toBe(false);
    expect(isValidStatus(undefined)).toBe(false);
  });
});

describe("isValidCompanyScale", () => {
  it("accepts every declared option", () => {
    for (const o of COMPANY_SCALE_OPTIONS) expect(isValidCompanyScale(o.value)).toBe(true);
  });
  it("null/undefined/'' are all valid — scale is optional, and '' is what an unselected <select> sends", () => {
    expect(isValidCompanyScale(null)).toBe(true);
    expect(isValidCompanyScale(undefined)).toBe(true);
    expect(isValidCompanyScale("")).toBe(true);
  });
  it("rejects an unknown value", () => {
    expect(isValidCompanyScale("giant")).toBe(false);
  });
});
