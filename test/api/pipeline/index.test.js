import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import handler from "../../../api/pipeline/index.js";
import * as queries from "../../../lib/pipeline/queries.js";
import { sessionCookie, TEST_ACTOR_NAME } from "../../helpers/session.js";

vi.mock("../../../lib/pipeline/queries.js", () => ({
  listLeads: vi.fn(),
  createLead: vi.fn(),
  checkContactIds: vi.fn(),
}));

let AUTHED_COOKIE;
beforeAll(async () => { AUTHED_COOKIE = await sessionCookie(); });

function mockReqRes({ method = "POST", body = {}, query = {}, cookie = undefined } = {}) {
  const headers = {};
  const resolved = cookie === undefined ? AUTHED_COOKIE : cookie;
  if (resolved) headers.cookie = resolved;
  const req = { method, body, query, headers };
  const res = { statusCode: null, body: null };
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((b) => { res.body = b; return res; });
  res.setHeader = vi.fn();
  return { req, res };
}

const VALID = {
  company_name: "Acme",
  contact_name: "Jane Doe",
  source: "ABM",
  company_scale: "smb",
};

beforeEach(() => {
  vi.clearAllMocks();
  queries.checkContactIds.mockResolvedValue([]);
  queries.createLead.mockResolvedValue({ id: "lead-1", company_name: "Acme" });
});

describe("POST /api/pipeline", () => {
  it("creates a lead and returns it", async () => {
    const { req, res } = mockReqRes({ body: VALID });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lead).toMatchObject({ id: "lead-1" });
  });

  it("401s without a session and writes nothing", async () => {
    const { req, res } = mockReqRes({ body: VALID, cookie: null });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(queries.createLead).not.toHaveBeenCalled();
  });

  it("attributes the lead to the session, not to an actor in the body", async () => {
    const { req, res } = mockReqRes({ body: { ...VALID, actor: "Someone Else" } });
    await handler(req, res);
    expect(queries.createLead).toHaveBeenCalledWith(
      expect.objectContaining({ actor: TEST_ACTOR_NAME })
    );
  });

  for (const field of ["company_name", "contact_name", "source"]) {
    it(`400s when ${field} is missing`, async () => {
      const body = { ...VALID };
      delete body[field];
      const { req, res } = mockReqRes({ body });
      await handler(req, res);
      expect(res.statusCode).toBe(400);
      expect(queries.createLead).not.toHaveBeenCalled();
    });
  }

  it("400s an unknown company_scale", async () => {
    const { req, res } = mockReqRes({ body: { ...VALID, company_scale: "galactic" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s an unknown priority", async () => {
    const { req, res } = mockReqRes({ body: { ...VALID, priority: "urgent-ish" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});

// The body used to be handed to createLead() whole, which destructured
// integrity-bearing columns straight out of it.
describe("POST /api/pipeline field allowlist", () => {
  it("ignores columns the client has no business setting", async () => {
    const { req, res } = mockReqRes({
      body: { ...VALID, id: "chosen-by-client", stage: "won", created_by: "Someone Else", updated_at: "1999-01-01" },
    });
    await handler(req, res);

    const fields = queries.createLead.mock.calls[0][0];
    expect(fields).not.toHaveProperty("id");
    expect(fields).not.toHaveProperty("stage");
    expect(fields).not.toHaveProperty("created_by");
    expect(fields).not.toHaveProperty("updated_at");
  });

  // source_locked makes a lead's source permanently uneditable (updateLead
  // refuses to change it afterwards), so it must be a real boolean rather
  // than any truthy value the client happens to send.
  it("coerces source_locked to a strict boolean", async () => {
    const { req, res } = mockReqRes({ body: { ...VALID, source_locked: "yes-please" } });
    await handler(req, res);
    expect(queries.createLead.mock.calls[0][0].source_locked).toBe(false);
  });

  it("keeps source_locked when the ABM handoff genuinely sets it", async () => {
    const { req, res } = mockReqRes({ body: { ...VALID, source_locked: true, hubspot_origin_module: "abm" } });
    await handler(req, res);
    const fields = queries.createLead.mock.calls[0][0];
    expect(fields.source_locked).toBe(true);
    expect(fields.hubspot_origin_module).toBe("abm");
  });

  it("400s a hubspot_origin_module that isn't one of the real modules", async () => {
    const { req, res } = mockReqRes({ body: { ...VALID, hubspot_origin_module: "../../etc/passwd" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s a non-numeric deal_size instead of letting Postgres reject it", async () => {
    const { req, res } = mockReqRes({ body: { ...VALID, deal_size: "abc" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(queries.createLead).not.toHaveBeenCalled();
  });

  it("accepts a numeric deal_size and normalizes an empty one to null", async () => {
    const a = mockReqRes({ body: { ...VALID, deal_size: "25000" } });
    await handler(a.req, a.res);
    expect(queries.createLead.mock.calls[0][0].deal_size).toBe(25000);

    vi.clearAllMocks();
    queries.checkContactIds.mockResolvedValue([]);
    queries.createLead.mockResolvedValue({ id: "lead-2" });
    const b = mockReqRes({ body: { ...VALID, deal_size: "" } });
    await handler(b.req, b.res);
    expect(queries.createLead.mock.calls[0][0].deal_size).toBeNull();
  });
});

describe("POST /api/pipeline duplicate handling", () => {
  it("409s with the existing lead when the contact is already in the pipeline", async () => {
    queries.checkContactIds.mockResolvedValue([{ id: "existing-1", stage: "discovery" }]);
    const { req, res } = mockReqRes({ body: { ...VALID, hubspot_contact_id: "12345" } });
    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.existing_lead).toEqual({ id: "existing-1", stage: "discovery" });
    expect(queries.createLead).not.toHaveBeenCalled();
  });

  it("skips the duplicate check for a manually-entered lead", async () => {
    const { req, res } = mockReqRes({ body: VALID });
    await handler(req, res);
    expect(queries.checkContactIds).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /api/pipeline", () => {
  it("returns the list", async () => {
    queries.listLeads.mockResolvedValue({ leads: [], summary: { total: 0 } });
    const { req, res } = mockReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ summary: { total: 0 } });
  });
});
