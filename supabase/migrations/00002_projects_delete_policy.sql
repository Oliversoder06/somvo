-- Allow users to delete their own projects (e.g. cleanup on failed upload)
create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);
