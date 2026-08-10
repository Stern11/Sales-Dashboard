-- demo_call_leads.pipeline_lead_id had no ON DELETE behavior, so deleting a
-- Sales Pipeline lead that a Demo Calls row still points to (e.g. one
-- created via "Add to pipeline") failed outright with a foreign-key
-- violation instead of just unlinking. Recreate the constraint as
-- ON DELETE SET NULL — deleting the pipeline lead un-links it here, letting
-- "Add to pipeline" be used again rather than permanently blocking deletion.
alter table demo_call_leads drop constraint if exists demo_call_leads_pipeline_lead_id_fkey;

alter table demo_call_leads
  add constraint demo_call_leads_pipeline_lead_id_fkey
  foreign key (pipeline_lead_id) references pipeline_leads(id) on delete set null;
