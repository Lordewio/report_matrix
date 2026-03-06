-- Backfill app-level users from auth users to satisfy tasks.author_id FK
insert into public.users (id, email, name)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)) as name
from auth.users au
left join public.users u on u.id = au.id
where u.id is null
  and au.email is not null;

-- Keep public.users in sync for new auth signups
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email,
      name = coalesce(excluded.name, public.users.name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();
