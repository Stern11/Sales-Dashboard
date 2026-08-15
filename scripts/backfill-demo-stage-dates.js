#!/usr/bin/env node
// One-time backfill: fills in demo_call_leads.demo_stage_entered_at (see
// migration 0015) for every existing tracked lead that has a
// hubspot_contact_id but no stage-entered-at date on file yet — i.e. every
// lead that existed before this feature, which all have a null value there
// (new leads get it looked up automatically at creation time — see
// api/demo-calls/index.js's lookupStageEnteredAt).
//
// A manual, human-run script rather than an automatic migration or a lazy
// on-demand fetch, on purpose: it makes N HubSpot API calls (one contact
// property-history fetch per lead), which is a meaningfully different kind
// of cost and failure mode than a plain SQL migration, and isn't something
// that should silently run as a side effect of a deploy.
//
// Usage:
//   npm run backfill:demo-stage-dates                      # dev — .env.local
//   DATABASE_URL=<prod-url> HUBSPOT_TOKEN=<prod-token> \
//     node scripts/backfill-demo-stage-dates.js             # prod
//
// Safe to re-run: only leads with demo_stage_entered_at still null are
// considered, so an interrupted run just picks up where it left off. A lead
// HubSpot has no matching history for (see fetchStageEnteredAt's docblock)
// stays null and is retried on every run — there's no way to distinguish
// "looked and found nothing" from "haven't looked yet" without a second
// column, which isn't worth adding for a script meant to be run once or
// twice, not on a schedule.

import { neon } from "@neondatabase/serverless";
import { getLifecycleStages } from "../lib/abm.js";
import { fetchStageEnteredAt } from "../lib/demo-calls/hubspotStageHistory.js";
import { sleep } from "../lib/hubspot.js";

const DEMO_STAGE_VALUE = "opportunity";
const PACE_MS = 350; // matches lib/hubspot.js's existing inter-request pacing

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Run `vercel env pull .env.local` first, or export it for prod.");
    process.exit(1);
  }
  const hubspotToken = process.env.HUBSPOT_TOKEN;
  if (!hubspotToken) {
    console.error("HUBSPOT_TOKEN is not set.");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const leads = await sql`
    select id, company_name, hubspot_contact_id
    from demo_call_leads
    where hubspot_contact_id is not null and demo_stage_entered_at is null
    order by created_at asc
  `;

  if (!leads.length) {
    console.log("Nothing to backfill — every tracked lead with a hubspot_contact_id already has a date.");
    return;
  }
  console.log(`Backfilling ${leads.length} lead(s)...`);

  const stages = await getLifecycleStages(hubspotToken);

  let updated = 0;
  let notFound = 0;
  let failed = 0;

  for (const [i, lead] of leads.entries()) {
    try {
      const enteredAt = await fetchStageEnteredAt(hubspotToken, lead.hubspot_contact_id, stages, DEMO_STAGE_VALUE);
      if (enteredAt) {
        await sql`update demo_call_leads set demo_stage_entered_at = ${enteredAt} where id = ${lead.id}`;
        updated += 1;
        console.log(`  [${i + 1}/${leads.length}] ${lead.company_name}: ${enteredAt}`);
      } else {
        notFound += 1;
        console.log(`  [${i + 1}/${leads.length}] ${lead.company_name}: no stage history on file — left as-is (falls back to created_at)`);
      }
    } catch (err) {
      failed += 1;
      console.error(`  [${i + 1}/${leads.length}] ${lead.company_name}: lookup failed — ${err.message}`);
    }
    if (i < leads.length - 1) await sleep(PACE_MS);
  }

  console.log(`Done. Updated ${updated}, no history found for ${notFound}, failed ${failed}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error("Backfill failed:", err.message);
    process.exit(1);
  });
}

export { run };
