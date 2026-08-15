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
- **Data**: HubSpot, fetched fresh on every request (no scheduled sync).
  Responses are edge-cached 5 minutes (`s-maxage=300,
  stale-while-revalidate=60`) so concurrent viewers don't each trigger a
  fresh HubSpot call. The **Sales Pipeline module is the one exception** — it
  is backed by a real Postgres database (Neon), the app's only persistent,
  writable datastore; its responses are `Cache-Control: no-store` since it's
  mutable operational data, not a HubSpot mirror. See "Sales Pipeline data
  model" below.
- **Styling**: plain CSS custom properties (`src/styles/tokens.css`) + two
  stylesheets — `src/styles/global.css` (everything pre-dating Sales
  Pipeline) and `src/styles/pipeline.css` (kanban board, modal/drawer,
  forms — new, large enough surface area to warrant its own file). No
  CSS-in-JS. Funnels are plain divs positioned by percentage (`FunnelChart`),
  which is simple enough for this app's charts and keeps the dependency
  footprint small.

## Why `lib/` is not under `api/`

Vercel's zero-config Node.js builder treats **every** `.js` file under `api/`
as its own route. Shared code (the HubSpot client, ABM segment data
manifests) lives in a top-level `lib/` directory specifically so it's never
mistaken for a route. Only files that are meant to be hit as
`/api/<path>` belong inside `api/`.

```
api/
  segments.js             → GET /api/segments
  abm/index.js             → GET /api/abm?segment=<id>
  sources/index.js         → GET /api/sources?period=<lifetime|monthly|weekly|custom>[&from=][&to=] (channel attribution, all channels — Performance Marketing filters to LinkedIn)
  marketing/spend.js       → GET /api/marketing/spend (ad spend + live campaign count — scope-blocked, see below)
  pipeline/index.js        → GET/POST /api/pipeline (list+summary / create) — database-backed, not HubSpot
  pipeline/[id]/index.js   → GET/PATCH/DELETE /api/pipeline/:id (detail / edit fields / delete),
                             plus POST ?action=stage (stage change, incl. cold/lost/revive)
                             and POST ?action=notes (append a note) — same ?action=
                             consolidation as demo-calls below, for the same function-cap reason
  pipeline/check.js        → POST /api/pipeline/check (bulk "already in pipeline" lookup;
                             POST, not GET, because the id list can be thousands long)
  account-expansion/index.js → GET/POST/PATCH/DELETE /api/account-expansion (portfolio list,
                             per-account detail, and every child collection — areas,
                             whitespace, signals, stakeholders, questions — multiplexed on
                             ?action= and ?item_id=; see the file header for the full table)
  auth/index.js            → GET /api/auth (session status), POST /api/auth?action=login|logout
  demo-calls/index.js  → GET/POST /api/demo-calls (list+summary / create — database-backed;
                         also GET ?pipeline_lead_id=... reverse lookup and GET
                         ?action=hubspot-engagements&contact_id=... — the one HubSpot read
                         this module does, for the "Import from HubSpot" panel)
  demo-calls/[id].js  → GET/PATCH/DELETE /api/demo-calls/:id (detail+calls / edit fields /
                         delete), plus POST/PATCH ?action=calls|status|link-pipeline —
                         consolidated into these two files (not one file per route) to stay
                         within Vercel Hobby's 12-serverless-function-per-deployment cap; see
                         each file's own header comment for the full route table

lib/
  hubspot.js              HubSpot API client: auth, batched/paged search,
                          associations, 429 backoff, scope-error detection
  respond.js              shared response helpers (cache headers, error mapping) — HubSpot modules only
  db.js                   Neon (Postgres) client getter, shared by the Sales Pipeline and Demo Calls modules
  abm.js                  ABM shaping logic (buildAbmPayload) for api/abm/index.js
  abm-segments/
    index.js              registry of all ABM segments
    logistics.js           real data: 50 companies / 165 leads
    health-and-personal-care.js  real data: 35 companies / 270 leads
    cpg.js, fnb.js         stubs — empty until populated
  pipeline/
    constants.js            stage/scale/source vocabulary
    queries.js               all SQL for the pipeline_leads/notes/stage_history tables
    respond.js                DB error → HTTP status mapping (mirrors lib/respond.js)
  demo-calls/
    constants.js            outcome/status vocabulary
    queries.js               all SQL for the demo_call_leads/demo_call_logs tables
    respond.js                DB error → HTTP status mapping (mirrors lib/pipeline/respond.js)

db/
  schema.sql              human-readable snapshot of the full Postgres schema (not run directly)
  migrations/              numbered, idempotent .sql files — the actual source of truth, applied via `npm run migrate`

src/
  main.jsx, App.jsx        entry + router + layout (App.jsx also mounts NameTagProvider)
  components/               shared UI, used by 2+ modules
    KpiRow, FunnelChart, DataTable, PeriodToggle, StatusPill, AsyncState,
    Sidebar, Overlay, Modal, Drawer, LoginPage, DataTable, AsyncState
  modules/
    abm/        AbmPage, LeadTable, useAbmData (includes useAllAbmData — see below)
    pipeline/   PipelinePage, KanbanBoard/Column, LeadCard, PipelineTable,
                LeadDetailDrawer, LeadFieldsForm, AddLeadModal,
                StageChangeModal, NotesTimeline, usePipelineData,
                usePipelineMutations, constants.js
    marketing/  MarketingPage, AdLeadsTable, useMarketingData (Performance Marketing)
    demo-calls/ DemoCallsPage, DemoCallsTable, DemoCallLeadDrawer,
                CallLogTimeline, AddDemoCallLeadModal, MarkIrrelevantModal,
                DeleteDemoCallLeadModal, useDemoCallsData,
                useDemoCallsMutations, useLiveDemoCallContacts, constants.js
  hooks/
    useApiData      generic {data, loading, error, refresh} fetch, cached +
                    stale-while-revalidate, 5min background poll — read-only.
                    Keeps one shared record per URL, so several components
                    asking for the same data share one request and one poll,
                    and polling pauses while the tab is hidden.
    useApiMutation  generic {mutate, loading, error} POST/PATCH wrapper — the
                    app's mutation primitive, used by the pipeline and demo-calls modules
    useTheme        light/dark toggle, persisted to localStorage
    useSidebar      sidebar collapse state, persisted to localStorage
  context/
    AuthContext.jsx     session status from GET /api/auth; nothing that reads
                        real data mounts until it reports authenticated
    NameTagContext.jsx  ensureName() display-name accessor, sourced from
                        AuthContext — kept as its own context so the ~15 call
                        sites that predate login didn't have to change
  lib/
    apiCache.js             sessionStorage read/write used by useApiData (and
                            useAllAbmData) for the stale-while-revalidate cache
    pipelineIntegration.js   the one cross-module seam — usePipelineCheck +
                            prefill helpers used by AbmPage/MarketingPage's
                            and DemoCallLeadDrawer's "Add to pipeline" action
```

