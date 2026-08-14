import { describe, it, expect, vi, beforeEach } from "vitest";

// The Neon client is a tagged-template function with a .transaction() method.
// Capturing the interpolated values lets us assert on the SQL that would be
// sent without needing a database.
const statements = [];
function makeSql() {
  const sql = (strings, ...values) => {
    const text = strings.raw.join("?");
    statements.push({ text, values });
    return { text, values };
  };
  sql.unsafe = (s) => s;
  sql.transaction = vi.fn(async () => [[{ id: "call-1", call_number: 3 }]]);
  return sql;
}

let sql;
vi.mock("../../../lib/db.js", () => ({
  getSql: () => sql,
  PipelineDbConfigError: class extends Error {},
}));

const { addCall } = await import("../../../lib/demo-calls/queries.js");

describe("addCall", () => {
  beforeEach(() => {
    statements.length = 0;
    sql = makeSql();
  });

  // The old implementation ran `select count(*)` as its own round trip and
  // added one in JS, so two concurrent "log a call" clicks both read the same
  // count and wrote the same call_number. That corrupted listLeads(), which
  // reads outcomes positionally via array_agg(... order by call_number).
  it("derives call_number inside the INSERT, not from a separate count query", async () => {
    await addCall("lead-1", { outcome: "completed" }, "Aryan");

    const texts = statements.map((s) => s.text).join("\n");
    expect(texts).not.toMatch(/select count\(\*\)/i);
    expect(texts).toMatch(/select coalesce\(max\(call_number\), 0\) \+ 1 from demo_call_logs/i);
  });

  it("issues no read before the write — the insert is self-contained", async () => {
    await addCall("lead-1", { outcome: "completed" }, "Aryan");

    // Every statement built here belongs to the single transaction; none is
    // a preceding standalone SELECT.
    const standaloneSelects = statements.filter((s) => /^\s*select/i.test(s.text));
    expect(standaloneSelects).toHaveLength(0);
    expect(sql.transaction).toHaveBeenCalledTimes(1);
  });

  it("scopes the number to the lead it's inserting for", async () => {
    await addCall("lead-42", { outcome: "no_show" }, "Aryan");
    const insert = statements.find((s) => /insert into demo_call_logs/i.test(s.text));
    // lead id appears both as the inserted column and inside the subquery's
    // where clause — if the latter were missing, numbering would be global.
    expect(insert.values.filter((v) => v === "lead-42").length).toBeGreaterThanOrEqual(2);
  });
});
