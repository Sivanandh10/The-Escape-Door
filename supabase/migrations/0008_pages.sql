-- The Escape Door — Pages CMS (editable policy / info pages) + Realtime for the admin dashboard and lead inbox.
-- Idempotent: safe to run again (never overwrites a page someone already edited).
-- Run in the Supabase SQL editor AFTER 0004_perms.sql (the policies below use has_perm('pages.edit')).
--
-- What it does
--   1. public.pages (slug pk, title, description, body_md, updated_at, updated_by, updated_by_name)
--      seeded with the CURRENT built-in policy texts (src/components/content/policies.tsx, converted to the
--      CMS markdown dialect — facts identical). Existing rows are left alone (on conflict do nothing).
--   2. RLS: everyone reads; insert/update need has_perm('pages.edit'); DELETE is superadmin only
--      (same permissive + RESTRICTIVE pair as 0003). Anonymous visitors can read only the public columns
--      (who edited a page is not exposed to the site).
--   3. Adds leads, orders and analytics_events to the supabase_realtime publication so the admin dashboard
--      and the lead inbox update live. Realtime still applies RLS per subscriber (analytics rows only reach
--      members with analytics.view, leads with leads.view, orders with orders.view); everyone else polls.
--
-- Site behaviour: /policies/<slug> reads this table (cache tag 'pages'; Admin → Pages saves refresh it at
-- once). A missing row falls back to the built-in text, so deleting a built-in page = "reset to built-in".

-- ================================================================ pre-condition: 0002 + 0003 + 0004
do $$
begin
  if to_regprocedure('public.has_perm(text)') is null or to_regprocedure('public.admin_role()') is null then
    raise exception 'Run supabase/migrations/0002_roles.sql first (public.has_perm / public.admin_role are missing).';
  end if;
  if to_regprocedure('public.is_superadmin()') is null then
    raise exception 'Run supabase/migrations/0003_superadmin_delete.sql first (public.is_superadmin is missing).';
  end if;
  if not ('pages.edit' = any (public.role_perms('admin'))) then
    raise exception 'Run supabase/migrations/0004_perms.sql first (the pages.edit permission is missing).';
  end if;
end $$;

