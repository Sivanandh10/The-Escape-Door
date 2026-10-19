'use client'
// P4b — Products CRUD (/admin/products). Writes go through useCrud (browser client under RLS), and every
// successful create/update/delete/reorder calls revalidateCatalog(['products']) → updateTag('products'),
// so /shop, /shop/[category], /arc/[collection], home sections and /product/[slug] update immediately.
import { useMemo, useState } from 'react'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import type { BundleRule, ProductImage, ProductType, Variant } from '@/lib/types'
import { productPriceLabel } from '@/lib/pricing'
import { AdminPage } from '../AdminPage'
import { adminBtn, adminPill } from '../ui'
import { useCrud } from './data'
import { collectionCfg, productCfg, type AdminCollection, type AdminProduct } from './entities'
import { EntityManager } from './EntityManager'
import { Chips, ColorField, FormSection, NumberField, SandboxSwitch, SelectField, TagsField, TextArea, TextField, Toggle } from './kit'
import { ImageInput } from './CatalogManagers'
import { newId, slugify } from './util'

const TYPES: ProductType[] = [
  'tshirt', 'hoodie', 'polaroid', 'bookmark', 'poster', 'badge', 'sticker', 'keychain', 'cosplay', 'katana',
  'figurine', 'cape', 'accessory', 'hat', 'tote', 'stationery',
]
const APPAREL: ProductType[] = ['tshirt', 'hoodie']
const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const STOCK = [
  { id: 'in', label: 'In stock' }, { id: 'low', label: 'Low' }, { id: 'out', label: 'Sold out' }, { id: 'made-to-order', label: 'Made to order' },
] as const

const productSchema = z.object({
  name: z.string().trim().min(2, 'Name it').max(120),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase-with-dashes'),
  collection: z.string().min(1, 'Pick an arc'),
  designTitle: z.string().trim().min(1, 'Design title').max(120),
  description: z.string().max(2000),
  colorBlock: z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a #RRGGBB colour'),
  variants: z.array(z.object({ id: z.string().min(1), label: z.string().trim().min(1, 'Label each variant'), price: z.number().int().min(0).nullable() }))
    .min(1, 'Add at least one variant (the shop hides products without one)'),
  images: z.array(z.object({ src: z.string().min(1, 'Image URL'), alt: z.string().trim().min(3, 'Alt text helps SEO') })),
})

/** priceFrom = lowest priced variant (null when every variant is price-on-request). */
function withDerived(p: AdminProduct): AdminProduct {
  const prices = p.variants.map((v) => v.price).filter((n): n is number => typeof n === 'number')
  const priceFrom = prices.length ? Math.min(...prices) : null
  return { ...p, priceFrom, ...(priceFrom == null ? { priceOnRequest: true } : {}), updatedAt: new Date().toISOString() }
}

