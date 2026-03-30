-- Add pipeline_log column to edit_steps for full audit trail
alter table public.edit_steps
  add column if not exists pipeline_log jsonb not null default '[]'::jsonb;

comment on column public.edit_steps.pipeline_log is
  'Structured trace of every decision made during cut list generation';
