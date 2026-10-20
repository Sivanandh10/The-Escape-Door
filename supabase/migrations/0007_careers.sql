-- The Escape Door — careers: job posts + applications + private resume bucket. Owner: CAREERS.
-- Idempotent: safe to run again. Run in the Supabase SQL editor AFTER 0001_init.sql, 0002_roles.sql,
-- 0003_superadmin_delete.sql and 0004_perms.sql (needs the 'careers.edit' permission key).
--
-- Model
--   * public.jobs            anon/authenticated SELECT only where status = 'open' (the /careers pages).
--                            Team members with careers.edit read every job (drafts + closed) and insert/update.
--   * public.job_applications NO anon/customer access at all. Rows are inserted only by the route
--                            POST /api/careers/apply with the service role after zod validation, honeypot and
--                            rate limiting. careers.edit reads + updates (status pipeline, notes).
--   * DELETE (both tables + bucket) = superadmin only: permissive "superadmin delete" + RESTRICTIVE
--     "only superadmin deletes" guard, exactly like 0003.
--   * storage bucket 'careers' (private, 5 MB, pdf/doc/docx): visitors upload ONLY through a signed upload URL
--     minted by POST /api/careers/resume-url (service role) — so there is no anon insert policy. careers.edit
--     reads (admin creates short-lived signed URLs for downloads). No update policy for anyone.
--   * Realtime: job_applications is added to the supabase_realtime publication (guarded) so the admin gets a
--     live toast on new applications. Realtime postgres_changes honours RLS, so only careers.edit members see them.

-- ================================================================ pre-condition: 0002 + 0003 + 0004 applied
do $$
begin
  if to_regprocedure('public.has_perm(text)') is null or to_regprocedure('public.admin_role()') is null then
    raise exception 'Run supabase/migrations/0002_roles.sql first (public.has_perm / public.admin_role are missing).';
  end if;
  if to_regprocedure('public.is_superadmin()') is null then
    raise exception 'Run supabase/migrations/0003_superadmin_delete.sql first (public.is_superadmin is missing).';
  end if;
  if to_regprocedure('public.role_perms(text)') is null or not ('careers.edit' = any (public.role_perms('admin'))) then
    raise exception 'Run supabase/migrations/0004_perms.sql first (permission key careers.edit is missing).';
  end if;
  if to_regprocedure('public.touch_updated_at()') is null then
    raise exception 'Run supabase/migrations/0001_init.sql first (public.touch_updated_at is missing).';
  end if;
end $$;

