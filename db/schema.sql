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
  source                text,
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

-- Unique, not merely indexed: call_number is read positionally by
-- listLeads() (array_agg(... order by call_number)[1..3]), so a duplicate
-- silently shifts the first/second/third-call KPIs. See migration 0013.
create unique index demo_call_logs_lead_id_call_number_uq on demo_call_logs (lead_id, call_number);

-- Account Expansion / Account Planning module — its own top-level section
-- (src/modules/account-expansion/), tracking Heizen's existing clients
-- (expansion/upsell targets), not ABM prospects. Same DB-backed pattern as
-- Sales Pipeline and Demo Calls. Accounts are created directly in this
-- module (not sourced from an ABM segment's HubSpot company list), so
-- hubspot_company_id is optional — nullable from migration 0012 on, kept
-- only in case a rep later wants to link an account to its HubSpot company.

create table account_expansion (
  id                     uuid primary key default gen_random_uuid(),
  hubspot_company_id     text,
  company_name           text not null,
  segment_id             text,
  expansion_outlook      text check (expansion_outlook in ('high','medium','early')),
  footprint_use_case     text,
  footprint_function     text,
  footprint_geography    text,
  footprint_value        numeric(14,2),
  footprint_start_date   date,
  footprint_stakeholder  text,
  footprint_notes        text,
  last_researched_at     timestamptz,
  created_by             text not null,
  updated_by             text not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index account_expansion_hubspot_company_id_uq
  on account_expansion (hubspot_company_id);

create table account_expansion_areas (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references account_expansion(id) on delete cascade,
  area              text not null,
  use_case          text,
  why_relevant      text,
  status            text not null default 'idea'
                      check (status in ('idea','researching','validated')),
  relevance         text not null default 'medium'
                      check (relevance in ('high','medium','low')),
  needs_validation  text,
  notes             text,
  archived          boolean not null default false,
  created_by        text not null,
  updated_by        text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index account_expansion_areas_account_id_idx on account_expansion_areas (account_id);

create table account_expansion_whitespace (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references account_expansion(id) on delete cascade,
  area        text not null,
  status      text not null default 'unknown'
                check (status in ('current','potential','unknown')),
  created_by  text not null,
  updated_by  text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index account_expansion_whitespace_area_uq
  on account_expansion_whitespace (account_id, area);

create table account_expansion_signals (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references account_expansion(id) on delete cascade,
  signal_date       date not null,
  signal_type       text not null
                      check (signal_type in (
                        'company_strategy','leadership','transformation','hiring',
                        'technology','operations','internal_learning','other'
                      )),
  finding           text not null,
  source_url        text,
  expansion_area_id uuid references account_expansion_areas(id) on delete set null,
  notes             text,
  created_by        text not null,
  updated_by        text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index account_expansion_signals_account_id_idx on account_expansion_signals (account_id, signal_date desc);

create table account_expansion_stakeholders (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references account_expansion(id) on delete cascade,
  name              text,
  title             text,
  function          text,
  relationship      text not null default 'unknown'
                      check (relationship in ('known','need_intro','research','unknown')),
  expansion_area_id uuid references account_expansion_areas(id) on delete set null,
  notes             text,
  created_by        text not null,
  updated_by        text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index account_expansion_stakeholders_account_id_idx on account_expansion_stakeholders (account_id);

create table account_expansion_questions (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references account_expansion(id) on delete cascade,
  question          text not null,
  expansion_area_id uuid references account_expansion_areas(id) on delete set null,
  priority          text not null default 'medium'
                      check (priority in ('high','medium','low')),
  answer            text,
  created_by        text not null,
  updated_by        text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index account_expansion_questions_account_id_idx on account_expansion_questions (account_id);

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
--   0010 (2026-08-14): added demo_call_leads.source
--   0011 (2026-08-14): added Account Expansion module (6 new tables)
--   0012 (2026-08-14): Account Expansion made standalone — hubspot_company_id now nullable
--   0013 (2026-08-14): demo_call_logs (lead_id, call_number) made unique; renumbers
--                      any duplicates the old addCall() race produced, and drops the
--                      now-redundant non-unique index on the same columns
