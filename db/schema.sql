-- Sales Pipeline data model — run this once against the Neon database
-- (Vercel → Storage → Marketplace → Neon → the project's DATABASE_URL) via
-- the Neon SQL editor or `psql "$DATABASE_URL" -f db/schema.sql`.
--
-- No migration framework is used (matches this project's minimal-dependency
-- style) — this file is the source of truth for the current schema. Future
-- changes should be applied by hand and this file kept in sync.

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
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references pipeline_leads(id) on delete cascade,
  body       text not null,
  author     text not null,
  created_at timestamptz not null default now()
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

-- Migration (2026-07-30): added `priority` after the initial schema shipped.
-- Fresh installs get it from the CREATE TABLE above; an already-created
-- database needs this run once by hand:
--   alter table pipeline_leads add column priority text not null default 'medium'
--     check (priority in ('low','medium','high'));

-- Migration (2026-07-31): added `region`. Nullable, free text (same reasoning
-- as `source` — a fixed dropdown in the UI with an "Other" free-text escape
-- hatch, not DB-enforced, so adding a region is a one-file UI change). Run
-- against an already-created database:
--   alter table pipeline_leads add column region text;
