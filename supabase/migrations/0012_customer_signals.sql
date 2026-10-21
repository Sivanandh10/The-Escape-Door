-- The Escape Door — stored shopping signals for recommendations (owner: AUTH, used by RECS). Idempotent: safe to run again.
-- Run in the Supabase SQL editor AFTER 0005_customers.sql (needs public.has_perm() and the 'customers.view' key).
--
-- Adds
--   public.customer_signals   what a signed-in shopper did while browsing: shop searches, collection (arc) pages,
--                              shop categories / product types, cart adds, wishlist saves and product views — one row
--                              per event with a timestamp and a server-set weight. Events done BEFORE logging in
--                              (kept in the browser's localStorage) are posted on login by POST /api/auth/me/sync and
--                              stored here, so the account's "Picked for you" starts from the whole session.
--                              Capped at the newest 500 rows per shopper. Nothing here is shown to other shoppers.
--   public.record_customer_signals(rows jsonb)   the ONLY write path (security definer, always writes auth.uid()'s rows):
--                              validates every row, ignores exact repeats (same kind + value + time), prunes to 500.
--
-- RLS
--   shoppers: read / delete their OWN rows (delete = "Clear history"); insert only via record_customer_signals(). No updates.
--   team members with customers.view: read (customer activity in the admin). anon: nothing.

-- ================================================================ pre-conditions
do $$
begin
  if to_regprocedure('public.has_perm(text)') is null then
    raise exception 'Run supabase/migrations/0002_roles.sql first (public.has_perm is missing).';
  end if;
  if to_regclass('public.profiles') is null or to_regclass('public.recent_views') is null then
    raise exception 'Run supabase/migrations/0005_customers.sql first (customer tables are missing).';
  end if;
end $$;

-- ================================================================ table
create table if not exists public.customer_signals (
  id       bigint generated always as identity primary key,
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind     text not null check (kind in ('search', 'collection', 'type', 'cart', 'wishlist', 'view')),
  value    text not null check (char_length(value) between 1 and 120),
  weight   real not null default 1 check (weight > 0 and weight <= 5),
  at       timestamptz not null default now()
);
create index if not exists customer_signals_user_time on public.customer_signals (user_id, at desc);
create unique index if not exists customer_signals_event on public.customer_signals (user_id, kind, value, at);

alter table public.customer_signals enable row level security;
revoke all on public.customer_signals from anon, authenticated;
-- no direct INSERT for browsers: rows only arrive through record_customer_signals() below, which clamps weight / time
-- and keeps the 500-row cap (a direct insert could store future timestamps or unlimited rows).
grant select, delete on public.customer_signals to authenticated;
grant all on public.customer_signals to service_role;

drop policy if exists "signals self read" on public.customer_signals;
create policy "signals self read" on public.customer_signals for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "signals self insert" on public.customer_signals;
drop policy if exists "signals self delete" on public.customer_signals;
create policy "signals self delete" on public.customer_signals for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "signals staff read" on public.customer_signals;
create policy "signals staff read" on public.customer_signals for select to authenticated
  using ((select public.has_perm('customers.view')));

-- ================================================================ helper
-- p_rows = [{ "kind": "search", "value": "jjk hoodie", "weight": 1, "at": "2026-10-22T10:00:00Z" }, …] (≤ 200)
-- Returns the number of rows stored (0 when signed out). Bad rows are skipped, never fatal.
create or replace function public.record_customer_signals(p_rows jsonb) returns integer
  language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n   integer := 0;
begin
  if uid is null or p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return 0;
  end if;

  with src as (
    select r->>'kind' as kind,
           left(btrim(r->>'value'), 120) as value,
           least(5, greatest(0.1, coalesce((r->>'weight')::real, 1))) as weight,
           least(now(), greatest(now() - interval '180 days', coalesce((r->>'at')::timestamptz, now()))) as at
      from jsonb_array_elements(p_rows) with ordinality as e(r, i)
     where jsonb_typeof(r) = 'object' and i <= 200
  ), ins as (
    insert into public.customer_signals (user_id, kind, value, weight, at)
    select uid, kind, value, weight, at from src
     where kind in ('search', 'collection', 'type', 'cart', 'wishlist', 'view')
       and char_length(coalesce(value, '')) between 1 and 120
    on conflict (user_id, kind, value, at) do nothing
    returning 1
  )
  select count(*) into n from ins;

  delete from public.customer_signals s
   where s.user_id = uid
     and s.id in (
       select x.id from public.customer_signals x
        where x.user_id = uid
        order by x.at desc, x.id desc
        offset 500
     );
  -- profiles.last_seen_at is server-written only (0009); ensureProfile() / record_product_view() stamp it.
  return n;
end;
$$;
revoke all on function public.record_customer_signals(jsonb) from public, anon;
grant execute on function public.record_customer_signals(jsonb) to authenticated, service_role;

-- ================================================================ post-checks (raise → whole run rolls back)
do $$
begin
  if not exists (select 1 from pg_class where oid = 'public.customer_signals'::regclass and relrowsecurity) then
    raise exception 'Post-check failed: RLS is not enabled on customer_signals.';
  end if;
  if has_table_privilege('anon', 'public.customer_signals', 'select') then
    raise exception 'Post-check failed: anon can read customer_signals.';
  end if;
  if has_table_privilege('authenticated', 'public.customer_signals', 'update')
     or has_table_privilege('authenticated', 'public.customer_signals', 'insert') then
    raise exception 'Post-check failed: browsers could write customer_signals directly.';
  end if;
end $$;
