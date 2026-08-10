-- Mirrors pipeline_leads.company_scale — free text validated in
-- lib/demo-calls/constants.js (COMPANY_SCALE_OPTIONS), not a DB enum, same
-- reasoning as db/schema.sql's note on pipeline_leads.company_scale/source.
-- Powers the Mid-Market/Enterprise breakdown KPI card on the Demo Calls page.
alter table demo_call_leads add column if not exists company_scale text;
