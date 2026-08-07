-- Adds priority (P0/P1/P2) to leads. Originally added 2026-07-30.
alter table pipeline_leads add column if not exists priority text not null default 'medium'
  check (priority in ('low','medium','high'));
