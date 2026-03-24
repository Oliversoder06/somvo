-- ============================================================
-- Somvo v1 — Supabase SQL Setup
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Users table (mirrors auth.users with plan info)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free', 'creator', 'pro')),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own row"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own row"
  on public.users for update
  using (auth.uid() = id);

-- Allow the auth callback to upsert the user row
create policy "Service can insert users"
  on public.users for insert
  with check (auth.uid() = id);

-- 2. Projects table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  filename text not null,
  status text not null default 'uploading'
    check (status in ('uploading', 'processing', 'ready', 'done', 'failed')),
  raw_url text,
  processed_url text,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Users can read own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id);

-- 3. Transcripts table
create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  words jsonb not null default '[]'::jsonb,
  srt text,
  created_at timestamptz not null default now()
);

alter table public.transcripts enable row level security;

create policy "Users can read own transcripts"
  on public.transcripts for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = transcripts.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "Service can insert transcripts"
  on public.transcripts for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = transcripts.project_id
        and projects.user_id = auth.uid()
    )
  );

-- 4. Edit steps table
create table if not exists public.edit_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  steps jsonb not null default '[]'::jsonb,
  approved_steps jsonb,
  created_at timestamptz not null default now()
);

alter table public.edit_steps enable row level security;

create policy "Users can read own edit_steps"
  on public.edit_steps for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = edit_steps.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "Users can update own edit_steps"
  on public.edit_steps for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = edit_steps.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "Service can insert edit_steps"
  on public.edit_steps for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = edit_steps.project_id
        and projects.user_id = auth.uid()
    )
  );

-- 5. Usage table
create table if not exists public.usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  export_minutes numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.usage enable row level security;

create policy "Users can read own usage"
  on public.usage for select
  using (auth.uid() = user_id);

-- 6. Storage buckets
insert into storage.buckets (id, name, public)
values ('raw', 'raw', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('processed', 'processed', false)
on conflict (id) do nothing;

-- Storage policies: users can upload/read their own files
-- Raw bucket
create policy "Users can upload to raw bucket"
  on storage.objects for insert
  with check (
    bucket_id = 'raw'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can read own raw files"
  on storage.objects for select
  using (
    bucket_id = 'raw'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Processed bucket
create policy "Users can read own processed files"
  on storage.objects for select
  using (
    bucket_id = 'processed'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 7. Auto-create public.users row on signup via trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, plan)
  values (new.id, new.email, 'free')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
