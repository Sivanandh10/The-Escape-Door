-- The Escape Door — checkout pipeline: saved addresses, order pipeline columns, vouchers + redemptions,
-- the atomic place_checkout_order() RPC, the 'checkout' settings key and Realtime on orders.
-- Owner: CHECKOUT. Idempotent: safe to run again. Run in the Supabase SQL editor AFTER 0001 → 0004
-- (it uses public.has_perm() with the 0004 keys 'vouchers.edit' and 'customers.view').
--
-- What changes
--   public.addresses            NEW  — a customer's saved delivery addresses (RLS: own rows; team read with
--                                      customers.view / orders.view). One default per customer, max 20.
--   public.orders               +    — user_id, email, nonce (idempotency), order_no (TED-1001…), address,
--                                      gift, voucher_code, discount, gift_fee, timeline; status adds
--                                      'placed' + 'packed'; customers read their own orders.
--   public.vouchers             NEW  — codes (upper-case), percent / flat, limits, optional assigned email
--                                      and product type. RLS: vouchers.edit only (never public).
--   public.voucher_redemptions  NEW  — one row per order that used a voucher. Written only by the RPC.
--   public.place_checkout_order NEW  — service-role-only RPC: dedupes on (user_id, nonce), locks the voucher,
--                                      re-checks its limits, inserts the analytics lead + order + redemption
--                                      in one transaction.
--   settings 'checkout'              — {"giftWrapFee": 0} seeded once (Admin → Vouchers edits it).
--   Realtime                         — public.orders added to supabase_realtime (admin "New order" toasts).
-- Deletes follow 0003: superadmin only on the team tables (vouchers, voucher_redemptions). Customers may
-- delete their OWN addresses (it's their data); the team can't delete addresses at all.

-- ================================================================ pre-conditions
do $$
begin
  if to_regprocedure('public.has_perm(text)') is null or to_regprocedure('public.admin_role()') is null then
    raise exception 'Run supabase/migrations/0002_roles.sql first (public.has_perm / public.admin_role are missing).';
  end if;
  if to_regprocedure('public.is_superadmin()') is null then
    raise exception 'Run supabase/migrations/0003_superadmin_delete.sql first.';
  end if;
  if not ('vouchers.edit' = any (public.role_perms('admin'))) then
    raise exception 'Run supabase/migrations/0004_perms.sql first (vouchers.edit is not a known permission yet).';
  end if;
end $$;

-- ================================================================ addresses
create table if not exists public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null default 'home' check (kind in ('home', 'college', 'work')),
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  phone       text not null check (phone ~ '^[6-9][0-9]{9}$'),   -- 10-digit Indian mobile (the app strips +91)
  line1       text not null check (char_length(btrim(line1)) between 3 and 160),
  line2       text check (char_length(line2) <= 160),
  landmark    text check (char_length(landmark) <= 120),
  city        text not null check (char_length(btrim(city)) between 2 and 80),
  state       text not null check (char_length(btrim(state)) between 2 and 60),
  pin         text not null check (pin ~ '^[1-9][0-9]{5}$'),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses (user_id, created_at desc);
create unique index if not exists addresses_one_default on public.addresses (user_id) where is_default;

drop trigger if exists addresses_touch on public.addresses;
create trigger addresses_touch before update on public.addresses
  for each row execute function public.touch_updated_at();

-- customers can't move an address to someone else, and keep at most 20
create or replace function public.addresses_guard() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'An address can''t change owner.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.addresses a where a.user_id = new.user_id) >= 20 then
    raise exception 'You can save up to 20 addresses.' using errcode = 'P0001', hint = 'address_limit';
  end if;
  -- a new default clears the old one (the partial unique index would refuse two)
  if new.is_default then
    update public.addresses set is_default = false
     where user_id = new.user_id and is_default and id <> new.id;
  end if;
  return new;
end $$;
drop trigger if exists addresses_guard on public.addresses;
create trigger addresses_guard before insert or update on public.addresses
  for each row execute function public.addresses_guard();

alter table public.addresses enable row level security;
revoke all on public.addresses from anon;
grant select, insert, update, delete on public.addresses to authenticated;
drop policy if exists "addresses own read" on public.addresses;
create policy "addresses own read" on public.addresses for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "addresses own insert" on public.addresses;
create policy "addresses own insert" on public.addresses for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "addresses own update" on public.addresses;
create policy "addresses own update" on public.addresses for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "addresses own delete" on public.addresses;
create policy "addresses own delete" on public.addresses for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "addresses team read" on public.addresses;
create policy "addresses team read" on public.addresses for select to authenticated
  using ((select public.has_perm('customers.view')) or (select public.has_perm('orders.view')));

-- ================================================================ orders: pipeline columns
create sequence if not exists public.orders_order_no_seq start with 1001;

alter table public.orders add column if not exists user_id      uuid references auth.users (id) on delete set null;
alter table public.orders add column if not exists email        text check (char_length(email) <= 200);
alter table public.orders add column if not exists nonce        text check (char_length(nonce) <= 64);
alter table public.orders add column if not exists order_no     bigint;
alter table public.orders add column if not exists address      jsonb;
alter table public.orders add column if not exists gift         jsonb;
alter table public.orders add column if not exists voucher_code text check (char_length(voucher_code) <= 40);
alter table public.orders add column if not exists discount     int not null default 0 check (discount >= 0);
alter table public.orders add column if not exists gift_fee     int not null default 0 check (gift_fee >= 0);
alter table public.orders add column if not exists timeline     jsonb not null default '[]'::jsonb;

alter table public.orders alter column order_no set default nextval('public.orders_order_no_seq');
alter sequence public.orders_order_no_seq owned by public.orders.order_no;
update public.orders set order_no = nextval('public.orders_order_no_seq') where order_no is null;

create unique index if not exists orders_order_no_key on public.orders (order_no);
create unique index if not exists orders_user_nonce_key on public.orders (user_id, nonce) where nonce is not null;
create index if not exists orders_user_idx on public.orders (user_id, created_at desc) where user_id is not null;

-- status: 0001 had new / confirmed / paid / shipped / delivered / cancelled. Checkout adds placed + packed
-- ('new' stays valid for hand-added orders and older rows).
do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
     where con.conrelid = 'public.orders'::regclass and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.orders drop constraint %I', c);
  end loop;
end $$;
alter table public.orders add constraint orders_status_check
  check (status in ('new', 'placed', 'confirmed', 'paid', 'packed', 'shipped', 'delivered', 'cancelled'));

-- timeline: every status change is stamped (who = the team member's email when a person did it)
create or replace function public.orders_timeline() returns trigger
  language plpgsql set search_path = '' as $$
declare who text := nullif(coalesce((select auth.jwt()) ->> 'email', ''), '');
begin
  if tg_op = 'INSERT' then
    if new.timeline is null or jsonb_array_length(new.timeline) = 0 then
      new.timeline := jsonb_build_array(jsonb_build_object('status', new.status, 'at', now()));
    end if;
  elsif new.status is distinct from old.status then
    new.timeline := coalesce(old.timeline, '[]'::jsonb)
      || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('status', new.status, 'at', now(), 'by', who)));
  end if;
  return new;
