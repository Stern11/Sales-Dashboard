# Stakeholder Dashboard

A live, HubSpot-backed dashboard with three modules:

- **ABM Outreach** — target accounts and leads by segment (Logistics live
  today; CPG/F&B ready to populate), with LinkedIn, Calling, and Email
  funnels.
- **Sales Pipeline** — open pipeline by stage, new-deals and closed-won
  trends (weekly/monthly), full deal list.
- **Lead Sources** — leads and meetings by channel (LinkedIn Ads, Paid
  Search, Organic, Offline, ...), with a lifecycle-stage funnel splittable by
  channel (lifetime/monthly/weekly). Stands in for a Marketing Campaigns
  module, which isn't buildable on the current HubSpot plan — see
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#lead-sources--why-it-exists-instead-of-a-marketing-campaigns-module).

No login — anyone with the URL can view it. Every request fetches fresh from
HubSpot (5-minute edge cache), so it's always current.

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
| `HUBSPOT_TOKEN` | every module | HubSpot → Settings → Integrations → Private Apps → your app → Auth → Access token |

Set it in Vercel → Project → Settings → Environment Variables (scoped to
whichever of Production/Preview/Development you need), then for local dev run
`vercel env pull .env.local` to sync it down.

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
