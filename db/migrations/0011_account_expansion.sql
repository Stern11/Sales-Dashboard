-- Account Expansion / Account Planning module — lives inside ABM Outreach
-- (src/modules/abm/expansion/). ABM itself has no DB persistence (it's a
-- live HubSpot read, see lib/abm.js) but expansion planning is genuinely
-- persistent, rep-edited content HubSpot has no fields for, so it gets its
-- own small set of tables here — same DB-backed pattern as Sales Pipeline
-- and Demo Calls, keyed by the target account's HubSpot *company* id
-- (lib/abm-segments/*.js's `companies` list), not a contact id.

create table account_expansion (
  id                     uuid primary key default gen_random_uuid(),
  hubspot_company_id     text not null,
  company_name           text not null,
  segment_id             text,
  expansion_outlook      text check (expansion_outlook in ('high','medium','early')),
  -- Current Heizen Footprint — deliberately compact (a handful of plain
  -- fields, not a separate table) per the spec's "keep this compact rather
  -- than turning it into a large form."
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

-- One expansion-planning row per HubSpot company, regardless of segment —
-- get-or-create on first view (see lib/account-expansion/queries.js).
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

-- Whitespace is intentionally a handful of free-text area rows per account
-- (not a fixed enum of areas) — different accounts have different adjacent
-- functions worth tracking.
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
