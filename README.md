# Stakeholder Dashboard

A live, HubSpot-backed dashboard with three modules:

- **ABM Outreach** — target accounts and leads by segment (Logistics and
  Health and Personal Care live today; CPG/F&B ready to populate), with
  LinkedIn, Calling, and Email funnels, plus Demo Call/meeting tracking.
- **Sales Pipeline** — a database-backed lead tracker (SQL → Discovery →
  Proposal → Commercial → Won, with Cold/Lost as side-branches from any
  active stage). Leads are added manually or copied in from the ABM or
  Performance Marketing tables ("Add to pipeline") with company/deal/notes
  fields HubSpot doesn't track. This is the app's only persistent datastore
  (Postgres via Neon) — everything else is still a live, read-only HubSpot
  view.
- **Performance Marketing** — LinkedIn Ads leads, meetings booked, and a
  lifecycle-stage funnel scoped to that channel (lifetime/monthly/weekly).
  Ad spend and live-campaign count are wired up but scope-blocked on the
  current HubSpot plan — see
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#performance-marketing--two-independently-gated-data-sources).

No login — anyone with the URL can view it, and (as of the Sales Pipeline
module) edit pipeline leads. Edits are attributed by a lightweight name tag
stored in the browser, not real authentication. Every other module fetches
fresh from HubSpot on each request (5-minute edge cache), so it's always
current.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the codebase is
organized, and how to add a new module or ABM segment.

## Local development

```
npm install
vercel dev
```

Open the printed URL (default `http://localhost:3000`). `vercel dev` runs the
Vite frontend and the `api/` serverless functions together — always use this,
not `npm run dev` (which only starts Vite, with no working `/api/*` routes).

## Environment variables

| Variable | Required for | How to get it |
|---|---|---|
| `HUBSPOT_TOKEN` | ABM, Marketing, and "Add to pipeline" origin lookups | HubSpot → Settings → Integrations → Private Apps → your app → Auth → Access token |
| `DATABASE_URL` | Sales Pipeline (the only module with a database) | Vercel → Project → Storage → Marketplace → Neon → create a database; the connection string is added to your project's env vars automatically |

Set variables in Vercel → Project → Settings → Environment Variables (scoped
to whichever of Production/Preview/Development you need), then for local dev
run `vercel env pull .env.local` to sync them down.

### Setting up the Sales Pipeline database

1. In the Vercel dashboard: Project → Storage → Marketplace → **Neon** → create
   a database and connect it to this project (this sets `DATABASE_URL`).
2. Run `db/schema.sql` against it once — either paste it into the Neon SQL
   editor, or `psql "$DATABASE_URL" -f db/schema.sql` locally after
   `vercel env pull .env.local`.
3. No migration framework is used — schema changes are applied by hand and
   `db/schema.sql` is kept as the source of truth.

### Dev vs. production data — use a separate Neon branch

`DATABASE_URL` is a real, writable Postgres database — unlike the read-only
HubSpot modules, whatever's in it (test leads, deletions) is exactly what
shows up on the dashboard. Don't develop/test directly against the same
database production users see. Recommended setup, using Neon's branching
(cheap, instant, built for exactly this):

1. In the Neon console, create a **`development`** branch off your main/
   production branch.
2. In Vercel → Project → Settings → Environment Variables, set `DATABASE_URL`
   to a **different value per environment**: the production branch's
   connection string for **Production**, and the development branch's for
   **Preview** and **Development**.
3. `vercel env pull .env.local` (used for local `vercel dev`) pulls the
   Development value by default — so local work and PR previews always hit
   the dev branch, never production.
4. Apply schema changes (`db/schema.sql`) to the dev branch first, verify,
   then apply the same change to the production branch before/at deploy time.

Without this split, there's only one database — fine to get started, but
clean up any test leads (`select company_name from pipeline_leads;`) before
relying on it as production data.

### HubSpot scopes

The Private App needs different scopes per module — see the table in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#hubspot-scopes-required-per-module)
for the current list and status. Scopes can be added any time in the HubSpot
UI; no redeploy needed.

## Deploying

This is a standard Vite + Vercel Serverless Functions project — connect the
repo in Vercel (or run `vercel --prod` from this folder) and it builds and
deploys as-is. Make sure `HUBSPOT_TOKEN` is set on the target environment
first (see above).
