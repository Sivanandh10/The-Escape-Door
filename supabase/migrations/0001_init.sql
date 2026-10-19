-- The Escape Door — initial schema. Owner: F2. CONTRACTS §4.
-- Run in the Supabase SQL editor (or `supabase db push`), then run supabase/seed.sql.
-- Model:
--   * catalogue tables: public (anon) SELECT of published rows; owner-only writes (is_admin()).
--   * leads / orders / analytics_events: NO anon access at all — the Next route /api/lead and the
--     Netlify function `track` insert with the service role after validation. Owner reads.
--   * admins(user_id): whoever is listed here is an owner. Add the owner after creating their
--     auth user:  insert into public.admins (user_id) select id from auth.users where email = '<owner email>';
--   * Safe to re-run after 0002_roles.sql: when public.has_perm() exists, the is_admin()-based write
--     policies below are dropped/skipped instead of recreated (roles stay in charge).
--   * Storage: product-images (public read), custom-uploads (private; uploads via signed URLs
--     from /api/upload-url, so visitors need no storage policy).

-- gen_random_uuid() is built into Postgres 13+ (no extension needed).

-- ================================================================ helpers
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.touch_updated_at() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ================================================================ catalogue
create table if not exists public.collections (
  slug          text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name          text not null,
  jp            text not null default '',
  group_type    text not null default 'anime' check (group_type in ('anime', 'beyond')),
  accent_a      text not null default '#6D3BFF',
  accent_b      text not null default '#FFE14D',
  motif         text not null default 'speedlines'
                check (motif in ('smoke', 'walls', 'flames', 'waves', 'spiral', 'ribbons', 'speedlines')),
  tagline       text not null default '',
  blurb         text not null default '',
  sort_order    int  not null default 0,
  featured      boolean not null default false,
  sub_fandoms   text[] not null default '{}',
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.products (
  id               text primary key default ('p-' || replace(gen_random_uuid()::text, '-', '')),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text not null,
  type             text not null check (type in ('tshirt','hoodie','polaroid','bookmark','poster','badge','sticker',
                     'keychain','cosplay','katana','figurine','cape','accessory','hat','tote','stationery')),
  collection       text not null references public.collections (slug) on update cascade on delete restrict,
  tags             text[] not null default '{}',
  design_title     text not null,
  jp_title         text,
  description      text not null default '',
  images           jsonb not null default '[]'::jsonb,   -- ProductImage[]
  variants         jsonb not null default '[]'::jsonb,   -- Variant[] {id,label,price|null,attrs?}
  sizes            text[],
  price_from       int check (price_from is null or price_from >= 0),
  price_on_request boolean not null default false,
  bundle_rule_id   text,
  customizable     boolean not null default false,
  featured         boolean not null default false,
  drop_of_week     boolean not null default false,
  stock            text not null default 'in' check (stock in ('in', 'low', 'out', 'made-to-order')),
  color_block      text not null default '#C9B8FF',
  sort_order       int  not null default 0,
  is_published     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint variants_is_array check (jsonb_typeof(variants) = 'array'),
  constraint images_is_array check (jsonb_typeof(images) = 'array')
);
create index if not exists products_collection_idx on public.products (collection) where is_published;
create index if not exists products_type_idx on public.products (type) where is_published;
create index if not exists products_featured_idx on public.products (featured) where is_published and featured;
create index if not exists products_tags_idx on public.products using gin (tags);
-- at most one Drop of the Week
create unique index if not exists products_one_drop_idx on public.products (drop_of_week) where drop_of_week;

create table if not exists public.bundle_rules (
  id                 text primary key,
  label              text not null,
  applies_type       text not null,
  variant_attr_key   text,
  variant_attr_value text,
  kind               text not null check (kind in ('nForPrice', 'buyXgetY')),
  n                  int  not null check (n > 0),
  price              int,
  free               int,
  active             boolean not null default true,
  updated_at         timestamptz not null default now()
);

create table if not exists public.custom_rules (
  type        text primary key,
  min_qty     int  not null default 1 check (min_qty > 0),
  unit_price  int,
  note        text not null default '',
  updated_at  timestamptz not null default now()
);

create table if not exists public.events (
  id            text primary key default ('ev-' || replace(gen_random_uuid()::text, '-', '')),
  name          text not null,
  venue         text not null default '',
  city          text not null default '',
  start_date    date,          -- null until the owner confirms the date WITH a year
  end_date      date,
  date_label    text not null default '',
  confirmed     boolean not null default false,
  kind          text not null default 'stall' check (kind in ('stall', 'popup', 'fest', 'online')),
  status        text not null default 'upcoming' check (status in ('upcoming', 'past')),
  sort_order    int  not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.partnerships (
  id            text primary key default ('pt-' || replace(gen_random_uuid()::text, '-', '')),
  fest          text not null,
  institution   text not null default '',
  years         text not null default '',
  role          text not null default '',
  detail        text,
  sort_order    int  not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.insta_posts (
  id            text primary key default ('ig-' || replace(gen_random_uuid()::text, '-', '')),
  image         text not null,
  url           text not null,
  caption       text not null default '',
  sort_order    int  not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- key/value JSON settings: 'site' (SiteSettings), 'hoodie_tiers', 'tee_fits', 'apparel_custom'
create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ================================================================ leads, orders, analytics
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('whatsapp_order', 'custom_request', 'remind_me', 'newsletter', 'exit_intent')),
  name        text check (char_length(name) <= 80),
  city        text check (char_length(city) <= 80),
  contact     text check (char_length(contact) <= 120),
  message     text check (char_length(message) <= 2000),
  payload     jsonb,
  source      jsonb,
  src         text,
  visitor_id  text,
  status      text not null default 'new' check (status in ('new', 'contacted', 'converted', 'closed', 'spam')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_kind_idx on public.leads (kind, created_at desc);
create index if not exists leads_src_idx on public.leads (src) where src is not null;

create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references public.leads (id) on delete set null,
  items       jsonb not null default '[]'::jsonb,   -- CartItem[]
  totals      jsonb,                                 -- CartTotals snapshot
  subtotal    int,
  savings     int,
  total       int,
  name        text,
  city        text,
  contact     text,
  note        text,
  src         text,
  status      text not null default 'new' check (status in ('new', 'confirmed', 'paid', 'shipped', 'delivered', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);

-- No IP addresses, no user agents. Country / region / city come from Netlify context.geo.
create table if not exists public.analytics_events (
  id            bigint generated always as identity primary key,
  ts            timestamptz not null default now(),
  received_at   timestamptz not null default now(),
  visitor_id    text not null,
  session_id    text not null,
  name          text not null,
  path          text not null,
  props         jsonb,
  src           text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  referrer      text,
  landing       text,
  device        text,
  country       text,
  region        text,
  city          text
);
create index if not exists ae_ts_idx on public.analytics_events (ts desc);
create index if not exists ae_name_ts_idx on public.analytics_events (name, ts desc);
create index if not exists ae_path_idx on public.analytics_events (path);
create index if not exists ae_src_idx on public.analytics_events (src) where src is not null;
create index if not exists ae_visitor_idx on public.analytics_events (visitor_id);

-- ================================================================ updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['collections','products','bundle_rules','custom_rules','events','partnerships',
                           'insta_posts','settings','leads','orders'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ================================================================ RLS
alter table public.collections      enable row level security;
alter table public.products         enable row level security;
alter table public.bundle_rules     enable row level security;
alter table public.custom_rules     enable row level security;
alter table public.events           enable row level security;
alter table public.partnerships     enable row level security;
alter table public.insta_posts      enable row level security;
alter table public.settings         enable row level security;
alter table public.leads            enable row level security;
alter table public.orders           enable row level security;
alter table public.analytics_events enable row level security;

-- catalogue: public read (published), owner everything.
-- Once 0002_roles.sql has run (public.has_perm exists), is_admin() means "any team member", so the
-- "owner all" write policies are NOT recreated: re-running this file must never hand viewers / editors
-- full write access. 0002's has_perm() policies stay in charge.
do $$
declare
  t text;
  roles_on boolean := to_regprocedure('public.has_perm(text)') is not null;
begin
  foreach t in array array['collections','products','events','partnerships','insta_posts'] loop
    execute format('drop policy if exists "public read published" on public.%I', t);
    execute format('create policy "public read published" on public.%I for select to anon, authenticated using (is_published)', t);
    execute format('drop policy if exists "owner all" on public.%I', t);
    if not roles_on then
      execute format('create policy "owner all" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    end if;
  end loop;
  foreach t in array array['bundle_rules','custom_rules','settings'] loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "owner all" on public.%I', t);
    if not roles_on then
      execute format('create policy "owner all" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    end if;
  end loop;
  -- private tables: owner only (inserts come from the service role, which bypasses RLS)
  foreach t in array array['leads','orders','analytics_events'] loop
    execute format('drop policy if exists "owner all" on public.%I', t);
    if not roles_on then
      execute format('create policy "owner all" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    end if;
  end loop;
end $$;

-- ================================================================ storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/avif', 'image/webp', 'image/jpeg', 'image/png']),
  ('custom-uploads', 'custom-uploads', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product images public read" on storage.objects;
create policy "product images public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');
-- Owner write / private read policies. Skipped once 0002_roles.sql has run: it owns these policy names
-- (has_perm-based), and recreating them with is_admin() would give every team member full access.
do $$
begin
  if to_regprocedure('public.has_perm(text)') is not null then
    return;
  end if;
  drop policy if exists "product images owner write" on storage.objects;
  create policy "product images owner write" on storage.objects for insert to authenticated
    with check (bucket_id = 'product-images' and (select public.is_admin()));
  drop policy if exists "product images owner update" on storage.objects;
  create policy "product images owner update" on storage.objects for update to authenticated
    using (bucket_id = 'product-images' and (select public.is_admin()));
  drop policy if exists "product images owner delete" on storage.objects;
  create policy "product images owner delete" on storage.objects for delete to authenticated
    using (bucket_id = 'product-images' and (select public.is_admin()));

  drop policy if exists "custom uploads owner read" on storage.objects;
  create policy "custom uploads owner read" on storage.objects for select to authenticated
    using (bucket_id = 'custom-uploads' and (select public.is_admin()));
  drop policy if exists "custom uploads owner delete" on storage.objects;
  create policy "custom uploads owner delete" on storage.objects for delete to authenticated
    using (bucket_id = 'custom-uploads' and (select public.is_admin()));
end $$;

-- ================================================================ admin KPI views
-- security_invoker → the caller's RLS applies (only owners can read analytics/leads).
create or replace view public.v_daily_visits with (security_invoker = true) as
select date_trunc('day', ts at time zone 'Asia/Kolkata')::date as day,
       count(*) filter (where name = 'page_view')           as pageviews,
       count(distinct visitor_id)                            as visitors,
       count(distinct session_id)                            as sessions
from public.analytics_events
where ts > now() - interval '90 days'
group by 1
order by 1 desc;

create or replace view public.v_top_pages with (security_invoker = true) as
select path,
       count(*) filter (where name = 'page_view')                   as views,
       count(distinct visitor_id) filter (where name = 'page_view') as visitors,
       round(avg((props ->> 'ms')::numeric) filter (where name = 'page_leave') / 1000, 1) as avg_seconds
from public.analytics_events
where ts > now() - interval '30 days' and name in ('page_view', 'page_leave')
group by path
order by views desc
limit 100;

create or replace view public.v_top_collections with (security_invoker = true) as
select coalesce(props ->> 'slug', substring(path from '^/arc/([a-z0-9-]+)')) as collection,
       count(*)                   as opens,
       count(distinct visitor_id) as visitors
from public.analytics_events
where ts > now() - interval '30 days'
  and (name = 'collection_open' or (name = 'page_view' and path like '/arc/%'))
group by 1
having coalesce(props ->> 'slug', substring(path from '^/arc/([a-z0-9-]+)')) is not null
order by opens desc;

create or replace view public.v_top_products with (security_invoker = true) as
select coalesce(props ->> 'slug', substring(path from '^/product/([a-z0-9-]+)')) as product,
       count(*) filter (where name in ('product_view', 'page_view')) as views,
       count(*) filter (where name = 'add_to_cart')                  as adds,
       count(*) filter (where name = 'wishlist_add')                 as wishlists
from public.analytics_events
where ts > now() - interval '30 days'
  and (name in ('product_view', 'add_to_cart', 'wishlist_add') or (name = 'page_view' and path like '/product/%'))
group by 1
having coalesce(props ->> 'slug', substring(path from '^/product/([a-z0-9-]+)')) is not null
order by views desc, adds desc;

create or replace view public.v_funnel with (security_invoker = true) as
select count(distinct visitor_id)                                                as visitors,
       count(distinct visitor_id) filter (where name in ('product_view') or (name = 'page_view' and path like '/product/%')) as product_viewers,
       count(distinct visitor_id) filter (where name = 'add_to_cart')            as added_to_cart,
       count(distinct visitor_id) filter (where name = 'checkout_start')         as started_checkout,
       count(distinct visitor_id) filter (where name = 'whatsapp_click')         as clicked_whatsapp,
       count(distinct visitor_id) filter (where name = 'custom_submit')          as custom_requests
from public.analytics_events
where ts > now() - interval '30 days';

create or replace view public.v_attribution with (security_invoker = true) as
select coalesce(src, utm_source, '(direct)') as source,
       count(distinct visitor_id)            as visitors,
       count(distinct visitor_id) filter (where name = 'add_to_cart')    as added_to_cart,
       count(distinct visitor_id) filter (where name = 'whatsapp_click') as clicked_whatsapp
from public.analytics_events
where ts > now() - interval '90 days'
group by 1
order by visitors desc;

create or replace view public.v_geo with (security_invoker = true) as
select coalesce(country, '??') as country, coalesce(region, '') as region, coalesce(city, '') as city,
       count(distinct visitor_id) as visitors
from public.analytics_events
where ts > now() - interval '30 days'
group by 1, 2, 3
order by visitors desc
limit 200;

create or replace view public.v_leads_daily with (security_invoker = true) as
select date_trunc('day', created_at at time zone 'Asia/Kolkata')::date as day, kind, coalesce(src, '(direct)') as source,
       count(*) as leads
from public.leads
where created_at > now() - interval '90 days'
group by 1, 2, 3
order by 1 desc;

-- Views are reachable by authenticated users only; RLS on the base tables limits them to owners.
revoke all on public.v_daily_visits, public.v_top_pages, public.v_top_collections, public.v_top_products,
              public.v_funnel, public.v_attribution, public.v_geo, public.v_leads_daily from anon;
grant select on public.v_daily_visits, public.v_top_pages, public.v_top_collections, public.v_top_products,
               public.v_funnel, public.v_attribution, public.v_geo, public.v_leads_daily to authenticated;

-- ================================================================ housekeeping
-- Optional: keep analytics within the free 500 MB DB. Run monthly (or via pg_cron if enabled):
--   delete from public.analytics_events where ts < now() - interval '180 days';
