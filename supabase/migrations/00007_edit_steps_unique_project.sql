-- Ensure only one edit_steps row per project (required for upsert on_conflict)
-- Remove any duplicates first, keeping the newest row per project
delete from public.edit_steps a
  using public.edit_steps b
  where a.project_id = b.project_id
    and a.created_at < b.created_at;

alter table public.edit_steps
  add constraint edit_steps_project_id_unique unique (project_id);
