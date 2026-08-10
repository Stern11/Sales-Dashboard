import { describe, it, expect } from "vitest";
import { OUTCOME_VALUES, isValidOutcome, STATUS_VALUES, isValidStatus } from "../../../lib/demo-calls/constants.js";

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
