-- The Escape Door — sticker pack variant label. Owner: integrator. Idempotent: safe to run again.
-- Reviewer feedback #6 ("TBC … looks outdated"): every sticker product showed a variant chip "Pack (count TBC)".
-- Renames that label to "Sticker pack" inside public.products.variants (jsonb array). Price, id and attrs are untouched,
-- so carts, orders and bundle rules keep working. Only rows that still carry the exact old label are changed.
-- When the owner confirms the count, edit the label in Admin → Products (e.g. "Pack of 10").

update public.products p
   set variants = (
         select jsonb_agg(
                  case when v->>'label' = 'Pack (count TBC)' then jsonb_set(v, '{label}', '"Sticker pack"') else v end
                  order by ord)
           from jsonb_array_elements(p.variants) with ordinality as e(v, ord)
       ),
       updated_at = now()
 where jsonb_typeof(p.variants) = 'array'
   and p.variants @> '[{"label":"Pack (count TBC)"}]'::jsonb;

-- post-check
do $$
begin
  if exists (select 1 from public.products p where p.variants @> '[{"label":"Pack (count TBC)"}]'::jsonb) then
    raise exception 'Post-check failed: a variant still says "Pack (count TBC)".';
  end if;
end $$;
