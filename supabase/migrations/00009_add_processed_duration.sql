-- Add processed_duration column to persist the real duration after export
alter table public.projects
  add column if not exists processed_duration float;
