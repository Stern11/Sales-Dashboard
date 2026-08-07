import { describe, it, expect } from "vitest";
import { guessCompanyFromEmail, abmLeadToPipelinePrefill, marketingLeadToPipelinePrefill } from "../../../src/lib/pipelineIntegration.js";

describe("guessCompanyFromEmail", () => {
  it("capitalizes the domain's first label", () => {
    expect(guessCompanyFromEmail("aryan@heizen.work")).toBe("Heizen");
  });
  it("handles subdomains by taking the first label after @", () => {
    expect(guessCompanyFromEmail("a@mail.acme.co")).toBe("Mail");
  });
  it("falls back to 'Unknown Company' for a missing/malformed email", () => {
    expect(guessCompanyFromEmail(null)).toBe("Unknown Company");
    expect(guessCompanyFromEmail("")).toBe("Unknown Company");
    expect(guessCompanyFromEmail("not-an-email")).toBe("Unknown Company");
  });
});

describe("abmLeadToPipelinePrefill", () => {
  it("maps an ABM lead to a pipeline-create payload, locking the source and defaulting supply-chain to true", () => {
    const lead = { contact_id: 42, company: "Acme Co", first: "Jane", last: "Doe", email: "jane@acme.co" };
    const prefill = abmLeadToPipelinePrefill(lead);
    expect(prefill).toMatchObject({
      company_name: "Acme Co",
      contact_name: "Jane Doe",
      email: "jane@acme.co",
      source: "ABM",
      source_locked: true,
      is_supply_chain: true,
      hubspot_contact_id: "42",
      hubspot_origin_module: "abm",
    });
  });

  it("handles a missing first/last name without leaving a stray space", () => {
    const prefill = abmLeadToPipelinePrefill({ contact_id: 1, company: "X", first: "", last: "Doe", email: null });
    expect(prefill.contact_name).toBe("Doe");
  });
});

describe("marketingLeadToPipelinePrefill", () => {
  it("guesses the company from the lead's email domain (Marketing leads have no company field)", () => {
    const prefill = marketingLeadToPipelinePrefill({ contact_id: 7, name: "Jane Doe", email: "jane@acme.co" });
    expect(prefill.company_name).toBe("Acme");
    expect(prefill.source).toBe("Ads");
    expect(prefill.source_locked).toBe(true);
    expect(prefill.hubspot_contact_id).toBe("7");
  });
});
