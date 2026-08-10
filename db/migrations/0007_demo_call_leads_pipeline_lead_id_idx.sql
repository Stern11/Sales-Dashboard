-- Supports the reverse lookup Sales Pipeline's "View Demo Call History"
-- button uses (getLeadByPipelineLeadId in lib/demo-calls/queries.js).
create index if not exists demo_call_leads_pipeline_lead_id_idx
  on demo_call_leads (pipeline_lead_id) where pipeline_lead_id is not null;
