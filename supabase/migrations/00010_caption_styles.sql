-- Caption style preferences per project.
-- One row per project, upserted when user changes style in the editor.

create table if not exists public.caption_styles (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  preset           text        not null default 'classic',
  font_family      text        not null default 'Inter',
  font_size        integer     not null default 32,
  font_weight      integer     not null default 700,
  color            text        not null default '#FFFFFF',
  highlight_color  text        not null default '#FF6A52',
  background       text        not null default 'box',
  background_color text        not null default 'rgba(0,0,0,0.6)',
  position         text        not null default 'bottom',
  animation        text        not null default 'none',
  max_words        integer     not null default 6,
  created_at       timestamptz not null default now(),
  unique(project_id)
);

-- RLS: users can only access caption styles for their own projects.
alter table public.caption_styles enable row level security;

create policy "Users can view own caption styles"
  on public.caption_styles for select
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

create policy "Users can insert own caption styles"
  on public.caption_styles for insert
  with check (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

create policy "Users can update own caption styles"
  on public.caption_styles for update
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

create policy "Users can delete own caption styles"
  on public.caption_styles for delete
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );
