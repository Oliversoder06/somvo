-- Add pipeline_version column to projects (was mistakenly added to users in 00006)
alter table public.projects
  add column if not exists pipeline_version text not null default 'v1';

-- Expand status check to include 'analysed'
alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check
  check (status in ('uploading', 'processing', 'ready', 'done', 'failed', 'analysed'));
