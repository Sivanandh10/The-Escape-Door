-- The Escape Door — hierarchy: only the SUPERADMIN can delete.
-- Idempotent: safe to run again. Run in the Supabase SQL editor AFTER 0001_init.sql and 0002_roles.sql.
--
-- Owner rule: "super admin all access, admin all access but only super admin can delete — hierarchy model
-- for the rest" (Superadmin > Admin > Editor > Sales > Viewer, see src/lib/admin/permissions.ts).
--
-- What changes
--   * Every 0002 policy that could DELETE on an admin-editable table is replaced. Permissive policies are
--     OR-ed, so the old FOR ALL policies ("catalog editors all", "settings editors all") are split into
--     separate SELECT / INSERT / UPDATE policies with the SAME checks as 0002, and the old FOR DELETE
--     policies ("leads delete", "orders delete", storage "… owner delete") are dropped.
--   * One permissive "superadmin delete" policy per table: DELETE only when admin_role() = 'superadmin'.
--   * Belt and braces: one RESTRICTIVE "only superadmin deletes" policy per table (restrictive policies are
--     AND-ed with everything else), so even if 0002 is re-run or someone adds a FOR ALL policy later,
--     a non-superadmin still can't delete. Same on storage.objects for the two buckets.
--   * public.is_superadmin() helper; 'delete' becomes a superadmin-only permission key in
--     role_perms / effective_perms (mirrors canDelete() in TS). It is NOT in admins_permissions_check, so it
--     can never be stored as an extra.
--   * Non-delete rules are unchanged. The service role (server actions, Netlify functions) bypasses RLS
--     as before.

-- ================================================================ pre-condition: 0002 must be applied
do $$
begin
  if to_regprocedure('public.has_perm(text)') is null or to_regprocedure('public.admin_role()') is null then
    raise exception 'Run supabase/migrations/0002_roles.sql first (public.has_perm / public.admin_role are missing).';
  end if;
end $$;

-- ================================================================ helpers
create or replace function public.is_superadmin() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid()) and a.role = 'superadmin'
  );
$$;
revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to anon, authenticated, service_role;

-- Role defaults: identical to 0002 plus 'delete' for the superadmin only.
-- Keep in sync with ROLE_DEFAULTS in src/lib/admin/permissions.ts.
create or replace function public.role_perms(r text) returns text[]
  language sql immutable set search_path = '' as $$
  select case r
    when 'superadmin' then array['dashboard.view', 'analytics.view', 'leads.view', 'leads.edit', 'orders.view',
                                 'orders.edit', 'catalog.edit', 'settings.edit', 'qr.use', 'team.manage', 'delete']
    when 'admin'      then array['dashboard.view', 'analytics.view', 'leads.view', 'leads.edit', 'orders.view',
                                 'orders.edit', 'catalog.edit', 'settings.edit', 'qr.use']
    when 'editor'     then array['dashboard.view', 'catalog.edit', 'qr.use']
    when 'sales'      then array['dashboard.view', 'analytics.view', 'leads.view', 'leads.edit', 'orders.view',
                                 'orders.edit', 'qr.use']
    when 'viewer'     then array['dashboard.view', 'analytics.view']
    else '{}'::text[]
  end::text[];
$$;

-- identical to 0002, except 'delete' (like team.manage) is stripped for everyone but the superadmin
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

-- ================================================================ catalogue tables (catalog.edit)
-- 0002: "catalog editors all" FOR ALL using/with check has_perm('catalog.edit')  →  split.
-- "public read published" / "public read" from 0001 are untouched.
do $$
declare t text;
begin
  foreach t in array array['collections', 'products', 'bundle_rules', 'custom_rules', 'events', 'partnerships', 'insta_posts'] loop
    execute format('drop policy if exists "owner all" on public.%I', t);
    execute format('drop policy if exists "catalog editors all" on public.%I', t);

    execute format('drop policy if exists "catalog editors read" on public.%I', t);
    execute format('create policy "catalog editors read" on public.%I for select to authenticated '
                   'using ((select public.has_perm(''catalog.edit'')))', t);
    execute format('drop policy if exists "catalog editors insert" on public.%I', t);
    execute format('create policy "catalog editors insert" on public.%I for insert to authenticated '
                   'with check ((select public.has_perm(''catalog.edit'')))', t);
    execute format('drop policy if exists "catalog editors update" on public.%I', t);
    execute format('create policy "catalog editors update" on public.%I for update to authenticated '
                   'using ((select public.has_perm(''catalog.edit''))) with check ((select public.has_perm(''catalog.edit'')))', t);
  end loop;
end $$;

-- ================================================================ settings (settings.edit)
-- 0002: "settings editors all" FOR ALL using/with check has_perm('settings.edit')  →  split.
drop policy if exists "owner all" on public.settings;
drop policy if exists "settings editors all" on public.settings;
drop policy if exists "settings editors read" on public.settings;
create policy "settings editors read" on public.settings for select to authenticated
  using ((select public.has_perm('settings.edit')));
drop policy if exists "settings editors insert" on public.settings;
create policy "settings editors insert" on public.settings for insert to authenticated
  with check ((select public.has_perm('settings.edit')));
