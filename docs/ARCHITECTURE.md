# Architecture

A modular, multi-module stakeholder dashboard backed by HubSpot. Every module
follows the same shape: a `lib/abm-segments`-style data manifest (if it needs
one) → an `api/` endpoint that fetches from HubSpot and shapes a response →
a `src/modules/<name>` page built from shared `src/components`.

## Stack

- **Frontend**: React + Vite, no server-side rendering. Client-side routing
  via `react-router-dom`.
- **Backend**: Vercel serverless functions (`api/**/*.js`), one file per
  route. No framework (Express, etc.) — each file exports a plain
  `(req, res) => {}` handler, per Vercel's convention.
- **Data**: HubSpot, fetched fresh on every request (no database, no
  scheduled sync). Responses are edge-cached 5 minutes
  (`s-maxage=300, stale-while-revalidate=60`) so concurrent viewers don't each
  trigger a fresh HubSpot call.
- **Styling**: plain CSS custom properties (`src/styles/tokens.css`) + one
  shared stylesheet (`src/styles/global.css`). No CSS-in-JS, no chart
  library — funnels and trends are plain divs positioned by percentage
  (`FunnelChart`, `TrendChart`), which is simple enough for this app's charts
  and keeps the dependency footprint small.

## Why `lib/` is not under `api/`

Vercel's zero-config Node.js builder treats **every** `.js` file under `api/`
as its own route. Shared code (the HubSpot client, ABM segment data
manifests) lives in a top-level `lib/` directory specifically so it's never
mistaken for a route. Only files that are meant to be hit as
`/api/<path>` belong inside `api/`.

```
api/
  segments.js          → GET /api/segments
  abm/index.js          → GET /api/abm?segment=<id>
  pipeline/index.js     → GET /api/pipeline?period=<weekly|monthly>
  sources/index.js      → GET /api/sources?period=<lifetime|monthly|weekly>

lib/
  hubspot.js             HubSpot API client: auth, batched/paged search,
                          associations, 429 backoff, scope-error detection
  respond.js              shared response helpers (cache headers, error mapping)
  dateBuckets.js          weekly/monthly trend bucketing (used by Pipeline)
  abm.js                  ABM shaping logic (buildAbmPayload) for api/abm/index.js
  abm-segments/
    index.js              registry of all ABM segments
    logistics.js           real data: 50 companies / 165 leads
    health-and-personal-care.js  real data: 35 companies / 270 leads
    cpg.js, fnb.js         stubs — empty until populated

src/
  main.jsx, App.jsx        entry + router + layout
  components/               shared UI, used by 2+ modules
    KpiRow, FunnelChart, TrendChart, DataTable, PeriodToggle, StatusPill,
    AsyncState, TopNav
  modules/
    abm/        AbmPage, LeadTable, useAbmData (includes useAllAbmData — see below)
    pipeline/   PipelinePage, DealsTable, usePipelineData
    sources/    SourcesPage, SourceLeadsTable, useSourcesData
  hooks/
    useApiData    generic {data, loading, error, refresh} fetch, cached +
                  stale-while-revalidate, 5min background poll
    useTheme      light/dark toggle, persisted to localStorage
  lib/
    apiCache.js    sessionStorage read/write used by useApiData (and
                  useAllAbmData) for the stale-while-revalidate cache
```

`DataTable` is the biggest reuse win: every table in the app (leads, deals,
lead-sources) is a `<DataTable columns rows rowKey searchKeys filters
defaultSort />` call — sorting, search, and filter-by-dropdown are
implemented once. `FunnelChart` and `PeriodToggle` are each used by three
different modules the same way. There's no separate accounts table — the
ABM module's lead list already has a company filter, so an account view is
just filtering the one table rather than a redundant second listing.

## Adding a new module

1. Backend: `api/<module>/index.js` — read query params, call `getToken()`
   from `lib/hubspot.js`, fetch/shape data, return it via
   `withHubspotErrorHandling` from `lib/respond.js` (this gets you the
   missing-token and missing-scope error handling for free).
