-- Add pipeline_version to users table
-- Stores the user's default pipeline version (gated by plan tier).
alter table public.users
  add column if not exists pipeline_version text not null default 'v1';
