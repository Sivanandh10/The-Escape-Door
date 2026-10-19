-- The Escape Door — team roles, permissions and a PROTECTED SUPERADMIN.
-- Idempotent: safe to run again (every step is "if not exists" / "create or replace" / guarded).
-- Run in the Supabase SQL editor after 0001_init.sql.
--
-- Model
--   * public.admins is the team list. Each row: role + extra permissions[] (+ email, display_name, …).
--   * Effective permissions = role defaults ∪ extras. team.manage is superadmin-only (stripped from extras).
--   * public.has_perm('<key>') is the gate used by every RLS policy below. public.is_admin() stays
--     (true for any team member) for backward compatibility.
--   * Team writes (add / edit / remove members) never come from the browser: there are NO insert /
--     update / delete policies on public.admins. The Next server actions use the service role after
--     re-checking that the caller is the superadmin.
--   * The superadmin row (sivanandh10cc@gmail.com) is protected by a trigger that fires for EVERY role,
--     including service_role and the SQL editor: it can't be updated or deleted, the auth user behind
--     it can't be deleted, soft-deleted, banned or moved to another email (trigger on auth.users), the
--     table can't be truncated, and nobody else can ever be made superadmin / protected.
--   * The script ends with a post-condition: if sivanandh10cc@gmail.com did not end up as the protected
--     superadmin, it raises and the whole run rolls back.
--
-- Permission keys (mirrored in src/lib/admin/permissions.ts):
--   dashboard.view analytics.view leads.view leads.edit orders.view orders.edit
--   catalog.edit settings.edit qr.use team.manage

-- ================================================================ columns
alter table public.admins add column if not exists email        text;
alter table public.admins add column if not exists display_name text;
alter table public.admins add column if not exists role         text not null default 'viewer';
alter table public.admins add column if not exists permissions  text[] not null default '{}';
alter table public.admins add column if not exists is_protected boolean not null default false;
alter table public.admins add column if not exists created_at   timestamptz default now();
alter table public.admins add column if not exists created_by   uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admins_role_check' and conrelid = 'public.admins'::regclass) then
    alter table public.admins add constraint admins_role_check
      check (role in ('superadmin', 'admin', 'editor', 'sales', 'viewer'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'admins_permissions_check' and conrelid = 'public.admins'::regclass) then
    alter table public.admins add constraint admins_permissions_check
      check (permissions <@ array['dashboard.view', 'analytics.view', 'leads.view', 'leads.edit', 'orders.view',
                                  'orders.edit', 'catalog.edit', 'settings.edit', 'qr.use', 'team.manage']::text[]);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'admins_display_name_len' and conrelid = 'public.admins'::regclass) then
    alter table public.admins add constraint admins_display_name_len check (display_name is null or char_length(display_name) <= 80);
  end if;
end $$;

-- at most ONE superadmin / protected row, enforced by an index as well as the trigger below
create unique index if not exists admins_one_superadmin_idx on public.admins ((true)) where role = 'superadmin';
create unique index if not exists admins_one_protected_idx  on public.admins ((true)) where is_protected;
create index if not exists admins_email_idx on public.admins (lower(email));

-- ================================================================ permission helpers
-- Role defaults. Keep in sync with ROLE_DEFAULTS in src/lib/admin/permissions.ts.
create or replace function public.role_perms(r text) returns text[]
  language sql immutable set search_path = '' as $$
  select case r
    when 'superadmin' then array['dashboard.view', 'analytics.view', 'leads.view', 'leads.edit', 'orders.view',
                                 'orders.edit', 'catalog.edit', 'settings.edit', 'qr.use', 'team.manage']
    when 'admin'      then array['dashboard.view', 'analytics.view', 'leads.view', 'leads.edit', 'orders.view',
                                 'orders.edit', 'catalog.edit', 'settings.edit', 'qr.use']
    when 'editor'     then array['dashboard.view', 'catalog.edit', 'qr.use']
    when 'sales'      then array['dashboard.view', 'analytics.view', 'leads.view', 'leads.edit', 'orders.view',
                                 'orders.edit', 'qr.use']
    when 'viewer'     then array['dashboard.view', 'analytics.view']
    else '{}'::text[]
  end::text[];
$$;

-- role defaults ∪ extras; team.manage only for the superadmin; *.edit implies *.view
create or replace function public.effective_perms(r text, extras text[]) returns text[]
  language sql immutable set search_path = '' as $$
  with base as (
    select unnest(public.role_perms(r) || coalesce(extras, '{}'::text[])) as p
  ), cleaned as (
    select p from base where p <> 'team.manage' or r = 'superadmin'
    union select 'leads.view'  where exists (select 1 from base where p = 'leads.edit')
    union select 'orders.view' where exists (select 1 from base where p = 'orders.edit')
  )
  select coalesce(array_agg(distinct p order by p), '{}'::text[]) from cleaned;
$$;

create or replace function public.admin_role() returns text
  language sql stable security definer set search_path = '' as $$
  select a.role from public.admins a where a.user_id = (select auth.uid());
$$;

