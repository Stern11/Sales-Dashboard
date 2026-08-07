-- Adds region (fixed dropdown + free-text "Other" in the UI, not DB-enforced)
-- to leads. Originally added 2026-07-31.
alter table pipeline_leads add column if not exists region text;
