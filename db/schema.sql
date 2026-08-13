-- Sales Pipeline data model — a REFERENCE SNAPSHOT of the current full
-- schema, for a human to read at a glance. This file is not run directly
-- and is not the source of truth.
--
-- The source of truth is db/migrations/ (small, numbered, idempotent .sql
-- files) applied via `npm run migrate` — see README.md's "Setting up the
-- Sales Pipeline database" section. Adding a column/table/index means
-- adding a new db/migrations/NNNN_description.sql file (never editing an
-- already-applied one) and then updating the matching table definition
-- below to keep this snapshot in sync — this file's shape should always
-- match what running every migration file in order produces.

create extension if not exists pgcrypto;

create table pipeline_leads (
  id                    uuid primary key default gen_random_uuid(),
  company_name          text not null,
  contact_name          text not null,
  email                 text,
  phone                 text,
  source                text not null,
  source_locked         boolean not null default false,
  hubspot_contact_id    text,
  hubspot_origin_module text,
  company_scale         text,
  region                text,
  is_supply_chain       boolean not null default false,
  priority              text not null default 'medium'
                          check (priority in ('low','medium','high')),
  deal_size             numeric(14,2),
  project_description   text,
  stage                 text not null default 'sql'
                          check (stage in ('sql','discovery','proposal','commercial','won','cold','lost')),
  prior_active_stage    text
                          check (prior_active_stage in ('sql','discovery','proposal','commercial')),
  cold_lost_reason      text,
  created_by            text not null,
  updated_by            text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Many leads have no HubSpot origin at all (manual entry) — a partial unique
-- index (not a plain UNIQUE column) so only non-null contact ids are constrained.
create unique index pipeline_leads_hubspot_contact_id_uq
  on pipeline_leads (hubspot_contact_id) where hubspot_contact_id is not null;

create index pipeline_leads_stage_idx on pipeline_leads (stage);
create index pipeline_leads_updated_at_idx on pipeline_leads (updated_at desc);

create table pipeline_lead_notes (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references pipeline_leads(id) on delete cascade,
  body          text not null,
  author        text not null,
  tagged_emails text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create index pipeline_lead_notes_lead_id_idx on pipeline_lead_notes (lead_id, created_at desc);

create table pipeline_lead_stage_history (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references pipeline_leads(id) on delete cascade,
  from_stage  text,
  to_stage    text not null check (to_stage in ('sql','discovery','proposal','commercial','won','cold','lost')),
  reason      text,
  changed_by  text not null,
  changed_at  timestamptz not null default now()
);

create index pipeline_lead_stage_history_lead_id_idx on pipeline_lead_stage_history (lead_id, changed_at);
create index pipeline_lead_stage_history_to_stage_idx on pipeline_lead_stage_history (to_stage, changed_at);

-- Demo Calls module — a lead-level table (demo_call_leads) plus an
-- open-ended per-call log (demo_call_logs, "Call 1"/"Call 2"/... rather than
-- a fixed 3-slot form). Only ever populated when a rep actually starts
-- logging a lead — never auto-inserted just because a HubSpot contact
-- reached the Demo Call lifecycle stage (that detection is live/client-side,
-- see src/modules/demo-calls/useLiveDemoCallContacts.js).
create table demo_call_leads (
  id                    uuid primary key default gen_random_uuid(),
  company_name          text not null,
  contact_name          text not null,
  email                 text,
  phone                 text,
  hubspot_contact_id    text,
  hubspot_origin_module text,
  status                text not null default 'active'
                          check (status in ('active','irrelevant')),
  irrelevant_reason     text,
  pipeline_lead_id      uuid references pipeline_leads(id) on delete set null,
  added_to_pipeline_at  timestamptz,
  company_scale         text,
  created_by            text not null,
  updated_by            text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index demo_call_leads_hubspot_contact_id_uq
  on demo_call_leads (hubspot_contact_id) where hubspot_contact_id is not null;

create index demo_call_leads_status_idx on demo_call_leads (status);
create index demo_call_leads_updated_at_idx on demo_call_leads (updated_at desc);
create index demo_call_leads_pipeline_lead_id_idx
  on demo_call_leads (pipeline_lead_id) where pipeline_lead_id is not null;

create table demo_call_logs (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references demo_call_leads(id) on delete cascade,
  call_number    integer not null,
  call_date      date,
  outcome        text not null check (outcome in ('completed','no_show','scheduled')),
  notes          text,
  next_steps     text,
  transcript_url text,
  created_by     text not null,
  updated_by     text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index demo_call_logs_lead_id_idx on demo_call_logs (lead_id, call_number);

-- History of how this schema got here (for context, not for re-running —
-- see db/migrations/ for the actual runnable statements):
--   0001 (2026-07-28ish): initial schema — pipeline_leads/_notes/_stage_history
--   0002 (2026-07-30): added `priority`
--   0003 (2026-07-31): added `region`
--   0004 (2026-08-06): added `tagged_emails` on pipeline_lead_notes
--   0005 (2026-08-09): added demo_call_leads/demo_call_logs (Demo Calls module)
--   0006 (2026-08-09): demo_call_leads.pipeline_lead_id FK set to ON DELETE SET NULL
--   0007 (2026-08-09): added demo_call_leads_pipeline_lead_id_idx
--   0008 (2026-08-10): added demo_call_leads.company_scale
--   0009 (2026-08-13): added 'scheduled' to demo_call_logs.outcome
