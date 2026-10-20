-- The Escape Door — guest checkout: orders without an account, linked to the account later. Owner: CHECKOUT.
-- Idempotent: safe to run again. Run in the Supabase SQL editor AFTER 0006_checkout.sql.
--
-- What changes
--   public.orders               +  contact_email / contact_phone (who placed it — for guests the only identity),
--                                  guest (true = placed without a login; stays true after it is linked), indexes,
--                                  a unique (nonce) for guest orders (idempotency without a user_id).
--                                  Existing checkout rows get contact_phone / contact_email back-filled.
--   public.place_checkout_order  REPLACED (same signature, service role only): user_id may be null when
--                                  p_order.guest = true. Guests: dedupe on nonce, contact phone required, vouchers
--                                  tied to an email OR limited per customer are refused (a typed phone / email proves
--                                  nothing, so a per-customer limit can't be enforced for a guest), plus a persistent
--                                  flood guard (per phone per hour, and all guests per 10 minutes).
--   public.claim_guest_orders    NEW (security definer, SERVICE ROLE ONLY): links guest orders to an account when
--                                  the contact email equals the account's auth email AND the server vouches that
--                                  this login proved control of that inbox (email link / OTP / Google), or the
--                                  account has a Google identity with that verified email. No phone matching: the
--                                  profile phone is typed by the shopper and never verified.
--   RLS                             unchanged in spirit: anon has NO access to orders; customers read their own
--                                  rows by user_id ("orders own read", 0006); only the server route writes.
--   Realtime                        unchanged (public.orders already in supabase_realtime → admin toasts).

-- ================================================================ pre-conditions
do $$
begin
  if to_regprocedure('public.place_checkout_order(jsonb, jsonb, uuid, integer)') is null then
    raise exception 'Run supabase/migrations/0006_checkout.sql first (place_checkout_order is missing).';
  end if;
end $$;

-- ================================================================ orders: contact + guest
alter table public.orders add column if not exists contact_email text;
alter table public.orders add column if not exists contact_phone text;
alter table public.orders add column if not exists guest boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.orders'::regclass and conname = 'orders_contact_email_check') then
    alter table public.orders add constraint orders_contact_email_check
      check (contact_email is null or (char_length(contact_email) <= 200 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.orders'::regclass and conname = 'orders_contact_phone_check') then
    alter table public.orders add constraint orders_contact_phone_check
      check (contact_phone is null or contact_phone ~ '^[6-9][0-9]{9}$');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.orders'::regclass and conname = 'orders_guest_identity_check') then
    -- a guest order that is not linked yet must carry a phone (that's how we reach them and how it gets claimed)
    alter table public.orders add constraint orders_guest_identity_check
      check (not guest or user_id is not null or contact_phone is not null) not valid;
  end if;
end $$;

-- back-fill guest orders saved before this migration (the app's interim path: user_id null + nonce + address);
-- their orderer's phone is in `contact`
-- (one statement: orders_guest_identity_check needs the phone on the same row update)
update public.orders
   set guest = true,
       contact_phone = coalesce(contact_phone,
                                case when contact ~ '^[6-9][0-9]{9}$' then contact else address ->> 'phone' end)
 where not guest and user_id is null and nonce is not null and address is not null
   and (contact ~ '^[6-9][0-9]{9}$' or (address ->> 'phone') ~ '^[6-9][0-9]{9}$');

-- back-fill existing checkout rows (logged-in orders): phone from the address snapshot, email from the order
update public.orders
   set contact_phone = address ->> 'phone'
 where contact_phone is null and address ? 'phone' and (address ->> 'phone') ~ '^[6-9][0-9]{9}$';
update public.orders
   set contact_email = lower(email)
 where contact_email is null and email is not null and char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
   and email !~* '@users\.the-escape-door\.local$';

create index if not exists orders_guest_email_idx on public.orders (lower(contact_email))
  where user_id is null and guest and contact_email is not null;
create index if not exists orders_guest_phone_idx on public.orders (contact_phone)
  where user_id is null and guest and contact_phone is not null;
create index if not exists orders_contact_phone_idx on public.orders (contact_phone) where contact_phone is not null;
create unique index if not exists orders_guest_nonce_key on public.orders (nonce)
  where user_id is null and guest and nonce is not null;

-- anon never touches orders (0001 already revoked; repeated so a re-run of an older file can't widen it)
revoke all on public.orders from anon;

-- ================================================================ place_checkout_order (service role only)
-- p_order: {user_id|null, guest, nonce, email, contact_email, contact_phone, name, city, contact, note, src, items,
--           totals, subtotal, savings, discount, gift_fee, total, address, gift}
-- Errors (raised with hint): voucher_invalid, voucher_inactive, voucher_not_started, voucher_expired,
--                            voucher_used_up, voucher_already_used, voucher_guest, guest_contact, guest_busy
create or replace function public.place_checkout_order(p_order jsonb, p_lead jsonb default null,
                                                       p_voucher_id uuid default null, p_discount int default 0)
  returns setof public.orders
  language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := nullif(p_order ->> 'user_id', '')::uuid;
  v_guest  boolean := v_uid is null and coalesce((p_order ->> 'guest')::boolean, false);
  v_nonce  text := nullif(p_order ->> 'nonce', '');
  v_phone  text := nullif(p_order ->> 'contact_phone', '');
  v_email  text := nullif(lower(btrim(coalesce(p_order ->> 'contact_email', ''))), '');
  v_order  public.orders%rowtype;
  v_vouch  public.vouchers%rowtype;
  v_used   int;
  v_lead   uuid;
begin
  if v_nonce is null or (v_uid is null and not v_guest) then
    raise exception 'user_id (or guest) and nonce are required' using errcode = '22023';
  end if;
  if v_guest and (v_phone is null or v_phone !~ '^[6-9][0-9]{9}$') then
    raise exception 'guest orders need a 10-digit mobile number' using errcode = '22023', hint = 'guest_contact';
  end if;

  -- idempotency: the same checkout submitted twice returns the first order
  if v_guest then
    select * into v_order from public.orders o where o.user_id is null and o.guest and o.nonce = v_nonce;
  else
    select * into v_order from public.orders o where o.user_id = v_uid and o.nonce = v_nonce;
  end if;
  if found then
    return next v_order;
    return;
  end if;

  -- flood guard for anonymous orders (the route's in-memory limiter is per serverless instance only):
  -- max 5 guest orders per phone per hour, max 40 guest orders site-wide per 10 minutes
  if v_guest then
    if (select count(*) from public.orders o
         where o.guest and o.contact_phone = v_phone and o.created_at > now() - interval '1 hour') >= 5
       or (select count(*) from public.orders o
         where o.guest and o.created_at > now() - interval '10 minutes') >= 40 then
      raise exception 'too many guest orders' using errcode = 'P0001', hint = 'guest_busy';
    end if;
  end if;

  if p_voucher_id is not null then
    select * into v_vouch from public.vouchers v where v.id = p_voucher_id for update;
    if not found then raise exception 'voucher not found' using errcode = 'P0001', hint = 'voucher_invalid'; end if;
    if not v_vouch.active then raise exception 'voucher paused' using errcode = 'P0001', hint = 'voucher_inactive'; end if;
    -- a voucher meant for one person's email needs that person's verified login — never a typed-in guest email
    if v_guest and v_vouch.assigned_email is not null then
      raise exception 'voucher is tied to an account' using errcode = 'P0001', hint = 'voucher_invalid';
    end if;
    -- "N per customer" can't be enforced on an unverified typed phone (a new number = a new customer) → guests can't
    -- use those; only vouchers with a global usage_limit (or none) work without a login
    if v_guest and v_vouch.per_user_limit is not null then
      raise exception 'voucher needs an account' using errcode = 'P0001', hint = 'voucher_guest';
    end if;
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
    if v_vouch.per_user_limit is not null and not v_guest then
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
    insert into public.orders (user_id, guest, nonce, lead_id, email, contact_email, contact_phone, name, city, contact,
                               note, src, status, items, totals, subtotal, savings, discount, gift_fee, total, address,
                               gift, voucher_code)
    values (v_uid, v_guest, v_nonce, v_lead, p_order ->> 'email', v_email, v_phone, p_order ->> 'name',
            p_order ->> 'city', p_order ->> 'contact', p_order ->> 'note', p_order ->> 'src', 'placed',
            coalesce(p_order -> 'items', '[]'::jsonb), p_order -> 'totals',
            (p_order ->> 'subtotal')::int, (p_order ->> 'savings')::int, coalesce((p_order ->> 'discount')::int, 0),
            coalesce((p_order ->> 'gift_fee')::int, 0), (p_order ->> 'total')::int, p_order -> 'address', p_order -> 'gift',
            case when p_voucher_id is null then null else v_vouch.code end)
    returning * into v_order;
  exception when unique_violation then
    -- a concurrent duplicate of the same checkout won the race: hand back that order (this run rolls back)
    if v_guest then
      select * into v_order from public.orders o where o.user_id is null and o.guest and o.nonce = v_nonce;
    else
      select * into v_order from public.orders o where o.user_id = v_uid and o.nonce = v_nonce;
    end if;
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

-- ================================================================ claim_guest_orders
-- Links this account's guest orders. Returns how many were linked. SERVICE ROLE ONLY (the app calls it from the
-- /auth/callback route right after an email link / OTP / Google sign-in).
--   p_email_proven = true only when THIS login proved control of the inbox (email link, OTP, Google OAuth). A password
--   sign-up with "Confirm email" off sets email_confirmed_at without any proof, so email_confirmed_at alone never
--   counts. Without p_email_proven, a Google identity whose provider-verified email equals the auth email also counts.
--   No phone matching: profiles.phone is typed by the shopper and never verified.
drop function if exists public.claim_guest_orders(uuid);
create or replace function public.claim_guest_orders(p_user_id uuid, p_email_proven boolean default false) returns int
  language plpgsql security definer set search_path = '' as $$
declare
  v_email  text;
  v_conf   timestamptz;
  v_n      int := 0;
begin
  if p_user_id is null then return 0; end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_conf from auth.users u where u.id = p_user_id;
  if not found or v_email is null or v_conf is null or v_email like '%@users.the-escape-door.local' then return 0; end if;

  if not coalesce(p_email_proven, false) and not exists (
    select 1 from auth.identities i
     where i.user_id = p_user_id and i.provider = 'google'
       and lower(i.identity_data ->> 'email') = v_email
       and coalesce((i.identity_data ->> 'email_verified')::boolean, false)
  ) then
    return 0;
  end if;

  with linked as (
    update public.orders o
       set user_id = p_user_id
     where o.user_id is null
       and o.guest
       and lower(o.contact_email) = v_email
       -- never collide with the account's own (user_id, nonce) idempotency key
       and not exists (select 1 from public.orders x where x.user_id = p_user_id and x.nonce = o.nonce)
    returning o.id
  ), redemptions as (
    update public.voucher_redemptions r
       set user_id = p_user_id
      from linked l
     where r.order_id = l.id and r.user_id is null
    returning r.id
  )
  select count(*) into v_n from linked;
  return v_n;
end $$;
revoke all on function public.claim_guest_orders(uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_guest_orders(uuid, boolean) to service_role;

-- ================================================================ post-conditions (whole run rolls back if any fails)
do $$
begin
  if has_function_privilege('anon', 'public.place_checkout_order(jsonb, jsonb, uuid, int)', 'execute')
     or has_function_privilege('authenticated', 'public.place_checkout_order(jsonb, jsonb, uuid, int)', 'execute') then
    raise exception 'Post-check failed: place_checkout_order must be service-role only.';
  end if;
  if has_function_privilege('anon', 'public.claim_guest_orders(uuid, boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.claim_guest_orders(uuid, boolean)', 'execute') then
    raise exception 'Post-check failed: claim_guest_orders must be service-role only.';
  end if;
  if to_regprocedure('public.claim_guest_orders(uuid)') is not null then
    raise exception 'Post-check failed: the old one-argument claim_guest_orders(uuid) still exists.';
  end if;
  if has_table_privilege('anon', 'public.orders', 'select') or has_table_privilege('anon', 'public.orders', 'insert') then
    raise exception 'Post-check failed: anon must have no access to public.orders.';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'orders own read') then
    raise exception 'Post-check failed: "orders own read" policy (0006) is missing.';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'orders_guest_nonce_key') then
    raise exception 'Post-check failed: guest idempotency index missing.';
  end if;
end $$;

-- ================================================================ checks (read-only; uncomment to verify)
-- select id, order_no, guest, user_id, contact_phone, contact_email, status from public.orders order by created_at desc limit 10;
-- select public.claim_guest_orders('<user uuid>', false);  -- false: links only via a verified Google identity
