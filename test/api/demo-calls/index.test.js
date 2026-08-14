import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { sessionCookie } from "../../helpers/session.js";
import handler from "../../../api/demo-calls/index.js";
import * as queries from "../../../lib/demo-calls/queries.js";
import * as hubspot from "../../../lib/hubspot.js";
import * as hubspotEngagements from "../../../lib/demo-calls/hubspotEngagements.js";

vi.mock("../../../lib/demo-calls/queries.js", () => ({
  listLeads: vi.fn(),
  createLead: vi.fn(),
  getLeadByHubspotContactId: vi.fn(),
  getLeadByPipelineLeadId: vi.fn(),
  listCalls: vi.fn(),
}));

vi.mock("../../../lib/hubspot.js", async () => {
  const actual = await vi.importActual("../../../lib/hubspot.js");
  return { ...actual, getToken: vi.fn() };
});

vi.mock("../../../lib/demo-calls/hubspotEngagements.js", () => ({
  fetchEngagementsForContact: vi.fn(),
}));

// Write routes resolve their actor from the session cookie (lib/auth/actor.js),
// so the default request carries a valid one. Pass `cookie: null` for the
// unauthenticated path.
let AUTHED_COOKIE;
beforeAll(async () => { AUTHED_COOKIE = await sessionCookie(); });

function mockReqRes({ method = "GET", body = {}, query = {}, cookie = undefined } = {}) {
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

beforeEach(() => vi.clearAllMocks());

describe("GET /api/demo-calls", () => {
  it("returns the list payload", async () => {
    queries.listLeads.mockResolvedValue({ leads: [], summary: { total: 0 } });
    const { req, res } = mockReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ leads: [], summary: { total: 0 } });
    expect(queries.getLeadByPipelineLeadId).not.toHaveBeenCalled();
  });
});

describe("GET /api/demo-calls?pipeline_lead_id=", () => {
  it("returns {lead: null, calls: []} (200, not 404) when no Demo Calls history exists for this pipeline lead", async () => {
    queries.getLeadByPipelineLeadId.mockResolvedValue(null);
    const { req, res } = mockReqRes({ query: { pipeline_lead_id: "p1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ lead: null, calls: [] });
    expect(queries.listCalls).not.toHaveBeenCalled();
    expect(queries.listLeads).not.toHaveBeenCalled();
  });

  it("returns the lead and its calls when history exists", async () => {
    queries.getLeadByPipelineLeadId.mockResolvedValue({ id: "dc1", company_name: "Acme" });
    queries.listCalls.mockResolvedValue([{ id: "call-1", call_number: 1 }]);
    const { req, res } = mockReqRes({ query: { pipeline_lead_id: "p1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ lead: { id: "dc1", company_name: "Acme" }, calls: [{ id: "call-1", call_number: 1 }] });
    expect(queries.listCalls).toHaveBeenCalledWith("dc1");
  });
});

describe("GET /api/demo-calls?action=hubspot-engagements", () => {
  it("400s when contact_id is missing", async () => {
    const { req, res } = mockReqRes({ query: { action: "hubspot-engagements" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(hubspotEngagements.fetchEngagementsForContact).not.toHaveBeenCalled();
  });

  it("returns the fetched engagements for a given contact_id", async () => {
    hubspot.getToken.mockReturnValue("tok");
    hubspotEngagements.fetchEngagementsForContact.mockResolvedValue({
      engagements: [{ id: "m1", type: "meeting" }],
      notes_available: true,
    });
    const { req, res } = mockReqRes({ query: { action: "hubspot-engagements", contact_id: "999" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.engagements).toEqual([{ id: "m1", type: "meeting" }]);
    expect(hubspotEngagements.fetchEngagementsForContact).toHaveBeenCalledWith("tok", "999");
    expect(queries.listLeads).not.toHaveBeenCalled();
  });

  it("maps a HubspotConfigError (missing HUBSPOT_TOKEN) to a 500 with a clear message", async () => {
    hubspot.getToken.mockImplementation(() => { throw new hubspot.HubspotConfigError("HUBSPOT_TOKEN environment variable is not set on this deployment."); });
    const { req, res } = mockReqRes({ query: { action: "hubspot-engagements", contact_id: "999" } });
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });
});

describe("POST /api/demo-calls", () => {
  it("400s when company_name is missing", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { contact_name: "Jane", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when contact_name is missing", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { company_name: "Acme", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s on an invalid company_scale", async () => {
    const { req, res } = mockReqRes({
      method: "POST",
      body: { company_name: "Acme", contact_name: "Jane", actor: "Aryan", company_scale: "bogus" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("401s without a session — the actor comes from the session, not the body", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { company_name: "Acme", contact_name: "Jane" }, cookie: null });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("400s on an invalid first_call.outcome", async () => {
    const { req, res } = mockReqRes({
      method: "POST",
      body: { company_name: "Acme", contact_name: "Jane", actor: "Aryan", first_call: { outcome: "bogus" } },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("creates a lead when the body is valid", async () => {
    queries.createLead.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", company_name: "Acme" });
    const { req, res } = mockReqRes({ method: "POST", body: { company_name: "Acme", contact_name: "Jane", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lead.id).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("409s when hubspot_contact_id already has a tracked lead — doesn't call createLead", async () => {
    queries.getLeadByHubspotContactId.mockResolvedValue({ id: "existing-1", status: "active" });
    const { req, res } = mockReqRes({
      method: "POST",
      body: { company_name: "Acme", contact_name: "Jane", actor: "Aryan", hubspot_contact_id: "999" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.existing_lead).toEqual({ id: "existing-1", status: "active" });
    expect(queries.createLead).not.toHaveBeenCalled();
  });

  it("405s for an unsupported method", async () => {
    const { req, res } = mockReqRes({ method: "DELETE" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