create or replace function public.has_perm(p text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid())
      and p = any (public.effective_perms(a.role, a.permissions))
  );
$$;

-- unchanged meaning: any team member (kept for older code paths / policies)
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

revoke all on function public.role_perms(text) from public;
revoke all on function public.effective_perms(text, text[]) from public;
revoke all on function public.admin_role() from public;
revoke all on function public.has_perm(text) from public;
revoke all on function public.is_admin() from public;
grant execute on function public.role_perms(text) to anon, authenticated, service_role;
grant execute on function public.effective_perms(text, text[]) to anon, authenticated, service_role;
grant execute on function public.admin_role() to anon, authenticated, service_role;
grant execute on function public.has_perm(text) to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ================================================================ backfill + bootstrap
-- (Runs before the guard trigger is (re)created and skips protected rows, so re-running is a no-op.)
-- Make sure the owner has a team row at all (upsert), so the bootstrap below can't silently match nothing.
insert into public.admins (user_id, email)
select u.id, lower(u.email) from auth.users u
 where lower(u.email) = 'sivanandh10cc@gmail.com'
 order by u.created_at
 limit 1
on conflict (user_id) do nothing;

update public.admins a
   set email = u.email
  from auth.users u
 where a.user_id = u.id
   and a.email is null
   and not a.is_protected;

update public.admins a
   set role = 'superadmin',
       is_protected = true,
       permissions = '{}',
       email = 'sivanandh10cc@gmail.com',
       display_name = coalesce(a.display_name, 'Sivanandh')
 where a.user_id = (select u.id from auth.users u where lower(u.email) = 'sivanandh10cc@gmail.com' limit 1)
   and not a.is_protected
   and not exists (select 1 from public.admins s where s.role = 'superadmin' and s.user_id <> a.user_id);

-- ================================================================ protection trigger
create or replace function public.admins_guard() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  -- 1. the protected (superadmin) row can never change or disappear — for ANY database role
  if tg_op in ('UPDATE', 'DELETE') and old.is_protected then
    raise exception 'The superadmin % is protected: it cannot be edited or removed.', coalesce(old.email, old.user_id::text)
      using errcode = 'P0001', hint = 'protected_admin';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  -- 2. only one superadmin / protected row ever (set by this migration)
  if new.role = 'superadmin' or new.is_protected then
    if exists (
      select 1 from public.admins s
      where (s.role = 'superadmin' or s.is_protected) and s.user_id <> new.user_id
    ) then
      raise exception 'There is already a superadmin. Nobody else can be made superadmin or protected.'
        using errcode = 'P0001', hint = 'superadmin_exists';
    end if;
  end if;

  -- 3. team.manage is superadmin-only: strip it from everybody else's extras; no duplicates
  if new.role <> 'superadmin' then
    new.permissions := array_remove(coalesce(new.permissions, '{}'::text[]), 'team.manage');
  end if;
  new.permissions := coalesce((select array_agg(distinct p order by p) from unnest(new.permissions) p), '{}'::text[]);

  if new.email is not null then
    new.email := lower(trim(new.email));
  end if;
  return new;
end;
$$;

drop trigger if exists admins_guard on public.admins;
create trigger admins_guard
  before insert or update or delete on public.admins
  for each row execute function public.admins_guard();

-- TRUNCATE skips row triggers → block it while a protected row exists
create or replace function public.admins_guard_truncate() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.admins where is_protected) then
    raise exception 'public.admins holds the protected superadmin and cannot be truncated.'
      using errcode = 'P0001', hint = 'protected_admin';
  end if;
  return null;
end;
$$;

drop trigger if exists admins_guard_truncate on public.admins;
create trigger admins_guard_truncate
  before truncate on public.admins
  for each statement execute function public.admins_guard_truncate();

-- ================================================================ protect the superadmin's LOGIN (auth.users)
-- The admins_guard only covers public.admins (a hard delete of the auth user cascades into it and fails).
-- GoTrue's soft delete, ban and email change are plain UPDATEs on auth.users, so guard those too.
-- Password changes stay allowed so the owner can still use "forgot password" / change his own password;
-- the app's own reset-password action refuses the protected row.
create or replace function public.protect_superadmin_login() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.admins a where a.user_id = old.id and a.is_protected) then
    if tg_op = 'DELETE'
       or (new.deleted_at is not null and new.deleted_at is distinct from old.deleted_at)
       or (new.banned_until is not null and new.banned_until is distinct from old.banned_until)
       or new.email is distinct from old.email then
      raise exception 'The superadmin login % is protected: it cannot be deleted, banned or moved to another email.', old.email
        using errcode = 'P0001', hint = 'protected_admin';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_superadmin_login() from public, anon, authenticated;

do $$
begin
  drop trigger if exists protect_superadmin_login on auth.users;
  create trigger protect_superadmin_login
    before update or delete on auth.users
    for each row execute function public.protect_superadmin_login();
exception when insufficient_privilege then
  raise warning 'Could not add the auth.users guard (no privilege on auth.users). public.admins is still protected.';
end $$;

-- ================================================================ RLS: admins (team list)
alter table public.admins enable row level security;

