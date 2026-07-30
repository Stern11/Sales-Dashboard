// Shared Postgres (Neon) client for the Sales Pipeline module — the app's
// only persistent datastore. Every other module reads live from HubSpot;
// this is the one write-capable data source, so it deliberately gets its own
// error type (mirroring HubspotConfigError in lib/hubspot.js) rather than
// reusing HubSpot's.

import { neon } from "@neondatabase/serverless";

export class PipelineDbConfigError extends Error {}

let cachedSql = null;

/**
 * Returns a tagged-template SQL client (`sql\`select ... where id = ${id}\``)
 * backed by Neon's HTTP driver — no connection pool to manage, which suits
 * short-lived serverless function invocations. Parameters passed via the
 * tagged template are automatically parameterized by the driver (no manual
 * escaping needed, and no SQL injection risk from interpolated values).
 */
export function getSql() {
  if (cachedSql) return cachedSql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new PipelineDbConfigError(
      "DATABASE_URL environment variable is not set on this deployment. Provision a Neon database (Vercel → Storage → Marketplace → Neon), then run db/schema.sql against it."
    );
  }
  cachedSql = neon(url);
  return cachedSql;
}