`DataTable` is the biggest reuse win: every table in the app (leads, deals,
lead-sources) is a `<DataTable columns rows rowKey searchKeys filters
defaultSort />` call — sorting, search, and filter-by-dropdown are
implemented once. `FunnelChart` and `PeriodToggle` are each used by three
different modules the same way. There's no separate accounts table — the
ABM module's lead list already has a company filter, so an account view is
just filtering the one table rather than a redundant second listing.

## Adding a new module

For a typical **read-only HubSpot** module:

1. Backend: `api/<module>/index.js` — read query params, call `getToken()`
   from `lib/hubspot.js`, fetch/shape data, return it via
   `withHubspotErrorHandling` from `lib/respond.js` (this gets you the
   missing-token and missing-scope error handling for free).
2. Frontend: `src/modules/<module>/<Module>Page.jsx` + a
   `use<Module>Data.js` hook (one-liner around `useApiData`). Build the page
   from `KpiRow` / `FunnelChart` / `DataTable` — you shouldn't need new CSS
   or new chart code for a typical metrics-and-table module.
3. Register the route in `src/App.jsx` and add a nav entry in
   `src/components/Sidebar.jsx`'s `MODULES` array.

For a **database-backed, writable** module (Sales Pipeline and Demo Calls
are the two so far), follow the pattern in `lib/pipeline/` + `api/pipeline/**`
(or `lib/demo-calls/` + `api/demo-calls/**`) instead: SQL lives in
`lib/<module>/queries.js` behind `lib/db.js`'s `getSql()`, errors map through
`lib/<module>/respond.js` (`withDbErrorHandling`, mirrors
`withHubspotErrorHandling`), responses are `Cache-Control: no-store`, and
mutations on the frontend go through `useApiMutation` rather than
`useApiData`. Add a new numbered file to `db/migrations/` for any schema
change (never edit an already-applied one), then update `db/schema.sql`'s
snapshot to match. `npm run build` (and so every Vercel deploy) runs pending
migrations against that deployment's own `DATABASE_URL` before building —
see README.md's "Setting up the database" section — so shipping a schema
change and shipping the code that needs it happen together, not as two
separate manual steps.

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
| Performance Marketing — leads/funnel | `crm.objects.contacts.read` (meetings read is bundled with it on this portal) | ✅ granted — no new scope needed |
| Performance Marketing — ad spend / live campaigns | `marketing.campaigns.read` | ❌ not available on current plan |