drop policy if exists "settings editors update" on public.settings;
create policy "settings editors update" on public.settings for update to authenticated
  using ((select public.has_perm('settings.edit'))) with check ((select public.has_perm('settings.edit')));

-- ================================================================ leads / orders
-- "leads read|insert|update" and "orders read|insert|update" from 0002 stay exactly as they are.
drop policy if exists "owner all" on public.leads;
drop policy if exists "leads delete" on public.leads;
drop policy if exists "owner all" on public.orders;
drop policy if exists "orders delete" on public.orders;

-- analytics_events: "analytics read" (select) from 0002 stays; inserts stay service-role only.
drop policy if exists "owner all" on public.analytics_events;

-- ================================================================ DELETE = superadmin only (all 11 tables)
do $$
declare t text;
begin
  foreach t in array array['collections', 'products', 'bundle_rules', 'custom_rules', 'events', 'partnerships',
                           'insta_posts', 'leads', 'orders', 'settings', 'analytics_events'] loop
    -- the only permissive DELETE policy
    execute format('drop policy if exists "superadmin delete" on public.%I', t);
    execute format('create policy "superadmin delete" on public.%I for delete to authenticated '
                   'using ((select public.admin_role()) = ''superadmin'')', t);
    -- restrictive guard (AND-ed with any permissive policy, for every role incl. anon)
    execute format('drop policy if exists "only superadmin deletes" on public.%I', t);
    execute format('create policy "only superadmin deletes" on public.%I as restrictive for delete '
                   'using ((select public.admin_role()) = ''superadmin'')', t);
  end loop;
end $$;

-- ================================================================ storage.objects
-- 0002 insert / update / read policies stay exactly as they are:
--   "product images owner write" (insert, catalog.edit), "product images owner update" (update, catalog.edit),
--   "custom uploads owner read" (select, leads.view or orders.view); "product images public read" from 0001.
drop policy if exists "product images owner delete" on storage.objects;
drop policy if exists "product images superadmin delete" on storage.objects;
create policy "product images superadmin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.admin_role()) = 'superadmin');

drop policy if exists "custom uploads owner delete" on storage.objects;
drop policy if exists "custom uploads superadmin delete" on storage.objects;
create policy "custom uploads superadmin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'custom-uploads' and (select public.admin_role()) = 'superadmin');

-- restrictive guard scoped to the two buckets (other buckets are not affected)
drop policy if exists "shop buckets only superadmin deletes" on storage.objects;
create policy "shop buckets only superadmin deletes" on storage.objects as restrictive for delete
  using (bucket_id not in ('product-images', 'custom-uploads') or (select public.admin_role()) = 'superadmin');

-- ================================================================ post-conditions (whole run rolls back if any fails)
do $$
declare
  t text;
  bad text;
begin
  -- 'delete' is superadmin-only in the permission model
  if not ('delete' = any (public.effective_perms('superadmin', '{}'))) then
    raise exception 'Post-check failed: superadmin lost the delete permission.';
  end if;
  if 'delete' = any (public.effective_perms('admin', array['delete'])) then
    raise exception 'Post-check failed: delete leaked to a non-superadmin.';
  end if;
  if not (public.effective_perms('admin', '{}') @> public.role_perms('admin')
          and public.role_perms('admin') @> public.effective_perms('admin', '{}')
          and cardinality(public.role_perms('admin')) = 9) then
    raise exception 'Post-check failed: admin defaults changed unexpectedly.';
  end if;

  -- every table: exactly one permissive DELETE-capable policy ("superadmin delete") + the restrictive guard
  foreach t in array array['collections', 'products', 'bundle_rules', 'custom_rules', 'events', 'partnerships',
                           'insta_posts', 'leads', 'orders', 'settings', 'analytics_events'] loop
    select string_agg(p.policyname, ', ') into bad
      from pg_policies p
     where p.schemaname = 'public' and p.tablename = t
       and p.permissive = 'PERMISSIVE' and p.cmd in ('ALL', 'DELETE')
       and p.policyname <> 'superadmin delete';
    if bad is not null then
      raise warning 'public.% still has other permissive delete-capable policies: % (blocked by "only superadmin deletes", but consider dropping them).', t, bad;
    end if;
    if not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t
                    and p.policyname = 'only superadmin deletes' and p.permissive = 'RESTRICTIVE' and p.cmd = 'DELETE') then
      raise exception 'Post-check failed: restrictive delete guard missing on public.%.', t;
    end if;
  end loop;

  if not exists (select 1 from pg_policies p where p.schemaname = 'storage' and p.tablename = 'objects'
                  and p.policyname = 'shop buckets only superadmin deletes' and p.permissive = 'RESTRICTIVE') then
    raise exception 'Post-check failed: restrictive delete guard missing on storage.objects.';
  end if;
end $$;

-- ================================================================ checks (read-only; uncomment to verify)
-- select tablename, policyname, permissive, cmd, roles, qual, with_check from pg_policies
--  where (schemaname = 'public' and tablename in ('collections','products','bundle_rules','custom_rules','events',
--         'partnerships','insta_posts','leads','orders','settings','analytics_events'))
--     or (schemaname = 'storage' and tablename = 'objects')
--  order by tablename, cmd, policyname;
-- select public.effective_perms(role, permissions), public.is_superadmin() from public.admins;
