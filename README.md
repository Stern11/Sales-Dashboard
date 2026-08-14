# Stakeholder Dashboard

A live, HubSpot-backed dashboard, behind Google sign-in restricted to
@heizen.work accounts. Six modules:

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
- **Overview** — the app's landing page: pipeline and meeting KPIs plus a
  monthly trend table, aggregated across the database-backed modules.
- **Account Expansion** — account planning for existing clients (expansion
  areas, whitespace, research signals, stakeholders, open questions), as
  opposed to ABM's prospects. Database-backed, with a portfolio list and a
  per-account detail page.
- **Demo Calls** — a database-backed tracker for what happens after a lead
  reaches HubSpot's "Demo Call" stage: first/second/third+ call log entries
  (date, outcome incl. no-show, notes, next steps, transcript link), an
  irrelevant/reactivate side state, and an "Add to pipeline" handoff.
  Contacts who've reached that stage in ABM or Performance Marketing show up
  automatically as "not yet logged"; leads can also be added by hand. See
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#demo-calls-data-model).

**Access** — sign-in is Google, restricted to `@heizen.work` Workspace
accounts. Every `/api/*` route is gated by Edge Middleware (`middleware.js`)
that checks a signed session cookie, and every write is attributed to the
signed-in account server-side — the client can't choose who an edit is
recorded as. The database-backed modules are the only writable ones; every
other module fetches fresh from HubSpot on each request (5-minute edge
cache), so it's always current.

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

Before pushing:

```
npm test      # vitest, no database or network needed
npm run lint  # eslint, incl. react-hooks rules
```

Both also run in CI (`.github/workflows/ci.yml`) on every push and pull
request. They are deliberately *not* part of `npm run build`, which Vercel
runs on deploy — so CI is what stands between a broken commit and
production, given that a push to `main` deploys automatically.

## Environment variables

| Variable | Required for | How to get it |
|---|---|---|
| `HUBSPOT_TOKEN` | ABM, Marketing, and "Add to pipeline" origin lookups | HubSpot → Settings → Integrations → Private Apps → your app → Auth → Access token |
| `DATABASE_URL` | Sales Pipeline and Demo Calls (the two database-backed modules) | Vercel → Project → Storage → Marketplace → Neon → create a database; the connection string is added to your project's env vars automatically |
| `SESSION_SECRET` | **Required.** Signing the session cookie — without it every `/api/*` request is rejected and nobody can sign in | Any long random string, e.g. `openssl rand -base64 32`. Set it once per environment; changing it signs everyone out. |
| `VITE_GOOGLE_CLIENT_ID` | **Required.** Google sign-in, on both the button and the server-side token check | Google Cloud console → APIs & Services → Credentials → OAuth 2.0 Client ID (Web application). Add your deployment origins to Authorized JavaScript origins. Despite the `VITE_` prefix this is read server-side too; an OAuth client id is public by design. |
| `APP_ORIGIN` | Optional — the origin used for the "View the lead" link in tag notification emails | e.g. `https://dashboard.heizen.work`. Falls back to Vercel's own `VERCEL_PROJECT_PRODUCTION_URL`; if neither is set the email omits the link rather than guessing from the request. |
| `RESEND_API_KEY` | "You were tagged" emails when someone is @-mentioned in a pipeline note | resend.com → sign up → API Keys → create one (Sending access is enough) |
| `EMAIL_FROM` | Optional — the "from" address for tag notifications | A verified sender on a domain you've added under resend.com → Domains (e.g. `Sales Pipeline <pipeline@heizen.work>`). Until a domain is verified, falls back to Resend's sandbox sender, which only delivers to the Resend account's own email. |

Set variables in Vercel → Project → Settings → Environment Variables (scoped
to whichever of Production/Preview/Development you need), then for local dev
run `vercel env pull .env.local` to sync them down.

### Setting up the database (Sales Pipeline + Demo Calls)

1. In the Vercel dashboard: Project → Storage → Marketplace → **Neon** → create
   a database and connect it to this project (this sets `DATABASE_URL`).
2. `vercel env pull .env.local`, then `npm run migrate` — applies every file
   in `db/migrations/` in order. Safe to re-run any time; already-applied
   migrations are tracked in a `schema_migrations` table and skipped.
3. Adding a schema change later: add a new numbered file to
   `db/migrations/` (never edit an already-applied one) and run `npm run
   migrate` locally against dev to verify it. You don't need to run it
   against production yourself — `npm run build` runs `node scripts/migrate.js
   --if-configured` before `vite build` (see `package.json`), and Vercel
   invokes that build command on every deploy with that deployment's own
   `DATABASE_URL` already in scope, so pending migrations apply
   automatically as part of shipping the code that needs them. `--if-configured`
   only softens a *missing* `DATABASE_URL` (e.g. a fresh clone with no DB set
   up yet) to a skip — a real connection or SQL error still fails the build,
   which is the point: better to block a broken deploy than ship code
   against a schema nobody migrated. See `db/schema.sql` for a
   human-readable snapshot of the full current schema (not run directly —
   `db/migrations/` is the source of truth).

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
4. Apply schema changes (`npm run migrate`) to the dev branch first and
   verify — production applies automatically on deploy, see "Setting up the
   database (Sales Pipeline + Demo Calls)" above.

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
