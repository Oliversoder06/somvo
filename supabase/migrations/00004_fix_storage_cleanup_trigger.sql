-- Fix: wrap storage cleanup in exception handler so it never blocks user deletion.
create or replace function public.handle_user_deleted()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
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