end $$;
drop trigger if exists orders_timeline on public.orders;
create trigger orders_timeline before insert or update on public.orders
  for each row execute function public.orders_timeline();

-- customers read their own orders (team policies from 0002 / 0003 stay as they are)
drop policy if exists "orders own read" on public.orders;
create policy "orders own read" on public.orders for select to authenticated
  using (user_id is not null and user_id = (select auth.uid()));

-- ================================================================ vouchers
create table if not exists public.vouchers (
  id               uuid primary key default gen_random_uuid(),
  code             text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{2,31}$'),
  description      text check (char_length(description) <= 200),
  type             text not null check (type in ('percent', 'flat')),
  value            int not null check (value > 0),
  min_order        int not null default 0 check (min_order >= 0),
  max_discount     int check (max_discount is null or max_discount > 0),
  starts_at        timestamptz,
  ends_at          timestamptz,
  usage_limit      int check (usage_limit is null or usage_limit > 0),
  per_user_limit   int default 1 check (per_user_limit is null or per_user_limit > 0),
  assigned_email   text check (assigned_email is null or assigned_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  applies_to_type  text check (char_length(applies_to_type) <= 40),
  active           boolean not null default true,
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint vouchers_percent_range check (type <> 'percent' or value <= 100),
  constraint vouchers_dates check (starts_at is null or ends_at is null or ends_at > starts_at)
);
create unique index if not exists vouchers_code_key on public.vouchers (code);
create index if not exists vouchers_assigned_idx on public.vouchers (assigned_email) where assigned_email is not null;

create or replace function public.vouchers_normalize() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.code := upper(btrim(new.code));
  new.assigned_email := nullif(lower(btrim(coalesce(new.assigned_email, ''))), '');
  new.applies_to_type := nullif(btrim(coalesce(new.applies_to_type, '')), '');
  return new;
end $$;
drop trigger if exists vouchers_normalize on public.vouchers;
create trigger vouchers_normalize before insert or update on public.vouchers
  for each row execute function public.vouchers_normalize();
drop trigger if exists vouchers_touch on public.vouchers;
create trigger vouchers_touch before update on public.vouchers
  for each row execute function public.touch_updated_at();

create table if not exists public.voucher_redemptions (
  id          uuid primary key default gen_random_uuid(),
  voucher_id  uuid not null references public.vouchers (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  order_id    uuid not null references public.orders (id) on delete cascade,
  amount      int not null check (amount >= 0),
  created_at  timestamptz not null default now()
);
create unique index if not exists voucher_redemptions_order_key on public.voucher_redemptions (order_id);
create index if not exists voucher_redemptions_voucher_idx on public.voucher_redemptions (voucher_id, user_id);

alter table public.vouchers enable row level security;
alter table public.voucher_redemptions enable row level security;
revoke all on public.vouchers from anon;
revoke all on public.voucher_redemptions from anon;
grant select, insert, update, delete on public.vouchers to authenticated;   -- RLS: vouchers.edit / superadmin
grant select, delete on public.voucher_redemptions to authenticated;        -- RLS: team read / superadmin

-- public / customers: nothing (validation goes through /api/vouchers/validate with the service role)
drop policy if exists "vouchers team read" on public.vouchers;
create policy "vouchers team read" on public.vouchers for select to authenticated
  using ((select public.has_perm('vouchers.edit')));
drop policy if exists "vouchers team insert" on public.vouchers;
create policy "vouchers team insert" on public.vouchers for insert to authenticated
  with check ((select public.has_perm('vouchers.edit')));
drop policy if exists "vouchers team update" on public.vouchers;
create policy "vouchers team update" on public.vouchers for update to authenticated
  using ((select public.has_perm('vouchers.edit'))) with check ((select public.has_perm('vouchers.edit')));

drop policy if exists "redemptions team read" on public.voucher_redemptions;
create policy "redemptions team read" on public.voucher_redemptions for select to authenticated
  using ((select public.has_perm('vouchers.edit')) or (select public.has_perm('orders.view')));

-- DELETE = superadmin only (same pattern as 0003)
do $$
declare t text;
begin
  foreach t in array array['vouchers', 'voucher_redemptions'] loop
    execute format('drop policy if exists "superadmin delete" on public.%I', t);
    execute format('create policy "superadmin delete" on public.%I for delete to authenticated '
                   'using ((select public.admin_role()) = ''superadmin'')', t);
    execute format('drop policy if exists "only superadmin deletes" on public.%I', t);
    execute format('create policy "only superadmin deletes" on public.%I as restrictive for delete '
                   'using ((select public.admin_role()) = ''superadmin'')', t);
  end loop;
end $$;

-- ================================================================ place_checkout_order (service role only)
-- p_order: {user_id, nonce, email, name, city, contact, note, src, items, totals, subtotal, savings, discount,
--           gift_fee, total, address, gift, voucher_code}
-- p_lead:  {name, city, contact, message, payload, source, src} or null — the analytics lead (status converted)
-- Errors (raised with hint): voucher_invalid, voucher_inactive, voucher_not_started, voucher_expired,
--                            voucher_used_up, voucher_already_used
create or replace function public.place_checkout_order(p_order jsonb, p_lead jsonb default null,
                                                       p_voucher_id uuid default null, p_discount int default 0)
  returns setof public.orders
  language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := nullif(p_order ->> 'user_id', '')::uuid;
  v_nonce  text := nullif(p_order ->> 'nonce', '');
  v_order  public.orders%rowtype;
  v_vouch  public.vouchers%rowtype;
  v_used   int;
  v_lead   uuid;
begin
  if v_uid is null or v_nonce is null then
    raise exception 'user_id and nonce are required' using errcode = '22023';
  end if;

  -- idempotency: the same checkout submitted twice returns the first order
  select * into v_order from public.orders o where o.user_id = v_uid and o.nonce = v_nonce;
  if found then
    return next v_order;
    return;
  end if;

  if p_voucher_id is not null then
    select * into v_vouch from public.vouchers v where v.id = p_voucher_id for update;
    if not found then raise exception 'voucher not found' using errcode = 'P0001', hint = 'voucher_invalid'; end if;
    if not v_vouch.active then raise exception 'voucher paused' using errcode = 'P0001', hint = 'voucher_inactive'; end if;
    if v_vouch.starts_at is not null and now() < v_vouch.starts_at then
      raise exception 'voucher not started' using errcode = 'P0001', hint = 'voucher_not_started';
    end if;
    if v_vouch.ends_at is not null and now() >= v_vouch.ends_at then
      raise exception 'voucher expired' using errcode = 'P0001', hint = 'voucher_expired';
    end if;
    if v_vouch.usage_limit is not null then
      select count(*) into v_used from public.voucher_redemptions r where r.voucher_id = v_vouch.id;
      if v_used >= v_vouch.usage_limit then
        raise exception 'voucher used up' using errcode = 'P0001', hint = 'voucher_used_up';
      end if;
    end if;
    if v_vouch.per_user_limit is not null then
      select count(*) into v_used from public.voucher_redemptions r where r.voucher_id = v_vouch.id and r.user_id = v_uid;
      if v_used >= v_vouch.per_user_limit then
        raise exception 'voucher already used' using errcode = 'P0001', hint = 'voucher_already_used';
      end if;
    end if;
  end if;

  if p_lead is not null then
    insert into public.leads (kind, name, city, contact, message, payload, source, src, status)
    values ('whatsapp_order', left(p_lead ->> 'name', 80), left(p_lead ->> 'city', 80), left(p_lead ->> 'contact', 120),
            left(p_lead ->> 'message', 2000), p_lead -> 'payload', p_lead -> 'source', left(p_lead ->> 'src', 64), 'converted')
    returning id into v_lead;
  end if;

  begin
    insert into public.orders (user_id, nonce, lead_id, email, name, city, contact, note, src, status, items, totals,
                               subtotal, savings, discount, gift_fee, total, address, gift, voucher_code)
    values (v_uid, v_nonce, v_lead, p_order ->> 'email', p_order ->> 'name', p_order ->> 'city', p_order ->> 'contact',
            p_order ->> 'note', p_order ->> 'src', 'placed', coalesce(p_order -> 'items', '[]'::jsonb), p_order -> 'totals',
            (p_order ->> 'subtotal')::int, (p_order ->> 'savings')::int, coalesce((p_order ->> 'discount')::int, 0),
            coalesce((p_order ->> 'gift_fee')::int, 0), (p_order ->> 'total')::int, p_order -> 'address', p_order -> 'gift',
            case when p_voucher_id is null then null else v_vouch.code end)
    returning * into v_order;
  exception when unique_violation then
    -- a concurrent duplicate of the same checkout won the race: hand back that order (this run rolls back)
    select * into v_order from public.orders o where o.user_id = v_uid and o.nonce = v_nonce;
    if found then
      if v_lead is not null then delete from public.leads where id = v_lead; end if;
      return next v_order;
      return;
    end if;
    raise;
  end;

  if p_voucher_id is not null then
    insert into public.voucher_redemptions (voucher_id, user_id, order_id, amount)
    values (p_voucher_id, v_uid, v_order.id, greatest(coalesce(p_discount, 0), 0));
  end if;

  return next v_order;
end $$;
revoke all on function public.place_checkout_order(jsonb, jsonb, uuid, int) from public, anon, authenticated;
grant execute on function public.place_checkout_order(jsonb, jsonb, uuid, int) to service_role;

-- ================================================================ settings: checkout (gift wrap fee)
insert into public.settings (key, value) values ('checkout', '{"giftWrapFee": 0}'::jsonb)
on conflict (key) do nothing;

-- ================================================================ realtime (admin "New order" toasts)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- ================================================================ post-conditions (whole run rolls back if any fails)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vouchers'
                  and policyname = 'only superadmin deletes' and permissive = 'RESTRICTIVE') then
    raise exception 'Post-check failed: restrictive delete guard missing on public.vouchers.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vouchers'
              and roles @> array['anon']::name[]) then
    raise exception 'Post-check failed: vouchers must never be readable by anon.';
  end if;
  if has_function_privilege('anon', 'public.place_checkout_order(jsonb, jsonb, uuid, int)', 'execute')
     or has_function_privilege('authenticated', 'public.place_checkout_order(jsonb, jsonb, uuid, int)', 'execute') then
    raise exception 'Post-check failed: place_checkout_order must be service-role only.';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.orders'::regclass and conname = 'orders_status_check'
                  and pg_get_constraintdef(oid) ilike '%packed%') then
    raise exception 'Post-check failed: orders.status does not accept packed.';
  end if;
end $$;

-- ================================================================ checks (read-only; uncomment to verify)
-- select tablename, policyname, permissive, cmd, roles from pg_policies
--  where schemaname = 'public' and tablename in ('addresses', 'orders', 'vouchers', 'voucher_redemptions')
--  order by tablename, cmd, policyname;
-- select * from pg_publication_tables where pubname = 'supabase_realtime';
