-- The Escape Door — customer accounts (owner: AUTH). Idempotent: safe to run again.
-- Run in the Supabase SQL editor AFTER 0001 … 0004 (needs public.has_perm() and the 'customers.view' key from 0004).
--
-- Adds
--   public.profiles       one row per shopper (auth.users.id). Created by the app on a customer's first login
--                          (never for staff — the app skips users in public.admins). email is always copied from
--                          auth.users by a trigger, so a shopper can't put someone else's email on their profile.
--   public.mal_accounts   linked MyAnimeList account: username, imported anime list snapshot, MAL suggestions and
--                          the MAL refresh token. The refresh_token column is NOT readable by browsers (column grant):
--                          only the service role (server code) reads or writes it. Browsers can't write this table.
--   public.recent_views   product pages a signed-in shopper opened (one row per product, newest first, capped).
--   public.record_product_view(slug)  upsert helper the site calls (security invoker → RLS applies).
--
-- RLS
--   shoppers: read/insert/update their own profile; read their own MAL row (minus the token); read/write/delete their own
--   recent views. Team members with customers.view can read profiles, MAL rows (minus token) and recent views.
--   anon: nothing. Deleting a profile happens only through auth.users (on delete cascade).

-- ================================================================ pre-conditions
do $$
begin
  if to_regprocedure('public.has_perm(text)') is null then
    raise exception 'Run supabase/migrations/0002_roles.sql first (public.has_perm is missing).';
  end if;
  if to_regprocedure('public.role_perms(text)') is null
     or not ('customers.view' = any (public.role_perms('sales'))) then
    raise exception 'Run supabase/migrations/0004_perms.sql first (permission key customers.view is missing).';
  end if;
  if to_regprocedure('public.touch_updated_at()') is null then
    raise exception 'Run supabase/migrations/0001_init.sql first (public.touch_updated_at is missing).';
  end if;
end $$;

-- ================================================================ profiles
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  name          text check (char_length(name) <= 80),
  phone         text check (char_length(phone) <= 24),
  avatar_url    text check (char_length(avatar_url) <= 600),
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.profiles add column if not exists last_seen_at timestamptz;
create index if not exists profiles_created_idx on public.profiles (created_at desc);

-- email always mirrors auth.users; created_at can't be rewritten
create or replace function public.profiles_sync_email() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  select u.email into new.email from auth.users u where u.id = new.id;
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
revoke all on function public.profiles_sync_email() from public, anon, authenticated;

drop trigger if exists profiles_sync_email on public.profiles;
create trigger profiles_sync_email before insert or update on public.profiles
  for each row execute function public.profiles_sync_email();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- keep profiles.email current when the auth email changes
create or replace function public.auth_email_to_profile() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
revoke all on function public.auth_email_to_profile() from public, anon, authenticated;

drop trigger if exists on_auth_email_to_profile on auth.users;
create trigger on_auth_email_to_profile after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.auth_email_to_profile();

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists "profiles staff read" on public.profiles;
create policy "profiles staff read" on public.profiles for select to authenticated
  using ((select public.has_perm('customers.view')));

-- ================================================================ MyAnimeList link
create table if not exists public.mal_accounts (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  mal_id            bigint not null unique,
  mal_username      text not null check (char_length(mal_username) <= 64),
  picture           text check (char_length(picture) <= 600),
  refresh_token     text,                 -- SERVER ONLY (no column grant to browsers)
  token_expires_at  timestamptz,
  anime_snapshot    jsonb not null default '[]'::jsonb,  -- compact list: id, title, en, status, score, genres …
  suggestions       jsonb not null default '[]'::jsonb,  -- MAL /anime/suggestions (compact)
  stats             jsonb,                               -- counts per status, mean score
  synced_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists mal_accounts_synced_idx on public.mal_accounts (synced_at desc);

drop trigger if exists mal_accounts_touch on public.mal_accounts;
create trigger mal_accounts_touch before update on public.mal_accounts
  for each row execute function public.touch_updated_at();

alter table public.mal_accounts enable row level security;
revoke all on public.mal_accounts from anon, authenticated;
-- every column EXCEPT refresh_token / token_expires_at
grant select (user_id, mal_id, mal_username, picture, anime_snapshot, suggestions, stats, synced_at, created_at, updated_at)
  on public.mal_accounts to authenticated;

drop policy if exists "mal self read" on public.mal_accounts;
create policy "mal self read" on public.mal_accounts for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "mal staff read" on public.mal_accounts;
create policy "mal staff read" on public.mal_accounts for select to authenticated
  using ((select public.has_perm('customers.view')));

-- ================================================================ recently viewed
create table if not exists public.recent_views (
  user_id       uuid not null references auth.users (id) on delete cascade,
  product_slug  text not null check (char_length(product_slug) between 1 and 120),
  viewed_at     timestamptz not null default now(),
  view_count    int not null default 1 check (view_count > 0),
  primary key (user_id, product_slug)
);
create index if not exists recent_views_user_time on public.recent_views (user_id, viewed_at desc);

alter table public.recent_views enable row level security;
revoke all on public.recent_views from anon;
grant select, insert, update, delete on public.recent_views to authenticated;

drop policy if exists "views self all" on public.recent_views;
create policy "views self all" on public.recent_views for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "views staff read" on public.recent_views;
create policy "views staff read" on public.recent_views for select to authenticated
  using ((select public.has_perm('customers.view')));

-- record one product view for the signed-in user (RLS applies: security invoker). Keeps the newest 60 per user
-- and stamps profiles.last_seen_at. Returns false when signed out.
create or replace function public.record_product_view(p_slug text) returns boolean
  language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_slug is null or char_length(p_slug) not between 1 and 120 then
    return false;
  end if;
  insert into public.recent_views as v (user_id, product_slug, viewed_at, view_count)
  values (uid, p_slug, now(), 1)
  on conflict (user_id, product_slug)
  do update set viewed_at = now(), view_count = v.view_count + 1;

  delete from public.recent_views r
   where r.user_id = uid
     and r.product_slug in (
       select x.product_slug from public.recent_views x
        where x.user_id = uid
        order by x.viewed_at desc
        offset 60
     );

  update public.profiles set last_seen_at = now() where id = uid;
  return true;
end;
$$;
revoke all on function public.record_product_view(text) from public, anon;
grant execute on function public.record_product_view(text) to authenticated, service_role;

-- ================================================================ post-checks (raise → whole run rolls back)
do $$
begin
  if to_regclass('public.profiles') is null or to_regclass('public.mal_accounts') is null or to_regclass('public.recent_views') is null then
    raise exception 'Post-check failed: customer tables are missing.';
  end if;
  if has_column_privilege('authenticated', 'public.mal_accounts', 'refresh_token', 'select') then
    raise exception 'Post-check failed: browsers could read mal_accounts.refresh_token.';
  end if;
  if has_table_privilege('authenticated', 'public.mal_accounts', 'insert')
     or has_table_privilege('authenticated', 'public.mal_accounts', 'update') then
    raise exception 'Post-check failed: browsers could write mal_accounts.';
  end if;
  if has_table_privilege('anon', 'public.profiles', 'select') or has_table_privilege('anon', 'public.recent_views', 'select') then
    raise exception 'Post-check failed: anon can read customer data.';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.profiles'::regclass and relrowsecurity)
     or not exists (select 1 from pg_class where oid = 'public.mal_accounts'::regclass and relrowsecurity)
     or not exists (select 1 from pg_class where oid = 'public.recent_views'::regclass and relrowsecurity) then
    raise exception 'Post-check failed: RLS is not enabled on a customer table.';
  end if;
end $$;