Sales Pipeline and Demo Calls don't read from HubSpot at all on the backend
(see below) — they need no HubSpot scope, only `DATABASE_URL`. Demo Calls'
frontend does read live ABM/Marketing data client-side to detect who's
reached the Demo Call stage, so it's still gated on those modules' scopes.

Add scopes in the HubSpot Private App UI; no redeploy is needed, the token is
read fresh on every request.

## Sales Pipeline data model

Unlike every other module, Sales Pipeline (`/pipeline`) is not a HubSpot
view — it's a database-backed lead tracker with its own write path, added
because tracking a deal through SQL → Discovery → Proposal → Commercial →
Won (with Cold/Lost as side-branches at any active stage) needs fields
HubSpot doesn't have (deal size, company scale, supply-chain flag, project
description) and an editable "next steps" notes timeline. It replaced an
earlier version of this page that was a read-only view of live HubSpot
deals — that concept didn't match how deals are actually tracked here and
was dropped, not extended.

- **Schema**: `db/migrations/` (see `db/schema.sql` for a readable snapshot) — three tables. `pipeline_leads` (one row per
  lead, current `stage` + a denormalized `prior_active_stage` for reviving
  from Cold/Lost), `pipeline_lead_notes` (append-only — a separate table
  rather than a JSONB array specifically so two people adding a note at once
  can't race and drop one — see the file's comments), `pipeline_lead_stage_history`
  (one row per stage transition, written by the same code path that updates
  `pipeline_leads.stage` so it's never bypassed — powers future
  time-in-stage/conversion reporting, not just the live counts).
- **Access**: `lib/db.js` (`getSql()`, Neon's HTTP driver — no connection
  pool to manage, suits short-lived serverless calls) → `lib/pipeline/queries.js`
  (all SQL) → `api/pipeline/**` route handlers. `source`/`company_scale` are
  free text validated in `lib/pipeline/constants.js`, not DB enums, so adding
  a new option is a one-file change; `stage` values ARE a DB `CHECK`
  constraint since the cold/lost branching logic depends on the vocabulary
  being fixed.
- **Adding a lead from ABM/Marketing**: "Add to pipeline" in `LeadTable.jsx`/
  `AdLeadsTable.jsx` is a **snapshot copy**, not a move — the source lead
  stays in its original table. `src/lib/pipelineIntegration.js` is the one
  place ABM/Marketing code touches pipeline data (a bulk `hubspot_contact_id`
  check, so an already-added lead shows an "In Pipeline" badge instead of a
  duplicate-add button).
- **Attribution comes from the session, not the client**: the app is behind
  Google sign-in restricted to `@heizen.work` (`api/auth/index.js`,
  `middleware.js`). Writes record the signed-in account, resolved
  server-side by `requireActor()` in `lib/auth/actor.js` — the request body
  has no say in who an edit is recorded as. `NameTagContext` still exists as
  the display-name accessor, but it now reads from `AuthContext` rather than
  from a name typed into `localStorage`.
- **Hard delete exists, gated by a server-enforced confirmation**: `DELETE
  /api/pipeline/:id` requires `confirm_company_name` to exactly match the
  lead's current company name (checked server-side, not just in the UI) —
  see `DeleteLeadModal.jsx`. There's still no soft-delete/trash — once
  confirmed, the row and its notes/stage history (cascade) are gone for
  good. This is the one place in the module where a mistake genuinely can't
  be undone; the type-to-confirm step is the only safeguard, given there's
  no real access control.

## Demo Calls data model

Demo Calls (`/demo-calls`) tracks what happens *after* a lead reaches
HubSpot's Demo Call lifecycle stage (see "Demo Call / Meeting tracking"
below) — first/second/third+ call log entries, a no-show outcome, next
steps, a transcript link, and a handoff into Sales Pipeline. It's
database-backed like Sales Pipeline, but the backend never touches HubSpot
itself: detecting *who's* reached Demo Call happens live, client-side, by
reusing the same data ABM (`useAllAbmData`) and Performance Marketing
(`useAdLeadsData("lifetime")`) already fetch (`useLiveDemoCallContacts.js`)
— no new HubSpot scope, no polling/webhook infrastructure, consistent with
the rest of the app having no scheduled sync.

