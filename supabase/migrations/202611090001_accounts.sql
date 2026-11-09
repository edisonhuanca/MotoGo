begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  role text check (role in ('pasajero', 'conductor')),
  driver_status text not null default 'not_applicable'
    check (driver_status in ('not_applicable', 'pending', 'approved')),
  created_at timestamptz not null default now(),
  constraint profiles_driver_status_matches_role check (case
    when role = 'conductor' then driver_status in ('pending', 'approved')
    else driver_status = 'not_applicable' end)
);

alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy "read own profile" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "update own name" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- The auth server creates profiles. Public clients cannot insert profiles,
-- change roles after onboarding, or approve their own driver account.
create function public.create_account_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare chosen_role text;
begin
  if new.raw_app_meta_data->>'provider' = 'email'
    and new.raw_user_meta_data->>'role' in ('pasajero', 'conductor') then
    chosen_role := new.raw_user_meta_data->>'role';
  end if;
  insert into public.profiles (id, full_name, role, driver_status)
  values (new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 100),
    chosen_role, case when chosen_role = 'conductor' then 'pending' else 'not_applicable' end);
  return new;
end;
$$;
revoke all on function public.create_account_profile() from public, anon, authenticated;
create trigger motogo_account_created after insert on auth.users
  for each row execute function public.create_account_profile();

-- Existing social accounts complete the same one-time onboarding after login.
insert into public.profiles (id, full_name)
select id, left(coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''), 100)
from auth.users on conflict (id) do nothing;

create function public.complete_onboarding(selected_role text)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare profile public.profiles;
begin
  if auth.uid() is null or selected_role not in ('pasajero', 'conductor') or selected_role is null then
    raise exception 'Invalid onboarding request' using errcode = '42501';
  end if;
  update public.profiles set role = selected_role,
    driver_status = case when selected_role = 'conductor' then 'pending' else 'not_applicable' end
    where id = auth.uid() and role is null returning * into profile;
  if not found then select * into profile from public.profiles where id = auth.uid(); end if;
  if profile.id is null then raise exception 'Profile not found' using errcode = '42501'; end if;
  return profile;
end;
$$;
revoke all on function public.complete_onboarding(text) from public, anon;
grant execute on function public.complete_onboarding(text) to authenticated;

commit;
