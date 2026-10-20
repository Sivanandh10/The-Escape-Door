-- The Escape Door — four new team permission keys for the customer-accounts / vouchers / careers / pages work.
-- Idempotent: safe to run again. Run in the Supabase SQL editor AFTER 0001_init.sql, 0002_roles.sql and
-- 0003_superadmin_delete.sql — and BEFORE any migration whose RLS policies call has_perm() with these keys.
--
-- New keys (mirrored in src/lib/admin/permissions.ts — keep both in sync):
--   customers.view  Customers         — signed-in customers, their orders, addresses, activity
--   vouchers.edit   Vouchers          — create / pause / hand out voucher codes, see redemptions
--   careers.edit    Careers           — job posts + applications (incl. CSV export)
--   pages.edit      Pages & policies  — editable policy / info pages
--
-- Role defaults after this file
--   superadmin  everything (incl. team.manage + delete)
--   admin       every grantable key (the 9 from 0002 + the 4 above = 13)
--   editor      dashboard.view catalog.edit qr.use + careers.edit pages.edit
--   sales       dashboard.view analytics.view leads.* orders.* qr.use + customers.view vouchers.edit
--   viewer      dashboard.view analytics.view (unchanged)
--
-- Everything else is identical to 0003: 'delete' and 'team.manage' stay superadmin-only (stripped from
-- everybody else's effective perms; 'delete' is still NOT storable as an extra), *.edit implies *.view for
-- leads / orders. No policies, tables or triggers change here.

-- ================================================================ pre-condition: 0002 + 0003 must be applied
do $$
begin
  if to_regprocedure('public.has_perm(text)') is null or to_regprocedure('public.admin_role()') is null then
    raise exception 'Run supabase/migrations/0002_roles.sql first (public.has_perm / public.admin_role are missing).';
  end if;
  if to_regprocedure('public.is_superadmin()') is null then
    raise exception 'Run supabase/migrations/0003_superadmin_delete.sql first (public.is_superadmin is missing).';
  end if;
end $$;

-- ================================================================ storable extras (admins.permissions)
-- Same as 0002 plus the four new keys. 'delete' stays out on purpose (never storable as an extra).
alter table public.admins drop constraint if exists admins_permissions_check;
alter table public.admins add constraint admins_permissions_check
  check (permissions <@ array['dashboard.view', 'analytics.view', 'leads.view', 'leads.edit', 'orders.view',
                              'orders.edit', 'catalog.edit', 'settings.edit', 'qr.use',
                              'customers.view', 'vouchers.edit', 'careers.edit', 'pages.edit',
                              'team.manage']::text[]);

-- ================================================================ permission helpers
-- Role defaults: identical to 0003 plus the four new keys per the defaults above.
-- Keep in sync with ROLE_DEFAULTS in src/lib/admin/permissions.ts.
create or replace function public.role_perms(r text) returns text[]
  language sql immutable set search_path = '' as $$
  select case r
    when 'superadmin' then array['dashboard.view', 'analytics.view', 'leads.view', 'leads.edit', 'orders.view',
                                 'orders.edit', 'catalog.edit', 'settings.edit', 'qr.use',
                                 'customers.view', 'vouchers.edit', 'careers.edit', 'pages.edit',
                                 'team.manage', 'delete']
    when 'admin'      then array['dashboard.view', 'analytics.view', 'leads.view', 'leads.edit', 'orders.view',
                                 'orders.edit', 'catalog.edit', 'settings.edit', 'qr.use',
                                 'customers.view', 'vouchers.edit', 'careers.edit', 'pages.edit']
    when 'editor'     then array['dashboard.view', 'catalog.edit', 'qr.use', 'careers.edit', 'pages.edit']
    when 'sales'      then array['dashboard.view', 'analytics.view', 'leads.view', 'leads.edit', 'orders.view',
                                 'orders.edit', 'qr.use', 'customers.view', 'vouchers.edit']
    when 'viewer'     then array['dashboard.view', 'analytics.view']
    else '{}'::text[]
  end::text[];
$$;

-- identical to 0003: 'delete' and team.manage are stripped for everyone but the superadmin; *.edit implies *.view
create or replace function public.effective_perms(r text, extras text[]) returns text[]
  language sql immutable set search_path = '' as $$
  with base as (
    select unnest(public.role_perms(r) || coalesce(extras, '{}'::text[])) as p
  ), cleaned as (
    select p from base where (p <> 'team.manage' and p <> 'delete') or r = 'superadmin'
    union select 'leads.view'  where exists (select 1 from base where p = 'leads.edit')
    union select 'orders.view' where exists (select 1 from base where p = 'orders.edit')
  )
  select coalesce(array_agg(distinct p order by p), '{}'::text[]) from cleaned;
$$;
revoke all on function public.role_perms(text) from public;
revoke all on function public.effective_perms(text, text[]) from public;
grant execute on function public.role_perms(text) to anon, authenticated, service_role;
grant execute on function public.effective_perms(text, text[]) to anon, authenticated, service_role;

-- ================================================================ post-conditions (whole run rolls back if any fails)
do $$
declare
  k text;
begin
  -- 'delete' / team.manage stay superadmin-only
  if not (public.effective_perms('superadmin', '{}') @> array['delete', 'team.manage']) then
    raise exception 'Post-check failed: superadmin lost delete / team.manage.';
  end if;
  if 'delete' = any (public.effective_perms('admin', array['delete']))
     or 'team.manage' = any (public.effective_perms('admin', array['team.manage'])) then
    raise exception 'Post-check failed: delete / team.manage leaked to a non-superadmin.';
  end if;

  -- admin = every grantable key (13), nothing more
  if not (public.effective_perms('admin', '{}') @> public.role_perms('admin')
          and public.role_perms('admin') @> public.effective_perms('admin', '{}')
          and cardinality(public.role_perms('admin')) = 13) then
    raise exception 'Post-check failed: admin defaults are not the 13 grantable keys.';
  end if;

  -- the new keys: superadmin + admin always; editor / sales per the defaults; viewer unchanged
  foreach k in array array['customers.view', 'vouchers.edit', 'careers.edit', 'pages.edit'] loop
    if not (k = any (public.effective_perms('superadmin', '{}')) and k = any (public.effective_perms('admin', '{}'))) then
      raise exception 'Post-check failed: % missing from superadmin / admin.', k;
    end if;
  end loop;
  if not (public.effective_perms('editor', '{}') @> array['careers.edit', 'pages.edit']
          and not (public.effective_perms('editor', '{}') && array['customers.view', 'vouchers.edit'])) then
    raise exception 'Post-check failed: editor defaults wrong (want careers.edit + pages.edit only).';
  end if;
  if not (public.effective_perms('sales', '{}') @> array['customers.view', 'vouchers.edit']
          and not (public.effective_perms('sales', '{}') && array['careers.edit', 'pages.edit'])) then
    raise exception 'Post-check failed: sales defaults wrong (want customers.view + vouchers.edit only).';
  end if;
  if not (public.role_perms('viewer') @> array['dashboard.view', 'analytics.view']
          and cardinality(public.role_perms('viewer')) = 2) then
    raise exception 'Post-check failed: viewer defaults changed.';
  end if;

  -- the new keys are storable as extras; 'delete' still is not
  if not exists (
    select 1 from pg_constraint c
     where c.conname = 'admins_permissions_check' and c.conrelid = 'public.admins'::regclass
       and pg_get_constraintdef(c.oid) like '%pages.edit%'
       and pg_get_constraintdef(c.oid) like '%customers.view%'
       and pg_get_constraintdef(c.oid) not like '%''delete''%'
  ) then
    raise exception 'Post-check failed: admins_permissions_check does not allow the new keys (or allows delete).';
  end if;

  -- the protected superadmin from 0002 is still in place
  if not exists (select 1 from public.admins a where a.role = 'superadmin' and a.is_protected) then
    raise exception 'Post-check failed: the protected superadmin row is missing.';
  end if;
end $$;

-- ================================================================ checks (read-only; uncomment to verify)
-- select r, public.role_perms(r) from unnest(array['superadmin','admin','editor','sales','viewer']) r;
-- select user_id, email, role, public.effective_perms(role, permissions) from public.admins;