- **Schema**: `db/migrations/0005_add_demo_calls.sql` + `0006_..._fk_set_null.sql`
  — two tables. `demo_call_leads` (one row per tracked lead — `status`
  active/irrelevant, optional `hubspot_contact_id`/`hubspot_origin_module`,
  and `pipeline_lead_id` once handed off — `on delete set null` so deleting
  the Pipeline lead un-links rather than failing outright), `demo_call_logs`
  (one row per call attempt — `call_number` 1/2/3/..., `outcome`
  completed/no_show, notes/next_steps/transcript_url — open-ended rather
  than a fixed 3-slot form, and **editable** after creation, unlike
  Pipeline's append-only notes, since a call's fields legitimately fill in
  incrementally).
- **No DB row on read**: a live HubSpot contact newly at Demo Call with no
  tracked row yet is rendered as a "virtual" row (`DemoCallsTable.jsx`,
  `_kind: "virtual"`) prompting "Log first call" — nothing is persisted
  until a rep actually clicks it. This keeps `GET /api/demo-calls`
  side-effect free and avoids the DB filling with rows nobody looks at.
  `createLead()` (`lib/demo-calls/queries.js`) accepts an optional
  `first_call` payload so "create the lead" and "log its first call" are one
  request/transaction, not two.
- **Funnel/KPIs are a live aggregate, not a stored counter**: `listLeads()`
  joins each lead against a `lateral` subquery over `demo_call_logs` (call
  count, no-show count, most recent call) computed in one round trip; the
  funnel (Call 1/2/3 done, no-shows, added to pipeline, irrelevant) is
  derived from that in `summarize()` — mirrored client-side in
  `summarizeLeads()` (`src/modules/demo-calls/constants.js`) the same way
  Pipeline's `summarize()`/`summarizeLeads()` pair works.
- **"Add to pipeline"**: `demoCallLeadToPipelinePrefill()`
  (`src/lib/pipelineIntegration.js`) is the same snapshot-copy pattern as
  ABM/Marketing's bridge (`source: "Demo Call"`, `source_locked: true`), but
  the frontend also calls `POST /api/demo-calls/:id?action=link-pipeline`
  afterward to record `pipeline_lead_id` back on the Demo Calls row — this
  works even for manually-entered leads with no `hubspot_contact_id`, since
  the link is keyed by the Demo Calls row id, not a HubSpot id.
- **Attribution/delete**: same honor-system `NameTagContext` attribution and
  type-to-confirm hard delete as Sales Pipeline (`DeleteDemoCallLeadModal.jsx`).
- **Importing call history from HubSpot**: `ImportFromHubspotPanel.jsx`
  (shown in `AddDemoCallLeadModal.jsx` for a "Log first call" open, and in
  `DemoCallLeadDrawer.jsx` above the call log for an already-tracked lead)
  lets a rep pull HubSpot's own record of a contact into the call log
  instead of typing it from scratch — built for backfilling calls that
  happened before this tracker existed. It reads only HubSpot **Meetings**
  and **Notes** (`lib/demo-calls/hubspotEngagements.js`, surfaced via `GET
  /api/demo-calls?action=hubspot-engagements&contact_id=<id>` — the one
  HubSpot read this otherwise DB-only module does). **HubSpot Calls are
  deliberately never fetched**: that object records SDR cold-calling
  activity (dialing a lead), a different thing from a Demo Call in this
  app (the team meeting the lead live, e.g. Google Meet) — importing a
  Call as a demo-call log entry would be wrong, not just noisy. It also
  never pre-fills an outcome as "Completed": HubSpot's
  `hs_meeting_outcome` is frequently left unset by reps, so its absence
  proves nothing — every imported row's outcome starts unset (the
  `NO_SHOW` value, when HubSpot does have it, is shown as a badge hint,
  never auto-applied) and a rep must explicitly confirm it before the row
  can be imported. Selected rows are written through the exact same
  `createLead`/`addCall` mutations manual entry uses, sequentially (not
  parallel — `addCall` derives `call_number` from the current row count).
  No new HubSpot scope was needed — Meetings read is already granted, same
  scope Performance Marketing's meeting-count column already relies on
  (see the scopes table above); Notes degrades to `notes_available: false`
  if `crm.objects.notes.read` isn't granted, rather than failing the
  fetch.

## Performance Marketing — two independently-gated data sources

The page combines two things that come from very different places, and
deliberately doesn't let one block the other:

**Leads, meetings, lifecycle funnel** (`api/sources/index.js`, filtered to
the LinkedIn channel by `MarketingPage.jsx`) — built from the contacts
object, which the app already has full access to:

- `hs_analytics_source_data_1` — the ad network/channel a contact came from
  (e.g. `"LinkedIn"`); falls back to `hs_analytics_source` (e.g.
  `PAID_SOCIAL`, `ORGANIC_SEARCH`) when not set.
