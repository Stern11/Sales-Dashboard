import { describe, it, expect } from "vitest";
import { isAllowedEmail, ALLOWED_EMAIL_DOMAIN } from "../../../lib/auth/constants.js";

describe("isAllowedEmail", () => {
  it("accepts an exact heizen.work address", () => {
    expect(isAllowedEmail(`aryan@${ALLOWED_EMAIL_DOMAIN}`)).toBe(true);
  });
  it("is case-insensitive on the domain", () => {
    expect(isAllowedEmail("aryan@Heizen.Work")).toBe(true);
  });
  it("rejects a different domain", () => {
    expect(isAllowedEmail("aryan@gmail.com")).toBe(false);
  });
  it("rejects a domain that merely ends with the right string but isn't it (no subdomain bypass)", () => {
    expect(isAllowedEmail("aryan@notheizen.work")).toBe(false);
    expect(isAllowedEmail("aryan@heizen.work.evil.com")).toBe(false);
  });
  it("rejects non-string / empty input instead of throwing", () => {
    expect(isAllowedEmail(null)).toBe(false);
    expect(isAllowedEmail(undefined)).toBe(false);
    expect(isAllowedEmail("")).toBe(false);
  });
});
