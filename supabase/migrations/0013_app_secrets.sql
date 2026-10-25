-- The Escape Door — server-only secrets store. Owner: COMMERCE (AUTH).
-- Idempotent: safe to run again. Run in the Supabase SQL editor.
--
-- Why: some integration keys (MyAnimeList OAuth: MAL_CLIENT_ID / MAL_CLIENT_SECRET / MAL_REDIRECT_URI) have to reach
-- the server without editing Netlify environment variables. The app reads them with getServerSecret(name)
-- (src/lib/server-secrets.ts): the environment variable wins when it is set, otherwise this table is read with the
-- SERVICE ROLE key (cached 5 minutes per server instance).
--
-- Security model
--   * RLS is ON and there are NO policies → anon / authenticated can never read or write a row, even if a grant
--     were added by mistake later.
--   * All privileges revoked from anon and authenticated (and public) → PostgREST answers 401/permission denied.
--   * Only service_role (which bypasses RLS) can read / write. The table is never exposed to the browser and is NOT
--     in the supabase_realtime publication.
--   * Values are never logged or returned by any API route.
--
-- Insert / rotate a secret (SQL editor, as the owner — never commit real values):
--   insert into public.app_secrets (name, value) values ('MAL_CLIENT_ID', '<value>')
--     on conflict (name) do update set value = excluded.value, updated_at = now();

create table if not exists public.app_secrets (
  name        text primary key check (name ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  value       text not null check (char_length(value) between 1 and 4096),
  updated_at  timestamptz not null default now()
);

comment on table public.app_secrets is 'Server-only integration secrets. service_role only (RLS on, no policies). Read via src/lib/server-secrets.ts.';

alter table public.app_secrets enable row level security;
alter table public.app_secrets force row level security;

-- no policies on purpose: drop any that a manual edit may have added
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'app_secrets' loop
    execute format('drop policy if exists %I on public.app_secrets', p.policyname);
  end loop;
end $$;

revoke all on public.app_secrets from public;
revoke all on public.app_secrets from anon;
revoke all on public.app_secrets from authenticated;
grant select, insert, update, delete on public.app_secrets to service_role;

-- keep updated_at honest on rotation
create or replace function public.app_secrets_touch() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.app_secrets_touch() from public, anon, authenticated;

drop trigger if exists app_secrets_touch on public.app_secrets;
create trigger app_secrets_touch before update on public.app_secrets
  for each row execute function public.app_secrets_touch();

-- post-condition: anon / authenticated must have no privilege at all
do $$
begin
  if has_table_privilege('anon', 'public.app_secrets', 'select')
     or has_table_privilege('authenticated', 'public.app_secrets', 'select') then
    raise exception 'app_secrets is readable by anon/authenticated — aborting';
  end if;
end $$;
