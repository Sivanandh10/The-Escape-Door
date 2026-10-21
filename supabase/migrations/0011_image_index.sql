-- The Escape Door — visual search ("search with a photo") image index. Owner: SEARCH.
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor AFTER 0004_perms.sql (needs has_perm).
--
-- What it adds
--   public.product_image_embeddings   one row per (product, image URL, model): a 512-d MobileCLIP S0 image embedding,
--                                      L2-normalised, int8-quantised, base64 (684 chars). Derived data: it can always
--                                      be rebuilt from the product images (scripts/build-image-index.mts, or Admin →
--                                      Products → "Rebuild image search index").
--   RLS                                public SELECT (embeddings reveal nothing beyond the public product images);
--                                      INSERT / UPDATE only for team members with catalog.edit (has_perm) — the app
--                                      itself writes with the service role after its own catalog.edit check.
--                                      NO delete policy: browsers can't delete rows at all. Removing the rows of a
--                                      removed / replaced image is done by the server action
--                                      replaceImageEmbeddings() (src/components/admin/crud/imageIndexActions.ts)
--                                      with the service role after checkPerm('catalog.edit').
--   DOCUMENTED EXCEPTION to the "only the superadmin deletes" rule (0003): these rows are a cache of derived
--   vectors, not business data. Deleting one loses nothing (it is recomputed from the image on the next save /
--   rebuild), so catalog.edit may replace them. Products themselves are still deleted by the superadmin only; their
--   embeddings go with them (on delete cascade).
--   The storefront reads them through GET /api/image-index (published products only, cached with the 'products'
--   and 'image-index' tags).

-- ================================================================ pre-conditions
do $$
begin
  if to_regclass('public.products') is null then
    raise exception 'Run supabase/migrations/0001_init.sql first (public.products is missing).';
  end if;
  if to_regprocedure('public.has_perm(text)') is null then
    raise exception 'Run supabase/migrations/0002_roles.sql first (public.has_perm is missing).';
  end if;
end $$;

-- ================================================================ table
create table if not exists public.product_image_embeddings (
  product_id  text        not null references public.products (id) on update cascade on delete cascade,
  image_src   text        not null check (char_length(image_src) between 1 and 2048),
  model       text        not null check (char_length(model) between 1 and 120),
  dim         int         not null check (dim between 8 and 4096),
  -- base64 of dim signed bytes (int8). 512-d → 684 chars.
  vec         text        not null check (char_length(vec) = ((dim + 2) / 3) * 4 and vec ~ '^[A-Za-z0-9+/]+={0,2}$'),
  updated_at  timestamptz not null default now(),
  primary key (product_id, image_src, model)
);
create index if not exists product_image_embeddings_model_idx on public.product_image_embeddings (model);

comment on table public.product_image_embeddings is
  'Visual search: one MobileCLIP image embedding per product image (int8, base64). Derived data — rebuildable. '
  'Public read; writes by catalog.edit (has_perm) or the service role; deletes by the service role only.';

-- keep updated_at honest on upserts
create or replace function public.product_image_embeddings_touch() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.product_image_embeddings_touch() from public, anon, authenticated;

drop trigger if exists product_image_embeddings_touch on public.product_image_embeddings;
create trigger product_image_embeddings_touch before insert or update on public.product_image_embeddings
  for each row execute function public.product_image_embeddings_touch();

-- ================================================================ RLS
alter table public.product_image_embeddings enable row level security;

drop policy if exists "image embeddings public read" on public.product_image_embeddings;
create policy "image embeddings public read" on public.product_image_embeddings for select to anon, authenticated
  using (true);

drop policy if exists "image embeddings catalog insert" on public.product_image_embeddings;
create policy "image embeddings catalog insert" on public.product_image_embeddings for insert to authenticated
  with check ((select public.has_perm('catalog.edit')));

drop policy if exists "image embeddings catalog update" on public.product_image_embeddings;
create policy "image embeddings catalog update" on public.product_image_embeddings for update to authenticated
  using ((select public.has_perm('catalog.edit'))) with check ((select public.has_perm('catalog.edit')));

-- no delete policy on purpose (service role only, see the header)
revoke all on public.product_image_embeddings from anon, authenticated;
grant select on public.product_image_embeddings to anon, authenticated;
grant insert, update on public.product_image_embeddings to authenticated;
grant all on public.product_image_embeddings to service_role;

-- ================================================================ post-condition
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'product_image_embeddings' and cmd = 'DELETE'
  ) then
    return;
  end if;
  raise exception 'product_image_embeddings must not have a DELETE policy (deletes are service-role only).';
end $$;
