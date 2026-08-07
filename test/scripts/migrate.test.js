import { describe, it, expect } from "vitest";
import { splitStatements } from "../../scripts/migrate.js";

describe("splitStatements", () => {
  it("splits multiple statements on ;", () => {
    expect(splitStatements("create table a (id int);\ncreate table b (id int);"))
      .toEqual(["create table a (id int)", "create table b (id int)"]);
  });

  it("drops empty statements from trailing/blank semicolons", () => {
    expect(splitStatements("select 1;\n\n;\n")).toEqual(["select 1"]);
  });

  it("tolerates leading SQL comments attached to a statement", () => {
    const text = "-- a comment\ncreate table x (id int);";
    const stmts = splitStatements(text);
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toContain("create table x (id int)");
  });

  it("returns an empty array for a comment-only or empty file", () => {
    expect(splitStatements("-- just a comment, no statements\n")).toEqual([]);
    expect(splitStatements("")).toEqual([]);
  });
});
