import { describe, it, expect, vi, beforeEach } from "vitest";

// A stand-in for the Neon tagged-template client that records the SQL and
// the interpolated values, so these assertions are about the statements the
// module would actually send. There is no database in this suite (see
// vitest.config.js) and this file previously had no tests at all despite
// being the largest module in lib/.
let statements;
let nextRows;

function makeSql() {
  const sql = (strings, ...values) => {
    const text = strings.raw.join("?").replace(/\s+/g, " ").trim();
    const stmt = { text, values };
    statements.push(stmt);
    // Tagged templates are awaited directly for reads, so a statement has to
    // be thenable and resolve to rows.
    stmt.then = (resolve) => resolve(nextRows.shift() ?? []);
    return stmt;
  };
  sql.unsafe = (s) => s;
  sql.transaction = vi.fn(async (stmts) => stmts.map(() => nextRows.shift() ?? []));
  return sql;
}

let sql;
vi.mock("../../../lib/db.js", () => ({
  getSql: () => sql,
  PipelineDbConfigError: class extends Error {},
}));

const q = await import("../../../lib/account-expansion/queries.js");

const ACCOUNT = "acc-1";
const OTHER_ACCOUNT = "acc-2";

beforeEach(() => {
  statements = [];
  nextRows = [];
  sql = makeSql();
});

function writeStatements() {
  return statements.filter((s) => /^(update|delete|insert)/i.test(s.text));
}

describe("account scoping", () => {
  // Every child row (area, signal, stakeholder, question, whitespace) belongs
  // to exactly one account, and the API takes both ids from the URL. If a
  // lookup or write matched on the item id alone, anyone could read or edit
  // another account's rows by guessing one. Each of these asserts the
  // account_id is part of the statement, not just the item id.
  const cases = [
    ["updateArea", () => q.updateArea(ACCOUNT, "area-1", { area: "New" }, "Aryan"), "area-1"],
    ["updateSignal", () => q.updateSignal(ACCOUNT, "sig-1", { finding: "x" }, "Aryan"), "sig-1"],
    ["updateStakeholder", () => q.updateStakeholder(ACCOUNT, "stk-1", { name: "x" }, "Aryan"), "stk-1"],
    ["updateQuestion", () => q.updateQuestion(ACCOUNT, "qst-1", { question: "x" }, "Aryan"), "qst-1"],
    ["deleteWhitespace", () => q.deleteWhitespace(ACCOUNT, "ws-1"), "ws-1"],
    ["deleteSignal", () => q.deleteSignal(ACCOUNT, "sig-1"), "sig-1"],
    ["deleteStakeholder", () => q.deleteStakeholder(ACCOUNT, "stk-1"), "stk-1"],
    ["deleteQuestion", () => q.deleteQuestion(ACCOUNT, "qst-1"), "qst-1"],
  ];

  for (const [name, run, itemId] of cases) {
    it(`${name} scopes by account_id, not just the item id`, async () => {
      // A current row for the update paths to merge against.
      nextRows = [[{ id: itemId, account_id: ACCOUNT }], [{ id: itemId }], []];
      await run();

      const scoped = statements.filter((s) => /account_id = \?/.test(s.text));
      expect(scoped.length).toBeGreaterThan(0);
      for (const s of scoped) {
        expect(s.values).toContain(ACCOUNT);
        expect(s.values).not.toContain(OTHER_ACCOUNT);
      }
    });
  }
});

