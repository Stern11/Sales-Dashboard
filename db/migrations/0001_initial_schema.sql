-- Initial Sales Pipeline schema: pipeline_leads, pipeline_lead_notes,
-- pipeline_lead_stage_history + their indexes.
--
-- Every statement is IF NOT EXISTS — both the dev and prod Neon branches
-- already had this schema applied by hand before migrations existed, so
-- this file has to be a safe no-op against a DB that's already up to date,
-- not just against a truly empty one. That's true of every file in this
-- directory: idempotent by construction, so `npm run migrate` can always be
-- re-run safely regardless of what's already been applied.

create extension if not exists pgcrypto;

create table if not exists pipeline_leads (
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
  is_supply_chain       boolean not null default false,
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
create unique index if not exists pipeline_leads_hubspot_contact_id_uq
  on pipeline_leads (hubspot_contact_id) where hubspot_contact_id is not null;

create index if not exists pipeline_leads_stage_idx on pipeline_leads (stage);
create index if not exists pipeline_leads_updated_at_idx on pipeline_leads (updated_at desc);

create table if not exists pipeline_lead_notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references pipeline_leads(id) on delete cascade,
  body       text not null,
  author     text not null,
  created_at timestamptz not null default now()
);

create index if not exists pipeline_lead_notes_lead_id_idx on pipeline_lead_notes (lead_id, created_at desc);

create table if not exists pipeline_lead_stage_history (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references pipeline_leads(id) on delete cascade,
  from_stage  text,
  to_stage    text not null check (to_stage in ('sql','discovery','proposal','commercial','won','cold','lost')),
  reason      text,
  changed_by  text not null,
  changed_at  timestamptz not null default now()
);

create index if not exists pipeline_lead_stage_history_lead_id_idx on pipeline_lead_stage_history (lead_id, changed_at);
create index if not exists pipeline_lead_stage_history_to_stage_idx on pipeline_lead_stage_history (to_stage, changed_at);
