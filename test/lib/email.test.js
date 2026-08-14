import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { stripMentions, notifyTagged, EmailConfigError } from "../../lib/email.js";

describe("stripMentions", () => {
  it("removes a leading mention token", () => {
    expect(stripMentions("@Aryan please follow up")).toBe("please follow up");
  });

  it("removes multiple mentions anywhere in the text", () => {
    expect(stripMentions("cc @Aman and @newperson@co.com on this")).toBe("cc and on this");
  });

  it("leaves plain text with no mentions untouched", () => {
    expect(stripMentions("no mentions here")).toBe("no mentions here");
  });

  it("falls back to the raw (untrimmed-of-@) text when the body is ONLY mention tokens — otherwise the email would show an empty task", () => {
    expect(stripMentions("@Aryan")).toBe("@Aryan");
    expect(stripMentions("@Aryan @Aman")).toBe("@Aryan @Aman");
  });
});

describe("notifyTagged", () => {
  const realFetch = globalThis.fetch;
  const envBackup = { ...process.env };

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    process.env.RESEND_API_KEY = "test-key";
    delete process.env.EMAIL_FROM;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    process.env = { ...envBackup };
  });

  it("throws EmailConfigError (not a fetch call) when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    await expect(
      notifyTagged({ to: "a@b.com", actor: "Aryan", companyName: "Acme", leadId: "1", noteBody: "do the thing" })
    ).rejects.toBeInstanceOf(EmailConfigError);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("sends to the given recipient with a Resend-shaped body", async () => {
    await notifyTagged({ to: "aman@heizen.work", actor: "Aryan", companyName: "Acme", leadId: "1", noteBody: "call the client" });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(opts.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(opts.body);
    expect(body.to).toEqual(["aman@heizen.work"]);
    expect(body.from).toBe("Sales Pipeline <onboarding@resend.dev>"); // sandbox fallback since EMAIL_FROM is unset
    expect(body.text).toContain("call the client");
  });

  it("uses EMAIL_FROM when set instead of the sandbox sender", async () => {
    process.env.EMAIL_FROM = "Sales Pipeline <pipeline@heizen.work>";
    await notifyTagged({ to: "a@b.com", actor: "Aryan", companyName: "Acme", leadId: "1", noteBody: "x" });
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.from).toBe("Sales Pipeline <pipeline@heizen.work>");
  });

  it("formats a deal_size that arrives as a numeric STRING (Neon returns numeric columns as strings)", async () => {
    await notifyTagged({
      to: "a@b.com", actor: "Aryan", companyName: "Acme", leadId: "1", noteBody: "x",
      dealSize: "75000.00", // exactly the shape lib/pipeline/queries.js returns
    });
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    // Computed with the same Intl.NumberFormat(undefined, ...) call lib/email.js
    // uses, rather than a hardcoded "$75,000" — that call follows the *runtime's*
    // default locale (no explicit locale is passed), so a hardcoded en-US-shaped
    // string would be a false failure on a non-en-US server locale.
    const expected = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(75000);
    expect(body.html).toContain(expected);
  });

  it("omits the deal-size badge entirely when dealSize is null", async () => {
    await notifyTagged({ to: "a@b.com", actor: "Aryan", companyName: "Acme", leadId: "1", noteBody: "x", dealSize: null });
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.html).not.toContain("$");
  });

  it("HTML-escapes attacker-controlled fields (company name, note body) to prevent injection into the email", async () => {
    await notifyTagged({
      to: "a@b.com", actor: "Aryan",
      companyName: "<img src=x onerror=alert(1)>",
      leadId: "1",
      noteBody: "<script>alert(1)</script>",
    });
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.html).not.toContain("<script>");
    expect(body.html).not.toContain("<img src=x onerror");
    expect(body.html).toContain("&lt;script&gt;");
  });

  it("builds the lead link from the configured origin", async () => {
    process.env.APP_ORIGIN = "https://dashboard.heizen.work";
    await notifyTagged({ to: "a@b.com", actor: "Aryan", companyName: "Acme", leadId: "abc-123", noteBody: "x" });
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.text).toContain("https://dashboard.heizen.work/pipeline?lead=abc-123");
    delete process.env.APP_ORIGIN;
  });

  // The origin used to come from req.headers.host, which the caller controls
  // — so whoever triggered the email chose where its button pointed, in mail
  // sent from our own verified sender to a real colleague.
  it("ignores the request's Host header when choosing the link origin", async () => {
    process.env.APP_ORIGIN = "https://dashboard.heizen.work";
    await notifyTagged({
      to: "a@b.com", actor: "Aryan", companyName: "Acme", leadId: "abc-123", noteBody: "x",
      req: { headers: { host: "evil.example", "x-forwarded-proto": "https" } },
    });
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.text).not.toContain("evil.example");
    expect(body.html).not.toContain("evil.example");
    delete process.env.APP_ORIGIN;
  });

  it("omits the lead link (doesn't crash) when no origin is configured", async () => {
    delete process.env.APP_ORIGIN;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    await notifyTagged({ to: "a@b.com", actor: "Aryan", companyName: "Acme", leadId: "1", noteBody: "x" });
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.text).not.toContain("View the lead:");
  });

  it("rejects when Resend responds with a non-ok status", async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ message: "domain not verified" }) });
    await expect(
      notifyTagged({ to: "a@b.com", actor: "Aryan", companyName: "Acme", leadId: "1", noteBody: "x" })
    ).rejects.toThrow(/domain not verified/);
  });
});