- `hs_analytics_source_data_2` — the specific campaign/ad name. This is what
  stands in for "campaign" in the leads table — there's no campaign object,
  but this field is populated per-contact.
- `lifecyclestage` — pulled live from `crm/v3/properties/contacts/lifecyclestage`
  (not hardcoded) so the funnel matches this portal's actual stages and order.
- Meetings — the Meetings CRM object is fetched directly (small: tens, not
  thousands, of records) and associated back to contacts, giving a real
  meetings-booked count per lead instead of relying on the
  `engagements_last_meeting_booked` contact property, which is unpopulated on
  this portal.

**Ad spend / live campaign count** (`api/marketing/spend.js`) — needs
`marketing.campaigns.read`, confirmed not selectable on the current HubSpot
plan (same scope, same result, as when this was checked for a full Marketing
Campaigns module — see below). There's no separate standalone "Ads API" to
fall back on: HubSpot's own community docs confirm ad spend/budget only
surfaces via a Campaign's budget-items once an ad account is synced onto it,
so this is gated on the exact same scope as Campaigns. Two ways to unblock
it: get `marketing.campaigns.read` granted (a HubSpot plan question), or
build a direct LinkedIn Ads (Campaign Manager) API integration instead — a
separate OAuth app + credentials, not a scope toggle on the existing token.
`api/marketing/spend.js` is wired up to start working the moment the first
option lands; the second would replace it with a new client rather than
extend it.

If `marketing.campaigns.read` becomes available later, a fuller Campaigns
module can be added alongside Performance Marketing (see "Adding a new
module" above) — channel-attribution data from contacts and true
per-campaign data from the Campaigns API answer different questions and
don't need to replace each other.

## Authentication

Google Sign-In, restricted to `@heizen.work`. Three pieces:

- **`api/auth/index.js`** issues and clears the session. It verifies the
  Google ID token server-side via `google-auth-library` (signature, audience,
  issuer), then requires *both* `email_verified` and an `hd` claim matching
  the allowed domain. `hd` is the claim that actually proves a Workspace
  account — an email suffix alone can belong to a consumer account — so the
  suffix check is a second gate, not the only one.

- **`middleware.js`** (Edge Middleware, not a serverless function, so it
  doesn't count against the 12-function cap) gates every `/api/*` request on
  the signed cookie and re-checks the domain rule on each one. The cookie
  lasts 30 days and there is no server-side session store to revoke against,
  so re-checking is what makes losing access take effect before the cookie
  expires. `/api/auth` is exempt by path, matched on the segment so a future
  `/api/authz` can't inherit the exemption.

- **`lib/auth/actor.js`** answers "who is making this write". Handlers call
  `requireActor(req)`, which re-verifies the same cookie, rather than reading
  an `actor` field from the request body — attribution the client can choose
  isn't attribution. Verifying twice per request is deliberate: it costs one
  HMAC over ~100 bytes and means the audit trail holds even if the middleware
  is ever misconfigured.

The session cookie is HMAC-SHA256 over a JSON payload, implemented with Web
Crypto (`lib/auth/session.js`) because that's the one API available in both
the Edge and Node runtimes. `SESSION_SECRET` is required; `verifySession`
returns null without it rather than throwing.

## Known, accepted risks

- ~~`react-router-dom@7.18.1` "RSC Mode CSRF" advisory~~ — **resolved**.
  Fixed in 7.18.2, a patch bump, applied via `npm audit fix`. (The
  reasoning that the path was unreachable here still held, but there was no
  longer any cost to taking the fix.)
- **Vite's dev server** has a known moderate advisory (clearing it requires
  vite@8, a major upgrade, and is worth doing deliberately rather than as a
  side effect) (any site can read
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
- **One request per URL, not per component.** `useApiData` keeps a shared
  record per URL, so several components asking for the same data share a
  single in-flight request and a single background poll. This matters most
  on the Meetings page, which reads ABM and Lead Sources data to detect
  untracked contacts: without sharing, opening it re-ran
  `/api/sources?period=lifetime` — a full-portal contact scan — and visiting
  ABM Outreach afterwards ran the whole thing again. Polling also pauses
  while the tab is hidden, so a backgrounded tab stops spending HubSpot's
  account-wide rate limit on data nobody is looking at.
- **Route-level code splitting.** `App.jsx` lazy-loads each page, so the
  initial download carries the shell and the current route rather than every
  module's modals and charts.
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
concurrent-pagination collision noted in `api/sources/index.js` — that was
two *paginated* loops (many sequential requests each) racing each other;
ABM's segment fetches are a small, fixed number of batches, not pagination.

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
