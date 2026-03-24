-- Automatically delete a user's Storage files when their public.users row
-- is deleted (which cascades from auth.users deletion).
--
-- Files are stored under: {user_id}/... in both the 'raw' and 'processed' buckets.

create or replace function public.handle_user_deleted()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Delete all storage objects belonging to this user.
  -- Wrapped in exception handler so storage errors never block user deletion.
  begin
    delete from storage.objects
    where bucket_id in ('raw', 'processed')
      and (storage.foldername(name))[1] = old.id::text;
  exception when others then
    raise warning 'Failed to clean storage for user %: %', old.id, sqlerrm;
  end;

  return old;
end;
$$;

drop trigger if exists on_user_deleted on public.users;
create trigger on_user_deleted
  before delete on public.users
  for each row execute procedure public.handle_user_deleted();
