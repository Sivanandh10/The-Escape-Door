-- The Escape Door — page drafts + honest policy copy + size charts (owner feedback #8:
-- "Size chart, shipping, COD, returns all say 'being finalised'"). Idempotent: safe to run again.
-- Run in the Supabase SQL editor AFTER 0008_pages.sql.
--
-- What it does
--   1. public.page_drafts — one unpublished working copy per page (slug pk; status 'draft' | 'published' | 'discarded').
--      Admin → Pages: "Save draft" upserts a row with status 'draft'; "Publish" copies it into public.pages and sets
--      status 'published'; "Discard draft" sets 'discarded'. No row is ever deleted by the editor flow (only the
--      superadmin may delete, as everywhere else). Drafts are NOT readable by visitors or shoppers: anon has no
--      grant at all, and authenticated users need has_perm('pages.edit') (RLS). The public site never reads it.
--   2. Seeds three UNPUBLISHED drafts — shipping (incl. cash on delivery), returns, terms — with typical Indian
--      D2C terms, each carrying the note "DRAFT — typical terms, not yet confirmed…". They are commitments, so they
--      only go live when the owner checks every number and presses Publish. Existing drafts are left alone.
--      Source of truth for the text: src/components/admin/pages/draftSeeds.ts.
--   3. Replaces the "being finalised" wording on the four live policy rows seeded by 0008 with clear, honest copy
--      (no invented numbers: delivery date, shipping charge, payment and COD are confirmed on WhatsApp before you
--      pay). ONLY rows nobody has edited in the admin (updated_by is null) that still say "being finalised" are
--      touched — a page the owner already edited is never overwritten.
--      Source of truth for the text: src/components/content/policies.tsx.
--   4. Size charts: no table — they live in public.settings under key 'size_charts' (public read, written only by
--      the saveSettingValue() server action with catalog.edit). Shape:
--        { "charts": { "oversized" | "regular" | "baby" | "hoodie": [ { "size": "M", "chest": 44, "length": 29,
--          "shoulder": 22 } ] }, "note": "" }   (inches, garment measurements)
--      NOTHING is seeded: measurements are business facts the owner enters in Admin → Pricing → Size charts. Until
--      then the product page shows "Tell us your usual size on WhatsApp and we'll match the fit".

-- ================================================================ pre-conditions
do $$
begin
  if to_regclass('public.pages') is null then
    raise exception 'Run supabase/migrations/0008_pages.sql first (public.pages is missing).';
  end if;
  if to_regprocedure('public.has_perm(text)') is null or to_regprocedure('public.admin_role()') is null then
    raise exception 'Run supabase/migrations/0002_roles.sql first (public.has_perm / public.admin_role are missing).';
  end if;
  if to_regprocedure('public.touch_updated_at()') is null then
    raise exception 'Run supabase/migrations/0001_init.sql first (public.touch_updated_at is missing).';
  end if;
  if to_regclass('public.settings') is null then
    raise exception 'Run supabase/migrations/0001_init.sql first (public.settings is missing).';
  end if;
end $$;

