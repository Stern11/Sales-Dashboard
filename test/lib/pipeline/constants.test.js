import { describe, it, expect } from "vitest";
import {
  STAGES, STAGE_VALUES, ACTIVE_STAGE_VALUES,
  isValidStage, isActiveStage, isValidCompanyScale, isValidPriority,
} from "../../../lib/pipeline/constants.js";

describe("isValidStage", () => {
  it("accepts every declared stage value", () => {
    for (const v of STAGE_VALUES) expect(isValidStage(v)).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isValidStage("bogus")).toBe(false);
    expect(isValidStage("")).toBe(false);
    expect(isValidStage(undefined)).toBe(false);
  });
});

describe("isActiveStage", () => {
  it("matches STAGES' own isActive flag for every stage", () => {
    for (const s of STAGES) expect(isActiveStage(s.value)).toBe(s.isActive);
  });
  it("won counts as active — open_pipeline_value intentionally includes won deals (see summarize())", () => {
    expect(isActiveStage("won")).toBe(true);
  });
  it("cold/lost are not active", () => {
    expect(isActiveStage("cold")).toBe(false);
    expect(isActiveStage("lost")).toBe(false);
  });
  it("ACTIVE_STAGE_VALUES stays in sync with STAGES", () => {
    expect(ACTIVE_STAGE_VALUES).toEqual(STAGES.filter((s) => s.isActive).map((s) => s.value));
  });
});

describe("isValidCompanyScale", () => {
  it("null/undefined are valid — scale is optional", () => {
    expect(isValidCompanyScale(null)).toBe(true);
    expect(isValidCompanyScale(undefined)).toBe(true);
  });
  it("accepts a real option, rejects an unknown one", () => {
    expect(isValidCompanyScale("smb")).toBe(true);
    expect(isValidCompanyScale("giant")).toBe(false);
  });
});

describe("isValidPriority", () => {
  it("accepts the three known levels, rejects everything else", () => {
    expect(isValidPriority("low")).toBe(true);
    expect(isValidPriority("medium")).toBe(true);
    expect(isValidPriority("high")).toBe(true);
    expect(isValidPriority("urgent")).toBe(false);
    expect(isValidPriority(null)).toBe(false);
  });
});