2. Frontend: `src/modules/<module>/<Module>Page.jsx` + a
   `use<Module>Data.js` hook (one-liner around `useApiData`). Build the page
   from `KpiRow` / `FunnelChart` / `TrendChart` / `DataTable` — you shouldn't
   need new CSS or new chart code for a typical metrics-and-table module.
3. Register the route in `src/App.jsx` and add a nav entry in
   `src/components/TopNav.jsx`'s `MODULES` array.

## Adding a new ABM segment (e.g. CPG, F&B)

1. Copy `lib/abm-segments/cpg.js` to `lib/abm-segments/<name>.js`.
2. Fill in `leads` (contact IDs + company name + optional flag note) and
   `companies` (company IDs + name) — same shape as `logistics.js`.
3. Add the import to `lib/abm-segments/index.js`'s `SEGMENTS` array.

For step 2, if the segment is already curated as a HubSpot list (check
`crm/v3/lists/search`), pull it directly instead of hand-typing IDs — this is
how `health-and-personal-care.js` was built: fetch the list's membership
(`crm/v3/lists/{id}/memberships`), resolve each contact's
`associatedcompanyid` to a company name, and dedupe into the `companies`
array. No manual verification flags in that case (those on `logistics.js`
came from a one-time Apollo-enrichment QA pass, not something list membership
gives you) — that's fine, `flag` is optional per lead.

That's it — `api/segments.js` only lists segments with `leads.length > 0`, so
the new tab appears in the dashboard automatically once populated, and
disappears (no code change needed) if you ever want to hide one.

## HubSpot scopes required per module

| Module | Scopes | Status as of this build |
|---|---|---|
| ABM Outreach | `crm.objects.contacts.read`, `crm.objects.companies.read` | ✅ granted |
| ABM Calling funnel | `crm.objects.calls.read` (bundled with the contacts scope on this portal) | ✅ granted |
| Sales Pipeline | `crm.objects.deals.read` | ✅ granted |
| Lead Sources | `crm.objects.contacts.read` (meetings read is bundled with it on this portal) | ✅ granted — no new scope needed |

Add scopes in the HubSpot Private App UI; no redeploy is needed, the token is
read fresh on every request.

## Lead Sources — why it exists instead of a Marketing Campaigns module

`marketing.campaigns.read` isn't available on the current HubSpot plan (not
just ungranted — it wasn't selectable in the Private App scope picker), so a
real Campaigns-API-backed module isn't buildable today. Rather than leave a
permanently scope-blocked page, `api/sources/index.js` gets equivalent —
arguably more actionable — data from the contacts object, which the app
already has full access to:

- `hs_analytics_source_data_1` — the ad network/channel a contact came from
  (e.g. `"LinkedIn"`); falls back to `hs_analytics_source` (e.g.
  `PAID_SOCIAL`, `ORGANIC_SEARCH`) when not set.
- `hs_analytics_source_data_2` — the specific campaign/ad name. This is what
  stands in for "campaign" — there's no campaign object, but this field is
  populated per-contact and shown per-lead in the table.
- `lifecyclestage` — pulled live from `crm/v3/properties/contacts/lifecyclestage`
  (not hardcoded) so the funnel matches this portal's actual stages and order.
- Meetings — the Meetings CRM object is fetched directly (small: tens, not
  thousands, of records) and associated back to contacts, giving a real
  meetings-booked count per lead/channel instead of relying on the
  `engagements_last_meeting_booked` contact property, which is unpopulated on
  this portal.

If `marketing.campaigns.read` becomes available later, a proper
`api/campaigns/` module can be added alongside this one (see "Adding a new
module" above) rather than replacing it — Lead Sources answers "which channel
brought this lead," which Campaigns data doesn't fully replace anyway.

## Known, accepted risks

- **`react-router-dom@7.18.1`** (latest) has an open advisory for an
  "RSC Mode CSRF" issue. This app is plain client-side rendering — no React
  Server Components, no SSR — so the vulnerable code path isn't reachable.
  Re-check `npm audit` next time you upgrade dependencies.
- **Vite's dev server** has a known moderate advisory (any site can read
  responses from the local dev server). This only matters if the dev server
  is exposed beyond localhost, which it isn't in normal use (`vercel dev`
  binds to localhost).

