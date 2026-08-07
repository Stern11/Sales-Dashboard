import { describe, it, expect } from "vitest";
import { getActiveQuery, matchItems } from "../../../../src/modules/pipeline/MentionTextarea.jsx";
import { TEAM_DIRECTORY } from "../../../../src/modules/pipeline/team.js";

describe("getActiveQuery", () => {
  it("returns null when there is no @ before the cursor", () => {
    expect(getActiveQuery("hello world", 5)).toBeNull();
  });

  it("detects an @ at the very start of the text", () => {
    const r = getActiveQuery("@Ar", 3);
    expect(r).toEqual({ atIndex: 0, cursor: 3, query: "Ar" });
  });

  it("detects an @ after whitespace, mid-sentence", () => {
    const r = getActiveQuery("please ping @Nij", 16);
    expect(r).toEqual({ atIndex: 12, cursor: 16, query: "Nij" });
  });

  it("does NOT trigger when @ is mid-word (no preceding whitespace/start-of-text boundary)", () => {
    // e.g. someone typing "foo@bar" as plain text, not a mention
    expect(getActiveQuery("foo@bar", 7)).toBeNull();
  });

  it("closes once whitespace follows the @word (mention finished/abandoned)", () => {
    // cursor=6 is still inside the word ("@Aryan|"), still active:
    expect(getActiveQuery("@Aryan work on this", 6)).toEqual({ atIndex: 0, cursor: 6, query: "Aryan" });
    // cursor=7 is past the trailing space ("@Aryan |"), mention is closed:
    expect(getActiveQuery("@Aryan work on this", 7)).toBeNull();
  });

  it("only looks at text up to the cursor, not the whole string — editing earlier text shouldn't reopen a stale mention", () => {
    // cursor sits right after "@Aryan" (position 6); trailing text is irrelevant
    const r = getActiveQuery("@Aryan and some other text", 6);
    expect(r).toEqual({ atIndex: 0, cursor: 6, query: "Aryan" });
  });

  it("captures a second @ inside the query — the escape hatch for typing a raw email after the trigger", () => {
    const text = "@newperson@company.com";
    const r = getActiveQuery(text, text.length);
    expect(r.query).toBe("newperson@company.com");
    expect(r.atIndex).toBe(0);
  });

  it("treats a bare @ (nothing typed yet) as an empty query, not null", () => {
    expect(getActiveQuery("@", 1)).toEqual({ atIndex: 0, cursor: 1, query: "" });
  });
});

describe("matchItems", () => {
  it("returns the full TEAM_DIRECTORY for an empty query", () => {
    expect(matchItems("")).toHaveLength(TEAM_DIRECTORY.length);
  });

  it("filters by name, case-insensitively", () => {
    const items = matchItems("ary");
    expect(items.map((i) => i.email)).toContain("aryan@heizen.work");
  });

  it("filters by email substring too", () => {
    const items = matchItems("heizen.work");
    expect(items).toHaveLength(TEAM_DIRECTORY.length); // every directory email shares this domain
  });

  it("returns no roster matches for a query that matches nobody and doesn't look like an email", () => {
    expect(matchItems("zzz")).toEqual([]);
  });

  it("switches to the raw-email escape hatch once the query looks like a complete email, even if it doesn't match anyone in the roster", () => {
    const items = matchItems("newperson@company.com");
    expect(items).toEqual([{ key: "newperson@company.com", email: "newperson@company.com", label: "Tag newperson@company.com" }]);
  });

  it("prefers the raw-email path over roster matching even if the email-shaped text happens to also match a name substring", () => {
    // "aryan@x.io" contains "aryan" (a real directory name) AND looks like an email —
    // the escape hatch should win so the user tags exactly what they typed.
    const items = matchItems("aryan@x.io");
    expect(items).toEqual([{ key: "aryan@x.io", email: "aryan@x.io", label: "Tag aryan@x.io" }]);
  });

  it("does not yet treat an in-progress, dot-less email as a raw email (still shows roster/empty, not a premature 'Tag' suggestion)", () => {
    expect(matchItems("newperson@compa")).toEqual([]); // no dot yet — LOOKS_LIKE_EMAIL requires one
  });
});