-- ================================================================ 1. page_drafts
create table if not exists public.page_drafts (
  slug             text primary key check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  title            text not null check (char_length(title) between 1 and 120),
  description      text not null default '' check (char_length(description) <= 300),
  body_md          text not null check (char_length(body_md) between 1 and 60000),
  note             text not null default '' check (char_length(note) <= 300),
  status           text not null default 'draft' check (status in ('draft', 'published', 'discarded')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  updated_by_name  text check (char_length(updated_by_name) <= 80)
);
create index if not exists page_drafts_status_idx on public.page_drafts (status);

drop trigger if exists page_drafts_touch on public.page_drafts;
create trigger page_drafts_touch before update on public.page_drafts for each row execute function public.touch_updated_at();

alter table public.page_drafts enable row level security;

drop policy if exists "page drafts editors read" on public.page_drafts;
create policy "page drafts editors read" on public.page_drafts for select to authenticated
  using ((select public.has_perm('pages.edit')));

drop policy if exists "page drafts editors insert" on public.page_drafts;
create policy "page drafts editors insert" on public.page_drafts for insert to authenticated
  with check ((select public.has_perm('pages.edit')));

drop policy if exists "page drafts editors update" on public.page_drafts;
create policy "page drafts editors update" on public.page_drafts for update to authenticated
  using ((select public.has_perm('pages.edit'))) with check ((select public.has_perm('pages.edit')));

drop policy if exists "superadmin delete" on public.page_drafts;
create policy "superadmin delete" on public.page_drafts for delete to authenticated
  using ((select public.admin_role()) = 'superadmin');

drop policy if exists "only superadmin deletes" on public.page_drafts;
create policy "only superadmin deletes" on public.page_drafts as restrictive for delete
  using ((select public.admin_role()) = 'superadmin');

revoke all on public.page_drafts from anon;
revoke all on public.page_drafts from public;
grant select, insert, update, delete on public.page_drafts to authenticated;
grant all on public.page_drafts to service_role;

-- ================================================================ 2. seed drafts (unpublished; never overwrites)
insert into public.page_drafts (slug, title, description, note, body_md, status)
select v.slug, v.title, v.description, v.note, v.body_md, 'draft'
from (values
  ('shipping', 'Shipping policy', 'Shipping across India: dispatch in 2–4 working days, delivery in 3–8 working days, ₹79 shipping (free above ₹999) and cash on delivery on eligible orders.', 'DRAFT — typical terms, not yet confirmed. Check every number (days, ₹, time windows) before publishing.', $md$We ship across India. Every order is confirmed on WhatsApp first, then packed and handed to our courier partner. Nothing is charged on this website.

## How an order *works* {#how}

1. Add items to your cart and tap “Buy on WhatsApp”. Your cart is sent to us as a message.
2. We confirm availability, the final price for items sold in a price range, the shipping charge and the delivery date in the chat.
3. You pay, we pack your order and send you the tracking link on WhatsApp.

## Dispatch *time* {#dispatch}

- Ready-stock items are packed and dispatched within 2–4 working days of payment.
- Made-to-order and custom pieces take 7–10 working days to make before dispatch. We confirm the date in the chat.

## Delivery *time* {#delivery}

After dispatch, most orders reach metro cities in 3–5 working days and other PIN codes in 5–8 working days. Remote areas can take longer. Courier delays during festivals, sales or bad weather are outside our control; we keep you updated in the chat.

## Shipping *charges* {#charges}

Shipping is ₹79 per order within India, and free on orders above ₹999. The exact total is confirmed in the chat before you pay.

## Cash on *delivery* {#cod}

- Prepaid orders (UPI or bank transfer) ship first.
- Cash on delivery is available on ready-stock orders up to ₹2,000 for serviceable PIN codes, with a ₹50 COD fee.
- Custom and made-to-order items are prepaid only.

## Custom *orders* {#custom}

Custom items are made to order from your design, so the timeline depends on the item and quantity. We confirm it with you on WhatsApp before we start. See [Design Your Own](/custom).

## Buying at a *stall* {#stalls}

At a fest stall you buy in person and take your merch home the same day. See [upcoming stalls](/fests#live).
$md$),
  ('returns', 'Returns & exchanges', 'Damaged or wrong item? Message us within 48 hours of delivery for a free replacement. Size exchanges on tees and hoodies within 7 days.', 'DRAFT — typical terms, not yet confirmed. Check every number (days, ₹, time windows) before publishing.', $md$Something not right with your order? Here is exactly how we fix it.

## Damaged or *wrong* item {#problem}

Message us on WhatsApp within 48 hours of delivery with your order details, an unboxing photo or video, and clear photos of the problem. Once we confirm it, we send a replacement at no cost to you, or a full refund if the item is out of stock.

## Size *exchanges* {#sizes}

Tees and hoodies can be exchanged for another size within 7 days of delivery, if they are unworn, unwashed and in their original packing. You pay the shipping both ways, the new size is subject to stock, and each order gets one exchange. Check the size chart on the product page before you order.

## What we can’t *take back* {#exclusions}

- Custom-made items, unless they arrive damaged or misprinted.
- Posters, polaroids, stickers, badges and bookmarks, unless they arrive damaged.
- Items bought at a fest stall: please check them at the stall before you leave.
- Change of mind returns.

## *Refunds* {#refunds}

Approved refunds are paid to your original payment method (UPI or bank account) within 5–7 working days of approval. Cash on delivery orders are refunded by UPI or bank transfer.

## Cancelling an *order* {#cancel}

You can cancel for a full refund until your order is dispatched. Custom orders can’t be cancelled once printing has started.
$md$),
  ('terms', 'Terms of sale', 'Terms of sale at The Escape Door: original fan-inspired designs, prices in INR including taxes, orders confirmed and paid on WhatsApp, shipping and returns.', 'DRAFT — typical terms, not yet confirmed. Check every number (days, ₹, time windows) before publishing. Add your business name, address and contact email under “Who we are”.', $md$The short version of how buying from us works.

## Our *products* {#products}

We sell original, fan-inspired designs. We are not affiliated with, endorsed by or licensed by the creators, publishers or studios of any series named on this site. Series names only describe what a design is inspired by.

Some product images are illustrated mockups; we confirm what the real item looks like before you pay.

Cosplay katanas and other props are costume and display pieces, not real weapons.

## *Prices* {#prices}

Prices are in Indian rupees (₹) and include all taxes. Items shown with a price range, and items marked “price on request”, get an exact price from us on WhatsApp before you pay. Bundle deals such as 3 polaroids for ₹100 are applied in the cart. Shipping is shown separately; see the [shipping policy](/policies/shipping).

## How orders are *confirmed* {#orders}

Sending your cart on WhatsApp is a request, not a finished purchase. An order is confirmed when we agree the items, price, payment and delivery with you in the chat and the payment is received (or cash on delivery is agreed).

## *Payments* {#payments}

We accept UPI and bank transfer, arranged on WhatsApp. Nothing is charged on this website. Cash on delivery is available on some orders; see the [shipping policy](/policies/shipping#cod).

## Shipping and *returns* {#shipping-returns}

Shipping times and charges are on the [shipping policy](/policies/shipping). Damaged items, size exchanges and refunds are on the [returns policy](/policies/returns).

## Your *artwork* {#artwork}

When you send a design for a custom order, send only artwork you have the right to use. We use your files only to make your order, and we may refuse a design that copies someone else’s work.

## Who we *are* {#about}

The Escape Door is run from India. Our business name, address and contact email will be listed here. These terms are governed by the laws of India.
$md$)
) as v (slug, title, description, note, body_md)
on conflict (slug) do nothing;

-- ================================================================ 3. honest live copy (only untouched 0008 seed rows)
update public.pages p
set description = v.description,
    body_md     = v.body_md
from (values
  ('privacy', 'What The Escape Door collects (form details, anonymous analytics, custom uploads), why, where it is stored, and your rights under the DPDP Act 2023.', $md$We collect as little as we can: what you type into a form so we can reply, and anonymous page statistics. No advertising cookies, no fingerprinting, and we never store your IP address.

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

## How long we *keep* it {#retention}

Our analytics dashboards look at the last 90 days. Form details and uploaded files are kept for as long as we need them to handle your order or request. You can ask us to delete your details at any time, and we will.

## Your *rights* {#rights}

Under India's Digital Personal Data Protection Act, 2023, you can:

- ask what personal data we hold about you and how we use it;
- ask us to correct, complete, update or erase it;
- withdraw consent you gave earlier, for example for drop alerts;
- raise a grievance with us, and if it is not resolved, with the Data Protection Board of India;
- nominate someone to exercise these rights for you.

To use any of these, write to us through the [contact page](/contact) or a DM to [@escapedoor.in](https://www.instagram.com/escapedoor.in).

## Grievance *contact* {#grievance}

For any privacy question, request or complaint, write to us through the [contact page](/contact) or send a DM to [@escapedoor.in](https://www.instagram.com/escapedoor.in). Say it is a privacy request and we will reply to you there.

## Under *18*? {#children}

If you are under 18, please ask a parent or guardian before you send us your details.
$md$),
  ('shipping', 'We ship within India. Send your cart on WhatsApp and we confirm the delivery date, shipping charge and payment with you before you pay.', $md$We ship within India. Every order is confirmed one by one on WhatsApp, so the delivery date and the shipping charge for your address are agreed with you in the chat before you pay. Nothing is charged on this website.

## How an order *works* {#how}

1. Add items to your cart and tap “Buy on WhatsApp”. Your cart is sent to us as a message.
2. We confirm availability, the final price for items sold in a price range, the shipping charge and the delivery date in the chat.
3. You pay once you are happy with the total, and we pack your order.

## Delivery *date* and charges {#ship}

Delivery time and shipping charges depend on your PIN code and on what you order, so we tell you both in the chat before you pay. Need it by a certain day, for a birthday or a fest? Say so when you message us and we will tell you honestly if we can make it.

## Payment and cash on *delivery* {#cod}

Payment is arranged on WhatsApp after we confirm your order, for example by UPI. Prefer cash on delivery? Ask us in the chat with your PIN code and we will tell you whether it is possible for your order before you place it.

## Custom *orders* {#custom}

Custom items are made to order from your design, so the timeline depends on the item and quantity. We confirm it with you on WhatsApp before we start. See [Design Your Own](/custom).

## Buying at a *stall* {#stalls}

At a fest stall you buy in person and take your merch home the same day. See [upcoming stalls](/fests#live).
$md$),
  ('returns', 'Damaged, wrong item or the wrong size? Message The Escape Door on WhatsApp with a few photos and we sort it out with you in the chat.', $md$Something not right with your order? Message us on WhatsApp and we will sort it out with you. Every order is confirmed in the chat, so the same chat is where we fix anything that goes wrong.

## Damaged or *wrong* item {#problem}

If an item arrives damaged, or is not what you ordered, message us on WhatsApp as soon as it arrives with your order details and a few clear photos. We look at it with you and agree the fix in the chat.

## Getting the *size* right {#sizes}

Open the size chart on any tee or hoodie page before you order. Not sure between two sizes? Tell us your usual size on WhatsApp and we will match the fit for you before you pay. If the size you picked does not fit, message us and we will see what we can do.

## Custom-made *items* {#custom}

Custom items are made to your design. We share the design, size and spelling with you on WhatsApp before we print, so please check them carefully before you say yes.

## Bought at a *stall*? {#stalls}

Check your merch at the stall before you leave. If something is wrong after the fest, message us on WhatsApp or Instagram with a photo.
$md$),
  ('terms', 'Terms of sale at The Escape Door: original fan-inspired designs, prices in INR, orders confirmed on WhatsApp, and what to know about custom artwork.', $md$The short version of how buying from us works.

## Our *products* {#products}

We sell original, fan-inspired designs. We are not affiliated with, endorsed by or licensed by the creators, publishers or studios of any series named on this site. Series names only describe what a design is inspired by.

Some product images are illustrated mockups; we confirm what the real item looks like before you pay.

Cosplay katanas and other props are costume and display pieces, not real weapons.

## *Prices* {#prices}

Prices are in Indian rupees (₹). Items shown with a price range, and items marked “price on request”, get an exact price from us on WhatsApp before you pay. Bundle deals such as 3 polaroids for ₹100 are applied in the cart.

## How orders are *confirmed* {#orders}

Sending your cart on WhatsApp is a request, not a finished purchase. An order is confirmed when we agree the items, price, payment and delivery with you in the chat.

## Your *artwork* {#artwork}

When you send a design for a custom order, send only artwork you have the right to use. We use your files only to make your order.

## Payments, shipping and *returns* {#payments}

Nothing is charged on this website. Payment is arranged on WhatsApp once your order is confirmed. Shipping and returns are covered on the [shipping](/policies/shipping) and [returns](/policies/returns) pages.
$md$)
) as v (slug, description, body_md)
where p.slug = v.slug
  and p.updated_by is null
  and p.body_md ~* 'being finali[sz]ed';

-- ================================================================ post-checks (any failure rolls the whole run back)
do $$
declare n int;
begin
  select count(*) into n from public.page_drafts where slug in ('shipping', 'returns', 'terms');
  if n <> 3 then
    raise exception 'Post-check failed: expected the 3 seeded drafts, found %.', n;
  end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'page_drafts'
    and policyname in ('page drafts editors read', 'page drafts editors insert', 'page drafts editors update', 'superadmin delete', 'only superadmin deletes');
  if n <> 5 then
    raise exception 'Post-check failed: expected 5 RLS policies on public.page_drafts, found %.', n;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'page_drafts'
             and (roles @> array['anon']::name[] or roles @> array['public']::name[]) and cmd in ('SELECT', 'ALL')
             and permissive = 'PERMISSIVE') then
    raise exception 'Post-check failed: a policy lets visitors read public.page_drafts.';
  end if;
  if has_table_privilege('anon', 'public.page_drafts', 'select') then
    raise exception 'Post-check failed: anon can read public.page_drafts.';
  end if;
  if exists (select 1 from public.pages where slug in ('privacy', 'shipping', 'returns', 'terms')
             and updated_by is null and body_md ~* 'being finali[sz]ed') then
    raise exception 'Post-check failed: an untouched policy page still says "being finalised".';
  end if;
end $$;

-- Pages that an admin already edited and that still say "being finalised" (fix these in Admin → Pages):
select slug, title, updated_by_name, updated_at from public.pages where body_md ~* 'being finali[sz]ed';
