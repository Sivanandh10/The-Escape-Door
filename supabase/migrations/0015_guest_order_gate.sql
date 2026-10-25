-- The Escape Door — shared per-client limit for guest orders. Owner: COMMERCE (integrator).
-- Idempotent: safe to run again. Run in the Supabase SQL editor AFTER 0010.
--
-- Why: guest checkout (name + WhatsApp number) is now the default way to order. The route's IP limiter
-- (src/app/api/_lib/guard.ts allow()) lives in memory per serverless instance, and the per-phone cap in
-- place_checkout_order() (0010) is beaten by cycling numbers. A script could fill the site-wide guest cap
-- (40 / 10 min in 0010) and lock real shoppers out with "guest_busy".
-- This adds a limit SHARED across instances, keyed by a salted, daily-rotating HMAC of the client IP
-- (src/app/api/_lib/guard.ts stableClientHash()). The raw IP is never sent here or stored anywhere.
--
--   public.guest_order_hits       one row per guest order attempt: (key_hash, at). Rows older than 1 day are
--                                 deleted on every call. service_role only (RLS on, no policies).
--   public.guest_order_gate(key)  true = allowed (and the attempt is recorded); false = over the limit.
--                                 Limit: 10 guest order attempts per key per 10 minutes. service_role only.
-- The route fails OPEN when this function is missing (before this migration runs), so applying it is safe at
-- any time. Stronger follow-up: Cloudflare Turnstile on the guest contact step (free; needs the owner's keys).

create table if not exists public.guest_order_hits (
  key_hash  text not null check (key_hash ~ '^[0-9a-f]{16,64}$'),
  at        timestamptz not null default now()
);
create index if not exists guest_order_hits_key_at on public.guest_order_hits (key_hash, at desc);
create index if not exists guest_order_hits_at on public.guest_order_hits (at);

comment on table public.guest_order_hits is 'Guest order attempts per salted IP hash (no raw IPs). service_role only. Pruned after 1 day.';

alter table public.guest_order_hits enable row level security;
alter table public.guest_order_hits force row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'guest_order_hits' loop
    execute format('drop policy if exists %I on public.guest_order_hits', p.policyname);
  end loop;
end $$;

revoke all on public.guest_order_hits from public;
revoke all on public.guest_order_hits from anon;
revoke all on public.guest_order_hits from authenticated;
grant select, insert, delete on public.guest_order_hits to service_role;

create or replace function public.guest_order_gate(p_key text, p_limit int default 10, p_window_seconds int default 600)
  returns boolean
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_count int;
begin
  if p_key is null or p_key !~ '^[0-9a-f]{16,64}$' then
    return true; -- no usable key → let the other guards decide
  end if;
  -- serialise per key so two parallel attempts can't both slip under the limit
  perform pg_advisory_xact_lock(hashtextextended('guest_order_gate:' || p_key, 0));

  delete from public.guest_order_hits h where h.at < now() - interval '1 day';

  select count(*) into v_count from public.guest_order_hits h
   where h.key_hash = p_key and h.at > now() - make_interval(secs => greatest(p_window_seconds, 60));
  if v_count >= greatest(p_limit, 1) then
    return false;
  end if;

  insert into public.guest_order_hits (key_hash) values (p_key);
  return true;
end $$;

revoke all on function public.guest_order_gate(text, int, int) from public, anon, authenticated;
grant execute on function public.guest_order_gate(text, int, int) to service_role;

-- post-condition: nobody but service_role can read the table or call the gate
do $$
begin
  if has_table_privilege('anon', 'public.guest_order_hits', 'select')
     or has_table_privilege('authenticated', 'public.guest_order_hits', 'select') then
    raise exception 'guest_order_hits is readable by anon/authenticated — aborting';
  end if;
  if has_function_privilege('anon', 'public.guest_order_gate(text, int, int)', 'execute')
     or has_function_privilege('authenticated', 'public.guest_order_gate(text, int, int)', 'execute') then
    raise exception 'guest_order_gate is callable by anon/authenticated — aborting';
  end if;
end $$;