-- ================================================================ jobs
create table if not exists public.jobs (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title             text not null check (char_length(title) between 2 and 120),
  team              text not null default '' check (char_length(team) <= 60),
  location          text not null default '' check (char_length(location) <= 120),
  type              text not null default 'full-time' check (type in ('full-time', 'part-time', 'internship', 'freelance')),
  is_remote         boolean not null default false,
  description       text not null default '' check (char_length(description) <= 20000),
  responsibilities  text[] not null default '{}',
  requirements      text[] not null default '{}',
  perks             text[] not null default '{}',
  -- custom application questions: [{ id, label, type: 'text'|'textarea'|'url'|'select', options?: text[], required }]
  questions         jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  status            text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists jobs_status_idx on public.jobs (status, created_at desc);

drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();

alter table public.jobs enable row level security;

drop policy if exists "jobs public read open" on public.jobs;
create policy "jobs public read open" on public.jobs for select to anon, authenticated
  using (status = 'open');
drop policy if exists "jobs team read" on public.jobs;
create policy "jobs team read" on public.jobs for select to authenticated
  using ((select public.has_perm('careers.edit')));
drop policy if exists "jobs team insert" on public.jobs;
create policy "jobs team insert" on public.jobs for insert to authenticated
  with check ((select public.has_perm('careers.edit')));
drop policy if exists "jobs team update" on public.jobs;
create policy "jobs team update" on public.jobs for update to authenticated
  using ((select public.has_perm('careers.edit'))) with check ((select public.has_perm('careers.edit')));

-- ================================================================ job_applications
create table if not exists public.job_applications (
  id             uuid primary key default gen_random_uuid(),
  -- RESTRICT: a job with applications can't be deleted by accident — close it instead (status = 'closed').
  job_id         uuid not null references public.jobs (id) on delete restrict,
  job_title      text not null default '',   -- snapshot at apply time (CSV stays readable if the post is renamed)
  name           text not null check (char_length(name) between 1 and 120),
  email          text not null check (char_length(email) between 3 and 200),
  phone          text not null default '' check (char_length(phone) <= 40),
  city           text not null default '' check (char_length(city) <= 120),
  portfolio_url  text not null default '' check (char_length(portfolio_url) <= 500),
  linkedin_url   text not null default '' check (char_length(linkedin_url) <= 500),
  resume_path    text check (resume_path is null or resume_path ~ '^resumes/[0-9]{4}-[0-9]{2}/[0-9a-f-]{36}\.(pdf|doc|docx)$'),
  resume_name    text not null default '' check (char_length(resume_name) <= 200),
  -- [{ id, label, value }] — labels are snapshotted so answers survive later question edits
  answers        jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  consent        boolean not null default false,
  status         text not null default 'new' check (status in ('new', 'shortlisted', 'interview', 'rejected', 'hired')),
  notes          text not null default '' check (char_length(notes) <= 4000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists job_applications_job_idx on public.job_applications (job_id, created_at desc);
create index if not exists job_applications_status_idx on public.job_applications (status);
create unique index if not exists job_applications_resume_path_key on public.job_applications (resume_path)
  where resume_path is not null;

drop trigger if exists job_applications_touch on public.job_applications;
create trigger job_applications_touch before update on public.job_applications
  for each row execute function public.touch_updated_at();

alter table public.job_applications enable row level security;

-- no insert policy on purpose: only the service role (POST /api/careers/apply) inserts.
drop policy if exists "applications team read" on public.job_applications;
create policy "applications team read" on public.job_applications for select to authenticated
  using ((select public.has_perm('careers.edit')));
drop policy if exists "applications team update" on public.job_applications;
create policy "applications team update" on public.job_applications for update to authenticated
  using ((select public.has_perm('careers.edit'))) with check ((select public.has_perm('careers.edit')));

-- belt and braces: browsers never write applications directly
revoke insert, delete, truncate on public.job_applications from anon;
revoke insert, truncate on public.job_applications from authenticated;
revoke insert, update, delete, truncate on public.jobs from anon;

-- ================================================================ DELETE = superadmin only (as 0003)
do $$
declare t text;
begin
  foreach t in array array['jobs', 'job_applications'] loop
    execute format('drop policy if exists "superadmin delete" on public.%I', t);
    execute format('create policy "superadmin delete" on public.%I for delete to authenticated '
                   'using ((select public.admin_role()) = ''superadmin'')', t);
    execute format('drop policy if exists "only superadmin deletes" on public.%I', t);
    execute format('create policy "only superadmin deletes" on public.%I as restrictive for delete '
                   'using ((select public.admin_role()) = ''superadmin'')', t);
  end loop;
end $$;

-- ================================================================ storage: private 'careers' bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('careers', 'careers', false, 5242880, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- read: team members with careers.edit (the admin signs short-lived download URLs with their own session)
drop policy if exists "careers resumes team read" on storage.objects;
create policy "careers resumes team read" on storage.objects for select to authenticated
  using (bucket_id = 'careers' and (select public.has_perm('careers.edit')));

-- delete: superadmin only (permissive + restrictive guard scoped to this bucket)
drop policy if exists "careers resumes superadmin delete" on storage.objects;
create policy "careers resumes superadmin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'careers' and (select public.admin_role()) = 'superadmin');
drop policy if exists "careers bucket only superadmin deletes" on storage.objects;
create policy "careers bucket only superadmin deletes" on storage.objects as restrictive for delete
  using (bucket_id <> 'careers' or (select public.admin_role()) = 'superadmin');

-- no insert / update policy for anon or authenticated: uploads only via signed upload URLs from the server.

-- ================================================================ realtime (guarded)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'job_applications') then
    execute 'alter publication supabase_realtime add table public.job_applications';
  end if;
end $$;

-- ================================================================ post-checks (raise → whole run rolls back)
do $$
declare t text;
begin
  foreach t in array array['jobs', 'job_applications'] loop
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname = t and c.relrowsecurity) then
      raise exception 'Post-check failed: RLS is not enabled on public.%.', t;
    end if;
    if not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t
                   and p.policyname = 'only superadmin deletes' and p.permissive = 'RESTRICTIVE' and p.cmd = 'DELETE') then
      raise exception 'Post-check failed: restrictive delete guard missing on public.%.', t;
    end if;
  end loop;
  if exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = 'job_applications'
             and p.cmd in ('INSERT', 'ALL')) then
    raise exception 'Post-check failed: job_applications must not have an insert policy (service role only).';
  end if;
  if not exists (select 1 from storage.buckets b where b.id = 'careers' and b.public = false) then
    raise exception 'Post-check failed: storage bucket careers missing or public.';
  end if;
  if not exists (select 1 from pg_policies p where p.schemaname = 'storage' and p.tablename = 'objects'
                 and p.policyname = 'careers bucket only superadmin deletes' and p.permissive = 'RESTRICTIVE') then
    raise exception 'Post-check failed: restrictive delete guard missing on the careers bucket.';
  end if;
end $$;

-- Verify by hand (optional):
--   select policyname, cmd, permissive, roles from pg_policies where tablename in ('jobs', 'job_applications');
--   select * from pg_publication_tables where pubname = 'supabase_realtime';
