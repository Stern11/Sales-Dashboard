-- Where a manually-entered Demo Calls lead actually came from (Website
-- Inbound, Referral, ABM, Event, Ads, Partner, ...) — a different concept
-- from hubspot_origin_module (which view live-detected it, ABM or
-- Marketing). Free text validated in src/modules/demo-calls/constants.js
-- against the same SOURCE_CATEGORIES vocabulary Sales Pipeline uses, not a
-- DB enum, same reasoning as pipeline_leads.source (see db/schema.sql).
alter table demo_call_leads add column if not exists source text;