describe("updateArea", () => {
  it("returns null without writing when the area isn't on this account", async () => {
    nextRows = [[]]; // the scoped lookup finds nothing
    const result = await q.updateArea(ACCOUNT, "area-1", { area: "New" }, "Aryan");

    expect(result).toBeNull();
    expect(writeStatements()).toHaveLength(0);
    expect(sql.transaction).not.toHaveBeenCalled();
  });

  it("merges only editable fields over the current row, ignoring anything else", async () => {
    nextRows = [
      [{ id: "area-1", account_id: ACCOUNT, area: "Old", status: "idea", relevance: "high", archived: false }],
      [{ id: "area-1" }],
      [],
    ];
    await q.updateArea(ACCOUNT, "area-1", { area: "New", account_id: OTHER_ACCOUNT, id: "hijack" }, "Aryan");

    const update = statements.find((s) => /^update account_expansion_areas/i.test(s.text));
    expect(update.values).toContain("New");
    // A client-supplied id/account_id must not become part of the write.
    expect(update.values).not.toContain("hijack");
    expect(update.values).not.toContain(OTHER_ACCOUNT);
  });

  it("normalizes cleared optional fields to null rather than empty strings", async () => {
    nextRows = [
      [{ id: "area-1", account_id: ACCOUNT, area: "Old", notes: "prev", use_case: "prev" }],
      [{ id: "area-1" }],
      [],
    ];
    await q.updateArea(ACCOUNT, "area-1", { notes: "", use_case: "" }, "Aryan");

    const update = statements.find((s) => /^update account_expansion_areas/i.test(s.text));
    expect(update.values).toContain(null);
    expect(update.values).not.toContain("");
  });

  it("touches the parent account so the portfolio list re-sorts", async () => {
    nextRows = [[{ id: "area-1", account_id: ACCOUNT, area: "Old" }], [{ id: "area-1" }], []];
    await q.updateArea(ACCOUNT, "area-1", { area: "New" }, "Aryan");

    const touch = statements.find((s) => /^update account_expansion set/i.test(s.text));
    expect(touch).toBeTruthy();
    expect(touch.values).toContain(ACCOUNT);
    expect(touch.values).toContain("Aryan");
  });
});

describe("upsertWhitespace", () => {
  // The (account_id, area) unique index is what makes re-setting an area's
  // status overwrite rather than duplicate.
  it("upserts on the (account_id, area) conflict target", async () => {
    nextRows = [[{ id: "ws-1", area: "APAC", status: "open" }]];
    await q.upsertWhitespace(ACCOUNT, { area: "APAC", status: "open" }, "Aryan");

    const insert = statements.find((s) => /^insert into account_expansion_whitespace/i.test(s.text));
    expect(insert.text).toMatch(/on conflict \(account_id, area\) do update/i);
    expect(insert.values).toContain(ACCOUNT);
    expect(insert.values).toContain("APAC");
  });
});

describe("getAccountDetail", () => {
  it("fetches the account and all five child collections concurrently", async () => {
    nextRows = [[{ id: ACCOUNT }], [], [], [], [], []];
    const detail = await q.getAccountDetail(ACCOUNT);

    expect(Object.keys(detail).sort()).toEqual(
      ["account", "areas", "questions", "signals", "stakeholders", "whitespace"].sort()
    );
    // Every child query is scoped to this account.
    const scoped = statements.filter((s) => /where account_id = \?/.test(s.text));
    expect(scoped.length).toBe(5);
    for (const s of scoped) expect(s.values).toContain(ACCOUNT);
  });

  // The route handler distinguishes "no such account" from a real detail
  // payload by this being falsy (api/account-expansion/index.js), so the
  // null is load-bearing, not incidental.
  it("reports a missing account as a null account rather than throwing", async () => {
    nextRows = [[], [], [], [], [], []];
    const detail = await q.getAccountDetail("nope");
    expect(detail.account).toBeNull();
  });
});

describe("createAccount", () => {
  it("records the actor as both creator and updater", async () => {
    nextRows = [[{ id: ACCOUNT }]];
    await q.createAccount({ company_name: "Acme" }, "Aryan");

    const insert = statements.find((s) => /^insert into account_expansion /i.test(s.text));
    expect(insert.values.filter((v) => v === "Aryan")).toHaveLength(2);
    expect(insert.values).toContain("Acme");
  });
});
