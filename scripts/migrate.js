#!/usr/bin/env node
// Applies whatever's missing in db/migrations/ (in filename order) to
// whichever DATABASE_URL is set — that's the whole point: the same command
// works against dev or prod, the only difference is which DATABASE_URL is
// in scope when it runs. A schema_migrations table tracks what's already
// applied, so this is always safe to re-run — nothing happens if a
// migration is already recorded, and every migration file is itself
// idempotent (IF NOT EXISTS guards) as a second layer of safety.
//
// Usage:
//   npm run migrate                              # dev — reads DATABASE_URL from .env.local
//   DATABASE_URL=<prod-url> npm run migrate       # prod — shell-exported var wins over .env.local
//                                                  # (Node's --env-file never overrides an
//                                                  # already-set process.env value)
//   node scripts/migrate.js --if-configured       # used by `npm run build` (see package.json) so
//                                                  # every Vercel deploy (prod and preview) applies
//                                                  # pending migrations automatically — a deploy
//                                                  # that shipped code expecting a table/column
//                                                  # nobody migrated in was exactly the bug this
//                                                  # closes. --if-configured only softens the
//                                                  # *missing* DATABASE_URL case (a bare checkout
//                                                  # with no DB set up yet, e.g. someone forking
//                                                  # this repo before running the app's own setup)
//                                                  # to a skip instead of a failed build; a real
//                                                  # connection or SQL error still fails the build
//                                                  # either way, which is the point — better to
//                                                  # block a deploy than ship one against a schema
//                                                  # that doesn't match.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "db", "migrations");

// Split on ";" — safe here because every statement in db/migrations/ is a
// plain DDL statement with no semicolons inside string/dollar-quoted
// literals. Each statement is a separate HTTP round-trip (the driver's
// query() method runs one statement at a time), so a migration isn't
// atomic end-to-end — that's why every individual statement is written to
// be independently safe to re-run (IF NOT EXISTS) rather than relying on
// all-or-nothing rollback. Exported for testing (test/scripts/migrate.test.js).
export function splitStatements(fileText) {
  return fileText
    .split(";")
    .map((s) => s.trim())
    .filter((s) => {
      // A chunk that's only a comment (e.g. an explanatory note trailing
      // the last real statement in a file) isn't a statement — sending it
      // to the DB as one would be a bogus, likely-erroring query.
      return s.replace(/--.*$/gm, "").trim().length > 0;
    });
}

async function run({ ifConfigured = false } = {}) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (ifConfigured) {
      console.log("DATABASE_URL not set — skipping migration (--if-configured).");
      return;
    }
    console.error(
      "DATABASE_URL is not set.\n" +
      "  Dev:  run `vercel env pull .env.local` first, then `npm run migrate`.\n" +
      "  Prod: `DATABASE_URL=<prod-connection-string> npm run migrate`."
    );
    process.exit(1);
  }
  const sql = neon(databaseUrl);

  await sql.query(`
    create table if not exists schema_migrations (
      filename   text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const appliedRows = await sql.query("select filename from schema_migrations");
  const applied = new Set(appliedRows.map((r) => r.filename));

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  const pending = files.filter((f) => !applied.has(f));

  if (!pending.length) {
    console.log(`Up to date — ${files.length} migration(s) already applied, nothing to do.`);
    return;
  }

  for (const file of pending) {
    console.log(`Applying ${file}...`);
    const text = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of splitStatements(text)) {
      await sql.query(statement);
    }
    await sql.query("insert into schema_migrations (filename) values ($1)", [file]);
    console.log(`  done.`);
  }

  console.log(`Applied ${pending.length} migration(s).`);
}

// Only auto-run when executed directly (`node scripts/migrate.js`), not
// when imported — test/scripts/migrate.test.js imports splitStatements()
// without wanting to trigger a real migration run as a side effect.
if (import.meta.url === `file://${process.argv[1]}`) {
  const ifConfigured = process.argv.includes("--if-configured");
  run({ ifConfigured }).catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
  });
}
