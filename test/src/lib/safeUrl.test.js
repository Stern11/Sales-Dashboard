import { describe, it, expect } from "vitest";
import { safeUrl } from "../../../src/lib/safeUrl.js";

describe("safeUrl", () => {
  it("passes through ordinary http(s) links", () => {
    expect(safeUrl("https://gong.io/call/123")).toBe("https://gong.io/call/123");
    expect(safeUrl("http://intranet.local/notes")).toBe("http://intranet.local/notes");
    expect(safeUrl("  https://example.com/x  ")).toBe("https://example.com/x");
  });

  // transcript_url and source_url are free-text fields any signed-in user can
  // set, and they're rendered straight into an href. React escapes element
  // content but does not police URL schemes.
  it("rejects script-bearing schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeUrl("  javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("rejects the tab/newline-obfuscated form the URL parser normalizes away", () => {
    expect(safeUrl("java\tscript:alert(1)")).toBeNull();
    expect(safeUrl("java\nscript:alert(1)")).toBeNull();
  });

  it("rejects relative paths and unparseable junk rather than guessing", () => {
    expect(safeUrl("/pipeline?lead=1")).toBeNull();
    expect(safeUrl("not a url")).toBeNull();
    expect(safeUrl("")).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
  });
});