## Demo Call / Meeting tracking

`meeting_done` on each ABM lead (and the "Demo Calls / Meetings" KPI) is
**not** derived from `linkedin_reachout_status === "Meeting Scheduled"` —
that only reflects the LinkedIn outreach sequence, not whether a demo
actually happened, and it's easy to conflate the two. The real signal is
`lifecyclestage` reaching the stage this portal has labeled **"Demo Call"**
(value `opportunity`) — `getLifecycleStages()` in `lib/abm.js` fetches the
live stage list/order so this doesn't depend on a hardcoded assumption about
stage order, and `meeting_done` is true once a lead's `lifecyclestage` index
is at or past that stage.

## Performance: caching and why there's no server-side "overview" endpoint

Two things make repeat loads fast without changing what data is fetched:

- **Client-side stale-while-revalidate.** `useApiData` (and ABM's
  `useAllAbmData`) cache each response in `sessionStorage` keyed by URL. On
  mount, cached data renders immediately — `loading` only means "nothing to
  show yet," not "a request is in flight" — while a fresh request happens in
  the background and silently updates the screen when it resolves. This is
  what makes a browser refresh feel instant instead of re-paying every
  HubSpot round-trip from zero.
- **The "Overall ABM Effort" totals are computed client-side**, not by a
  dedicated `/api/abm/overview` endpoint. An earlier version had one, and it
  rebuilt every segment's full data server-side on every request — which
  meant loading `/abm` fetched the *selected* segment's data twice (once for
  its own detail view, once again inside the overview's server-side loop).
  Now `useAllAbmData` fetches every active segment through the same
  `/api/abm?segment=<id>` endpoint in parallel, and the frontend sums them
  (`aggregateOverview` in `AbmPage.jsx`). One fetch per segment total, and
  since it's the same URL either way, switching the segment tab reuses
  whatever's already been fetched instead of triggering a new request.

Within `api/abm/index.js` itself, the contacts search and the
contacts→calls association lookup are independent of each other and now run
concurrently (`Promise.all`) rather than sequentially with a manual pause
between them — the pause was defensive throttling left over from when these
ran back-to-back; removing it and cutting the remaining inter-batch pacing
from 350ms to 150ms (`lib/hubspot.js`) is safe for the request volumes these
ID-batch lookups actually generate. This is a different situation from the
concurrent-pagination collision noted below for Lead Sources — that was two
*paginated* loops (many sequential requests each) racing each other; ABM's
segment fetches are a small, fixed number of batches, not pagination.

## Email funnel data source

There's no raw send-log for one-to-one sales emails available with this
token — the scopes for it (`crm.objects.emails.read` / `sales-email-read`)
aren't selectable on this HubSpot plan, and reading them properly needs a
connected mailbox, not just a scope toggle. `emailStageFor()` in `lib/abm.js`
is built from two signals that *are* available:

- `hs_sales_email_last_opened/clicked/replied` — set once the recipient acts
  on a tracked email.
- `notes_last_contacted` — HubSpot's generic "last contacted" rollup. It also
  gets bumped by the Sales Chrome/Outlook extension logging a sent email,
  confirmed against real data on 2026-07-30 (leads with a fresh
  `notes_last_contacted` timestamp and zero associated Calls, right after a
  real send through the extension).

Without the second signal, "sent but not yet opened" and "never contacted at
all" were indistinguishable — every lead with an email address landed in the
same "Sent, No Response" bucket regardless of whether anything had actually
been sent. The funnel now has six stages: No Email On File → **Not Yet
Contacted** → Sent, No Response → Opened → Clicked → Replied.

Caveat: `notes_last_contacted` is a general "sales activity" rollup, not
strictly email-specific — a logged call or meeting could in principle also
bump it. It's cross-checked against this app's own Calls data when
reasoning about it, but there's no hard guarantee at the HubSpot data level.
If a precise, unambiguous Sent signal becomes important, the cleanest fix is
a manual custom contact property (`email_reachout_status`) mirroring how
`linkedin_reachout_status` already works — `lib/abm.js` is the only file
that would need to change to prefer it when present.
