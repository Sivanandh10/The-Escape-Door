-- The Escape Door — security hardening after the commerce review (INTEGRATOR).
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor AFTER 0005_customers.sql
-- (0006–0008 may run before or after this file).
--
-- What it does
--   1. public.profiles: shoppers may write ONLY their name and phone (column grants). avatar_url, last_seen_at,
--      email and created_at are written by the server (service role) / triggers only. Before this, a shopper could
--      set avatar_url to any URL, and every staff browser opening Admin → Customers would load it (tracking pixel),
--      or fake their "last seen" / signup dates.
--   2. record_product_view(slug) becomes SECURITY DEFINER (it still only touches auth.uid()'s own rows), because it
--      stamps profiles.last_seen_at, which browsers can no longer write directly.
--   3. public.mal_accounts: a database guard so a team member (public.admins) can never have a MyAnimeList link.
--      A MAL login must never become a way into an admin session. The app checks this too
--      (src/app/api/auth/mal/callback/route.ts); this is the second lock.

-- ================================================================ pre-condition: 0005
do $$
begin
  if to_regclass('public.profiles') is null or to_regclass('public.mal_accounts') is null then
    raise exception 'Run supabase/migrations/0005_customers.sql first (profiles / mal_accounts are missing).';
  end if;
  if to_regclass('public.admins') is null then
    raise exception 'Run supabase/migrations/0001_init.sql first (public.admins is missing).';
  end if;
end $$;

-- ================================================================ 1. profiles: name + phone only from browsers
revoke insert, update on public.profiles from authenticated;
-- insert: the row itself (id must be auth.uid() — RLS "profiles self insert") with an optional name / phone
grant insert (id, name, phone) on public.profiles to authenticated;
-- update: PostgREST upserts send "set id = excluded.id" too; RLS "profiles self update" keeps id = auth.uid()
grant update (id, name, phone) on public.profiles to authenticated;

-- ================================================================ 2. record_product_view → security definer
create or replace function public.record_product_view(p_slug text) returns boolean
  language plpgsql security definer set search_path = '' as $$
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

-- ================================================================ 3. no MyAnimeList link on a team account
create or replace function public.mal_accounts_no_staff() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.admins a where a.user_id = new.user_id) then
    raise exception 'Team accounts cannot link MyAnimeList.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.mal_accounts_no_staff() from public, anon, authenticated;

drop trigger if exists mal_accounts_no_staff on public.mal_accounts;
create trigger mal_accounts_no_staff before insert or update of user_id on public.mal_accounts
  for each row execute function public.mal_accounts_no_staff();

-- existing links on team accounts (made before this guard) are removed
delete from public.mal_accounts m using public.admins a where a.user_id = m.user_id;

-- ================================================================ post-checks (raise → whole run rolls back)
do $$
begin
  if has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'update')
     or has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'insert')
     or has_column_privilege('authenticated', 'public.profiles', 'last_seen_at', 'update')
     or has_column_privilege('authenticated', 'public.profiles', 'created_at', 'insert') then
    raise exception 'Post-check failed: browsers can still write server-only profile columns.';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'name', 'update')
     or not has_column_privilege('authenticated', 'public.profiles', 'phone', 'update') then
    raise exception 'Post-check failed: shoppers can no longer edit their name / phone.';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'mal_accounts_no_staff' and tgrelid = 'public.mal_accounts'::regclass) then
    raise exception 'Post-check failed: the mal_accounts staff guard is missing.';
  end if;
  if not exists (select 1 from pg_proc where oid = 'public.record_product_view(text)'::regprocedure and prosecdef) then
    raise exception 'Post-check failed: record_product_view is not security definer.';
  end if;
end $$;