drop policy if exists "admins read self" on public.admins;
drop policy if exists "admins read self or team" on public.admins;
create policy "admins read self or team" on public.admins for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_perm('team.manage')));
-- No insert / update / delete policies on purpose: team writes go through server actions (service role).
revoke insert, update, delete, truncate on public.admins from anon, authenticated;

-- ================================================================ RLS: catalogue (public read stays)
do $$
declare t text;
begin
  foreach t in array array['collections', 'products', 'events', 'partnerships', 'insta_posts', 'bundle_rules', 'custom_rules'] loop
    execute format('drop policy if exists "owner all" on public.%I', t);
    execute format('drop policy if exists "catalog editors all" on public.%I', t);
    execute format('create policy "catalog editors all" on public.%I for all to authenticated '
                   'using ((select public.has_perm(''catalog.edit''))) with check ((select public.has_perm(''catalog.edit'')))', t);
  end loop;
end $$;

drop policy if exists "owner all" on public.settings;
drop policy if exists "settings editors all" on public.settings;
create policy "settings editors all" on public.settings for all to authenticated
  using ((select public.has_perm('settings.edit'))) with check ((select public.has_perm('settings.edit')));

-- ================================================================ RLS: leads / orders / analytics
drop policy if exists "owner all" on public.leads;
drop policy if exists "leads read" on public.leads;
drop policy if exists "leads insert" on public.leads;
drop policy if exists "leads update" on public.leads;
drop policy if exists "leads delete" on public.leads;
create policy "leads read"   on public.leads for select to authenticated using ((select public.has_perm('leads.view')));
create policy "leads insert" on public.leads for insert to authenticated with check ((select public.has_perm('leads.edit')));
create policy "leads update" on public.leads for update to authenticated
  using ((select public.has_perm('leads.edit'))) with check ((select public.has_perm('leads.edit')));
create policy "leads delete" on public.leads for delete to authenticated using ((select public.has_perm('leads.edit')));

drop policy if exists "owner all" on public.orders;
drop policy if exists "orders read" on public.orders;
drop policy if exists "orders insert" on public.orders;
drop policy if exists "orders update" on public.orders;
drop policy if exists "orders delete" on public.orders;
create policy "orders read"   on public.orders for select to authenticated using ((select public.has_perm('orders.view')));
create policy "orders insert" on public.orders for insert to authenticated with check ((select public.has_perm('orders.edit')));
create policy "orders update" on public.orders for update to authenticated
  using ((select public.has_perm('orders.edit'))) with check ((select public.has_perm('orders.edit')));
create policy "orders delete" on public.orders for delete to authenticated using ((select public.has_perm('orders.edit')));

-- analytics: raw per-visitor rows only for analytics.view; inserts stay service-role only (Netlify `track`).
-- Dashboard-only / QR-only members get server-side aggregates (service role) with pages, sources and
-- geography stripped — see src/components/admin/analytics/data.ts.
drop policy if exists "owner all" on public.analytics_events;
drop policy if exists "analytics read" on public.analytics_events;
create policy "analytics read" on public.analytics_events for select to authenticated
  using ((select public.has_perm('analytics.view')));
-- The v_* KPI views are security_invoker, so they follow these base-table policies
-- (v_leads_daily → leads.view; the rest → analytics.view).

-- ================================================================ storage
drop policy if exists "product images owner write" on storage.objects;
create policy "product images owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.has_perm('catalog.edit')));
drop policy if exists "product images owner update" on storage.objects;
create policy "product images owner update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.has_perm('catalog.edit')));
drop policy if exists "product images owner delete" on storage.objects;
create policy "product images owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.has_perm('catalog.edit')));

-- custom-request files are opened from Leads / Orders
drop policy if exists "custom uploads owner read" on storage.objects;
create policy "custom uploads owner read" on storage.objects for select to authenticated
  using (bucket_id = 'custom-uploads' and ((select public.has_perm('leads.view')) or (select public.has_perm('orders.view'))));
drop policy if exists "custom uploads owner delete" on storage.objects;
create policy "custom uploads owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'custom-uploads' and (select public.has_perm('leads.edit')));
-- "product images public read" from 0001 is untouched.

-- ================================================================ post-condition
-- If the owner has no auth login yet (or another row somehow holds superadmin), fail loudly: the whole
-- script runs as one transaction in the SQL editor, so nothing above is kept.
do $$
begin
  if not exists (
    select 1 from public.admins a join auth.users u on u.id = a.user_id
     where a.is_protected and a.role = 'superadmin' and lower(u.email) = 'sivanandh10cc@gmail.com'
  ) then
    raise exception 'Bootstrap failed: sivanandh10cc@gmail.com is not the protected superadmin. Create that login in Supabase → Authentication → Users first, then run this file again.';
  end if;
end $$;

-- ================================================================ checks (read-only; uncomment to verify)
-- select user_id, email, role, is_protected, public.effective_perms(role, permissions) from public.admins;
-- update public.admins set display_name = 'x' where is_protected;   -- must fail: protected_admin