export function ProductsManager({ initial, collections: initialCollections, bundleRules }: { initial: AdminProduct[]; collections: AdminCollection[]; bundleRules: BundleRule[] }) {
  const crud = useCrud(productCfg, initial)
  // every arc incl. hidden ones (live: loaded under RLS), for the picker and labels
  const collections = useCrud(collectionCfg, initialCollections).rows
  const [arc, setArc] = useState<string>('all')
  const names = useMemo(() => new Map(collections.map((c) => [c.slug, c.name])), [collections])
  const rows = useMemo(() => (arc === 'all' ? crud.rows : crud.rows.filter((p) => p.collection === arc)), [crud.rows, arc])

  // drop of the week is single: un-flag the previous one in the same write burst
  const beforeSave = async (d: AdminProduct): Promise<boolean> => {
    if (!d.dropOfWeek) return true
    const others = crud.rows.filter((p) => p.dropOfWeek && p.id !== d.id).map((p) => ({ ...p, dropOfWeek: false }))
    return others.length ? crud.saveMany(others) : true
  }

  const blank = (): AdminProduct => ({
    id: newId('p-'), slug: '', name: '', type: 'tshirt', collection: collections[0]?.slug ?? '', tags: [], designTitle: '',
    description: '', images: [], variants: [{ id: 'oversized', label: 'Oversized', price: 800 }], sizes: DEFAULT_SIZES,
    priceFrom: 800, customizable: false, featured: false, dropOfWeek: false, stock: 'in', colorBlock: '#C9B8FF',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), published: true, sortOrder: crud.rows.length + 1,
  })

  return (
    <AdminPage
      no="06"
      kicker={`Catalogue · ${crud.rows.length} products`}
      title={<>Shop <em>shelf</em></>}
      jp="商品"
      description="Everything in /shop, the arc pages, the home sections and each product page. Saves are live on the site straight away."
      actions={<SandboxSwitch mode={crud.mode} />}
    >
      <EntityManager<AdminProduct>
        crud={{ ...crud, save: (item, opts) => crud.save(withDerived(item), opts) }}
        rows={rows}
        caption="Products"
        noun="product"
        jp="商品編集"
        wide
        reorderable={arc === 'all'}
        searchText={(p) => `${p.name} ${p.slug} ${p.type} ${names.get(p.collection) ?? p.collection} ${p.tags.join(' ')}`}
        blank={blank}
        schema={productSchema}
        beforeSave={beforeSave}
        toolbar={
          <Chips
            label="Arc"
            value={arc}
            onChange={setArc}
            options={[{ id: 'all', label: 'All' }, ...collections.map((c) => ({ id: c.slug, label: c.name }))]}
          />
        }
        columns={[
          { id: 'sw', header: '', className: 'w-[44px]', cell: (p) => <span className="block size-7 border-2 border-ink" style={{ background: p.colorBlock }} /> },
          { id: 'name', header: 'Product', sortValue: (p) => p.name, cell: (p) => <span className="block leading-tight"><span className="font-semibold">{p.name}</span><span className="block font-mono text-[11px] text-paper/50">{p.type} · {names.get(p.collection) ?? p.collection}</span></span> },
          { id: 'price', header: 'Price', sortValue: (p) => p.priceFrom ?? -1, cell: (p) => <span className="font-mono text-[12.5px]">{productPriceLabel(p)}</span> },
          { id: 'flags', header: 'State', cell: (p) => (
            <span className="flex flex-wrap gap-1">
              <span className={adminPill(p.published ? 'lav' : 'muted')}>{p.published ? 'Live' : 'Hidden'}</span>
              {p.dropOfWeek && <span className={adminPill('door')}>Drop</span>}
              {p.featured && <span className={adminPill('volt')}>Featured</span>}
              {p.stock !== 'in' && <span className={adminPill(p.stock === 'out' ? 'hype' : 'muted')}>{p.stock}</span>}
            </span>
          ) },
        ]}
        form={(p, set, e, isNew) => (
          <>
            <FormSection title="Identity" jp="名前">
              <TextField label="Name" value={p.name} error={e.name} onChange={(name) => set(isNew ? { name, slug: slugify(name), designTitle: p.designTitle || name } : { name })} />
              <TextField label="Slug" mono value={p.slug} error={e.slug} hint={isNew ? 'URL: /product/<slug>' : 'Changing it breaks shared links.'} onChange={(slug) => set({ slug: slugify(slug) })} />
              <SelectField label="Type" value={p.type} onChange={(type) => set({ type, ...(APPAREL.includes(type) ? { sizes: p.sizes?.length ? p.sizes : DEFAULT_SIZES } : { sizes: undefined }) })} options={TYPES.map((t) => ({ id: t, label: t }))} />
              <SelectField label="Arc (collection)" value={p.collection} error={e.collection} onChange={(collection) => set({ collection })} options={collections.map((c) => ({ id: c.slug, label: c.name }))} />
              <TextField label="Design title" value={p.designTitle} error={e.designTitle} onChange={(designTitle) => set({ designTitle })} />
              <TextField label="JP title" value={p.jpTitle ?? ''} onChange={(jpTitle) => set({ jpTitle: jpTitle || undefined })} />
              <TextArea className="sm:col-span-2" label="Description" rows={4} maxLength={2000} value={p.description} error={e.description} onChange={(description) => set({ description })} />
              <TagsField className="sm:col-span-2" label="Tags" hint="Search words (character names, themes)." value={p.tags} onChange={(tags) => set({ tags })} />
            </FormSection>

            <FormSection title="Variants & price" jp="価格">
              <div className="space-y-2 sm:col-span-2">
                {e.variants && <p role="alert" className="label text-[10px] text-hype">{e.variants}</p>}
                {p.variants.map((v, i) => (
                  <div key={v.id} className="grid grid-cols-[1fr_120px_44px] items-end gap-2">
                    <TextField label={`Variant ${i + 1}`} value={v.label} onChange={(label) => set({ variants: p.variants.map((x, j) => (j === i ? { ...x, label } : x)) })} />
                    <NumberField label="Price ₹" value={v.price} placeholder="on request" onChange={(price) => set({ variants: p.variants.map((x, j) => (j === i ? { ...x, price } : x)) })} />
                    <button type="button" aria-label={`Remove variant ${v.label}`} onClick={() => set({ variants: p.variants.filter((_, j) => j !== i) })} className="grid size-11 place-items-center border-2 border-paper/20 text-paper/60 focus-ring can-hover:hover:border-hype can-hover:hover:text-hype"><Trash2 aria-hidden className="size-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => set({ variants: [...p.variants, { id: newId('v-'), label: '', price: null } as Variant] })} className={adminBtn({ variant: 'ghost', size: 'sm' })}><Plus aria-hidden className="size-4" /> Add variant</button>
                <p className="text-[12.5px] text-paper/55">Leave a price empty for “price on request”. The “from” price is the lowest variant.</p>
              </div>
              {APPAREL.includes(p.type) && <TagsField className="sm:col-span-2" label="Sizes" value={p.sizes ?? []} onChange={(sizes) => set({ sizes })} />}
              <SelectField label="Bundle deal" value={p.bundleRuleId ?? ''} onChange={(id) => set({ bundleRuleId: id || undefined })} options={[{ id: '', label: 'None' }, ...bundleRules.map((r) => ({ id: r.id, label: r.label }))]} />
              <SelectField label="Stock" value={p.stock} onChange={(stock) => set({ stock })} options={STOCK.map((s) => ({ id: s.id, label: s.label }))} />
            </FormSection>

            <FormSection title="Images" jp="画像">
              {p.images.map((img, i) => (
                <div key={i} className="space-y-2 border-2 border-paper/10 p-3 sm:col-span-2">
                  <ImageInput value={img.src} error={e[`images.${i}.src`]} folder={`products/${p.slug || 'new'}`} onChange={(src) => set({ images: p.images.map((x, j) => (j === i ? { ...x, src } : x)) })} />
                  <div className="grid grid-cols-[1fr_140px_44px] items-end gap-2">
                    <TextField label="Alt text" value={img.alt} error={e[`images.${i}.alt`]} onChange={(alt) => set({ images: p.images.map((x, j) => (j === i ? { ...x, alt } : x)) })} />
                    <SelectField label="Side" value={img.side ?? 'front'} onChange={(side) => set({ images: p.images.map((x, j) => (j === i ? { ...x, side } : x)) })} options={[{ id: 'front', label: 'Front' }, { id: 'back', label: 'Back' }, { id: 'detail', label: 'Detail' }]} />
                    <button type="button" aria-label="Remove image" onClick={() => set({ images: p.images.filter((_, j) => j !== i) })} className="grid size-11 place-items-center border-2 border-paper/20 text-paper/60 focus-ring can-hover:hover:border-hype can-hover:hover:text-hype"><Trash2 aria-hidden className="size-4" /></button>
                  </div>
                </div>
              ))}
              <div className="sm:col-span-2">
                <button type="button" onClick={() => set({ images: [...p.images, { src: '', alt: p.name ? `${p.name} — front` : '', side: 'front' } as ProductImage] })} className={adminBtn({ variant: 'ghost', size: 'sm' })}><Plus aria-hidden className="size-4" /> Add image</button>
                <p className="mt-2 text-[12.5px] text-paper/55">No images? The shop draws the product art from the colour block and arc.</p>
              </div>
              <ColorField label="Colour block" value={p.colorBlock} error={e.colorBlock} onChange={(colorBlock) => set({ colorBlock })} />
            </FormSection>

            <FormSection title="Placement" jp="表示">
              <Toggle label="Published" hint="Hidden products vanish from the shop" checked={p.published} onChange={(published) => set({ published })} tone="door" />
              <Toggle label="Featured" checked={p.featured} onChange={(featured) => set({ featured })} />
              <Toggle label="Drop of the week" hint="Only one — saving this un-flags the current drop" checked={p.dropOfWeek} onChange={(dropOfWeek) => set({ dropOfWeek })} tone="hype" />
              <Toggle label="Customisable" checked={p.customizable} onChange={(customizable) => set({ customizable })} />
            </FormSection>
          </>
        )}
      />
    </AdminPage>
  )
}
