-- Ensure only one transcript row per project (required for upsert on_conflict)
-- Remove any duplicates first, keeping the newest row per project
delete from public.transcripts a
  using public.transcripts b
  where a.project_id = b.project_id
    and a.created_at < b.created_at;

alter table public.transcripts
  add constraint transcripts_project_id_unique unique (project_id);
