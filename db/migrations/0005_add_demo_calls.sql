-- Demo Calls module: demo_call_leads (one row per lead being call-tracked)
-- + demo_call_logs (one row per call attempt, open-ended — "Call 1", "Call
-- 2", ... rather than a fixed 3-slot form). Mirrors the pipeline_leads/
-- pipeline_lead_notes shape/conventions. See docs/ARCHITECTURE.md for the
-- module's design (client-side merge of live HubSpot "reached Demo Call"
-- detection with this DB-backed tracking — this table only ever holds leads
-- a rep has actually started logging, never auto-populated on read).

create table if not exists demo_call_leads (
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
  pipeline_lead_id      uuid references pipeline_leads(id),
  added_to_pipeline_at  timestamptz,
  created_by            text not null,
  updated_by            text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Same partial-unique-index pattern as pipeline_leads: most leads here have
-- no HubSpot origin at all (manual entry), so only non-null contact ids are
-- constrained.
create unique index if not exists demo_call_leads_hubspot_contact_id_uq
  on demo_call_leads (hubspot_contact_id) where hubspot_contact_id is not null;

create index if not exists demo_call_leads_status_idx on demo_call_leads (status);
create index if not exists demo_call_leads_updated_at_idx on demo_call_leads (updated_at desc);

create table if not exists demo_call_logs (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references demo_call_leads(id) on delete cascade,
  call_number    integer not null,
  call_date      date,
  outcome        text not null check (outcome in ('completed','no_show')),
  notes          text,
  next_steps     text,
  transcript_url text,
  created_by     text not null,
  updated_by     text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists demo_call_logs_lead_id_idx on demo_call_logs (lead_id, call_number);
