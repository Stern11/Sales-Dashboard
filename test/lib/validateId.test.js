import { describe, it, expect } from "vitest";
import { isUuid } from "../../lib/validateId.js";

describe("isUuid", () => {
  it("accepts a well-formed uuid in either case", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D")).toBe(true);
  });

  it("rejects the shapes that used to reach Postgres and raise 22P02", () => {
    // Each of these previously produced a 500 carrying the raw PG message
    // ("invalid input syntax for type uuid") instead of a 404.
    expect(isUuid("notauuid")).toBe(false);
    expect(isUuid("lead-1")).toBe(false);
    expect(isUuid("11111111-1111-4111-8111")).toBe(false);
    expect(isUuid("11111111-1111-4111-8111-111111111111x")).toBe(false);
    expect(isUuid("' or 1=1 --")).toBe(false);
  });

  it("rejects non-strings and empty input", () => {
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(12345)).toBe(false);
    expect(isUuid(["11111111-1111-4111-8111-111111111111"])).toBe(false);
  });
});