-- ================================================================ table
create table if not exists public.pages (
  slug             text primary key check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  title            text not null check (char_length(title) between 1 and 120),
  description      text not null default '' check (char_length(description) <= 300),
  body_md          text not null default '' check (char_length(body_md) <= 60000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  updated_by_name  text check (char_length(updated_by_name) <= 80)
);

drop trigger if exists pages_touch on public.pages;
create trigger pages_touch before update on public.pages for each row execute function public.touch_updated_at();

-- ================================================================ RLS
alter table public.pages enable row level security;

drop policy if exists "pages public read" on public.pages;
create policy "pages public read" on public.pages for select to anon, authenticated using (true);

drop policy if exists "pages editors insert" on public.pages;
create policy "pages editors insert" on public.pages for insert to authenticated
  with check ((select public.has_perm('pages.edit')));

drop policy if exists "pages editors update" on public.pages;
create policy "pages editors update" on public.pages for update to authenticated
  using ((select public.has_perm('pages.edit'))) with check ((select public.has_perm('pages.edit')));

drop policy if exists "superadmin delete" on public.pages;
create policy "superadmin delete" on public.pages for delete to authenticated
  using ((select public.admin_role()) = 'superadmin');

drop policy if exists "only superadmin deletes" on public.pages;
create policy "only superadmin deletes" on public.pages as restrictive for delete
  using ((select public.admin_role()) = 'superadmin');

-- Anonymous visitors: public columns only (no editor id / name), and no writes at all.
revoke all on public.pages from anon;
grant select (slug, title, description, body_md, created_at, updated_at) on public.pages to anon;
grant select, insert, update, delete on public.pages to authenticated;
grant all on public.pages to service_role;

-- ================================================================ seed (current built-in texts, reviewed 19 Oct 2026)
-- updated_at is set explicitly so the public "Last updated" stamp stays truthful (the trigger only runs on UPDATE).
insert into public.pages (slug, title, description, body_md, created_at, updated_at)
select v.slug, v.title, v.description, v.body_md, '2026-10-19T00:00:00+05:30'::timestamptz, '2026-10-19T00:00:00+05:30'::timestamptz
from (values
  ('privacy', 'Privacy policy', 'What The Escape Door collects (form details, anonymous analytics, custom uploads), why, where it is stored, and your rights under the DPDP Act 2023.', $md$We collect as little as we can: what you type into a form so we can reply, and anonymous page statistics. No advertising cookies, no fingerprinting, and we never store your IP address.

## What we *collect* {#collect}

**When you fill in a form** (WhatsApp checkout, Design Your Own, stall reminder, drop alerts, fest partnership or contact): your name, city, WhatsApp number or email, and your message. A WhatsApp order also saves the items and totals in your cart. A custom order saves your design brief and the files you upload.

**Anonymous analytics:** a random visitor ID kept in your browser (localStorage) and a session ID (localStorage, renewed after 30 minutes of inactivity), the pages you view and actions such as add to cart or WhatsApp click, how you arrived (campaign tags, a fest QR code or the referring website's domain), your device type (mobile, tablet or desktop) and an approximate country, region and city provided by our host. We do not store your IP address or browser user agent.

**Your cart and wishlist** live only in your browser until you choose to check out.

If your browser sends **Do Not Track** or **Global Privacy Control**, analytics are switched off.

## Why we *use* it {#use}

- To reply to you and confirm your order, custom request or fest enquiry on WhatsApp or email.
- To make the custom item you asked for from the files you sent.
- To remind you about a stall or a new drop, only if you asked us to.
- To see which pages and products are useful, in aggregate, so we can improve the site.

## Where it is *stored* {#where}

Form details and analytics are stored in our database on Supabase. Custom-order files go to a private Supabase storage bucket; we view them through signed links that expire after 7 days. The site is hosted on Netlify.

When you tap a WhatsApp button, your order message opens in WhatsApp, which is run by Meta under its own privacy policy. Links to Instagram work the same way.

## How long we *keep* it {#retention pending}

Our analytics dashboards look at the last 90 days. Exact retention periods for form details and uploaded files are being finalised. Until they are published, you can ask us to delete your details at any time.

## Your *rights* {#rights}

Under India's Digital Personal Data Protection Act, 2023, you can:

- ask what personal data we hold about you and how we use it;
- ask us to correct, complete, update or erase it;
- withdraw consent you gave earlier, for example for drop alerts;
- raise a grievance with us, and if it is not resolved, with the Data Protection Board of India;
- nominate someone to exercise these rights for you.

To use any of these, write to us through the [contact page](/contact) or a DM to [@escapedoor.in](https://www.instagram.com/escapedoor.in).

## Grievance *contact* {#grievance pending}

Our business name, address and grievance contact email are being finalised and will be listed here. Until then, use the [contact page](/contact) and we will respond.

## Under *18*? {#children}

If you are under 18, please ask a parent or guardian before you send us your details.
$md$),
  ('shipping', 'Shipping policy', 'How Escape Door orders work: you send your cart on WhatsApp and we confirm the price, payment and delivery with you. Shipping details are being finalised.', $md$Orders are confirmed one by one on WhatsApp, so the details for your order are always agreed in the chat before you pay. Our standard shipping terms are being finalised.

## How an order *works* {#how}

1. Add items to your cart and tap “Buy on WhatsApp”. Your cart is sent to us as a message.
2. We confirm availability, the final price for items sold in a price range, payment and delivery details in the chat.
3. Your order is confirmed once we both agree in the chat.

## How we *ship* {#ship pending}

Delivery areas, shipping charges, dispatch times and delivery times are being finalised. Message us on WhatsApp or Instagram before you order and we will tell you what applies to your city.

## Cash on *delivery* {#cod pending}

Whether cash on delivery is available is being finalised. Ask us in the chat when you order.

## Custom *orders* {#custom}

Custom items are made to order from your design, so the timeline depends on the item and quantity. We confirm it with you on WhatsApp before we start. See [Design Your Own](/custom).

## Buying at a *stall* {#stalls}

At a fest stall you buy in person and take your merch home the same day. See [upcoming stalls](/fests#live).
$md$),
  ('returns', 'Returns & exchanges', 'Returns and exchanges at The Escape Door: our policy is being finalised. If an item arrives damaged or wrong, message us on WhatsApp with photos.', $md$Our return and exchange policy is being finalised. Here is what to do in the meantime.

## Something *wrong*? {#problem}

If an item arrives damaged, or is not what you ordered, message us on WhatsApp with your order details and a few photos, so we can look into it with you.

## Return *window* and conditions {#window pending}

The return window, which items can be returned or exchanged, and how refunds are paid are being finalised.

## Sizes and *exchanges* {#sizes pending}

Our size chart is coming soon. Until it is published, ask us on WhatsApp for measurements before you order a tee or hoodie. Whether size exchanges are possible is being finalised.

## Custom-made *items* {#custom pending}

Custom items are made to your design. How returns apply to them is being finalised.
$md$),
  ('terms', 'Terms of sale', 'Terms of sale at The Escape Door: original fan-inspired designs, prices in INR, orders confirmed on WhatsApp, and what to know about custom artwork.', $md$The short version of how buying from us works. Parts that are still being finalised are marked.

## Our *products* {#products}

We sell original, fan-inspired designs. We are not affiliated with, endorsed by or licensed by the creators, publishers or studios of any series named on this site. Series names only describe what a design is inspired by.

Some product images are sample mockups and are marked as samples. We confirm what the real item looks like before you pay.

Cosplay katanas and other props are costume and display pieces, not real weapons.

## *Prices* {#prices}

Prices are in Indian rupees (₹). Items shown with a price range, and items marked “price on request”, get an exact price from us on WhatsApp before you pay. Bundle deals such as 3 polaroids for ₹100 are applied in the cart.

## How orders are *confirmed* {#orders}

Sending your cart on WhatsApp is a request, not a finished purchase. An order is confirmed when we agree the items, price, payment and delivery with you in the chat.

## Your *artwork* {#artwork}

When you send a design for a custom order, send only artwork you have the right to use. We use your files only to make your order.

## Payments, shipping and *returns* {#payments pending}

Accepted payment methods are being finalised. Shipping and returns are covered on the [shipping](/policies/shipping) and [returns](/policies/returns) pages.
$md$)
) as v (slug, title, description, body_md)
on conflict (slug) do nothing;

-- ================================================================ Realtime (admin dashboard + lead inbox)
do $$
declare
  t text;
  all_tables boolean;
begin
  select puballtables into all_tables from pg_publication where pubname = 'supabase_realtime';
  if not found then
    raise notice 'Publication supabase_realtime not found — the admin falls back to polling every 30 s.';
    return;
  end if;
  if all_tables then
    return; -- already publishes every table
  end if;
  foreach t in array array['leads', 'orders', 'analytics_events'] loop
    if to_regclass('public.' || t) is not null and not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ================================================================ post-checks (any failure rolls the whole run back)
do $$
declare n int;
begin
  select count(*) into n from public.pages where slug in ('privacy', 'shipping', 'returns', 'terms');
  if n <> 4 then
    raise exception 'Post-check failed: expected the 4 built-in pages, found %.', n;
  end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'pages'
    and policyname in ('pages public read', 'pages editors insert', 'pages editors update', 'superadmin delete', 'only superadmin deletes');
  if n <> 5 then
    raise exception 'Post-check failed: expected 5 RLS policies on public.pages, found %.', n;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pages' and cmd in ('DELETE', 'ALL')
             and permissive = 'PERMISSIVE' and policyname <> 'superadmin delete') then
    raise exception 'Post-check failed: another policy on public.pages can delete — only the superadmin may.';
  end if;
  if has_column_privilege('anon', 'public.pages', 'updated_by', 'SELECT') then
    raise exception 'Post-check failed: anon can still read pages.updated_by.';
  end if;
end $$;
