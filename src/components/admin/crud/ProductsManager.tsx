'use client'
// P4b — Products CRUD (/admin/products). Writes go through useCrud (browser client under RLS), and every
// successful create/update/delete/reorder calls revalidateCatalog(['products']) → updateTag('products'),
// so /shop, /shop/[category], /arc/[collection], home sections and /product/[slug] update immediately.
// Images: many per product (multi-file upload, add by URL, ↑/↓ reorder, side front/back/detail, alt, remove + undo).
// Hierarchy: deleting a product or removing an image is superadmin-only (locked button for everyone else).
// Photo search: after a save, new images are embedded in this browser and stored (ImageIndexTools.tsx →
// imageIndexActions.ts); the toolbar's "Rebuild image search index" re-reads every image.
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { ArrowDown, ArrowUp, ImagePlus, Lock, Plus, Trash2 } from 'lucide-react'
import { DELETE_LOCK_NOTE, READONLY_NOTE, useCanDelete } from '../AdminContext'
import { RebuildImageIndexButton, useImageIndexSync } from './ImageIndexTools'
import type { BundleRule, ProductImage, ProductType, Variant } from '@/lib/types'
import { productPriceLabel } from '@/lib/pricing'
import { AdminPage } from '../AdminPage'
import { adminBtn, adminPill } from '../ui'
import { explainDemo, getAdminClient, uploadProductImage, useCrud } from './data'
import { PRODUCT_TYPES, collectionCfg, productCfg, type AdminCollection, type AdminProduct } from './entities'
import { EntityManager } from './EntityManager'
import { Chips, ColorField, FormSection, NumberField, SandboxSwitch, SelectField, TagsField, TextArea, TextField, Toggle } from './kit'
import { ImageInput } from './CatalogManagers'
import { newId, slugify } from './util'
import { cn } from '@/lib/utils'

const TYPES: ProductType[] = PRODUCT_TYPES
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
  const crud = useCrud(productCfg, initial, { perm: 'catalog.edit' })
  const syncImageIndex = useImageIndexSync(crud.mode === 'live' && !crud.readOnly)
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
      actions={<SandboxSwitch mode={crud.mode} readOnly={crud.readOnly} />}
    >
      <EntityManager<AdminProduct>
        crud={{
          ...crud,
          save: async (item, opts) => {
            const d = withDerived(item)
            const ok = await crud.save(d, opts)
            if (ok) syncImageIndex(d) // photo search: embed new images in the background (live mode only)
            return ok
          },
        }}
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
          <div className="flex flex-wrap items-center gap-3">
            <Chips
              label="Arc"
              value={arc}
              onChange={setArc}
              options={[{ id: 'all', label: 'All' }, ...collections.map((c) => ({ id: c.slug, label: c.name }))]}
            />
            <RebuildImageIndexButton
              products={crud.rows}
              disabled={crud.mode !== 'live' || crud.readOnly}
              disabledReason={crud.mode !== 'live' ? 'Photo search indexes the live catalogue: switch off Sandbox / connect Supabase.' : READONLY_NOTE}
            />
          </div>
        }
        columns={[
          { id: 'sw', header: '', className: 'w-[56px]', cell: (p) => (
            <span className="relative block h-12 w-10 overflow-hidden border-2 border-ink" style={{ background: p.colorBlock }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.images[0]?.src && <img src={p.images[0].src} alt="" className="size-full object-cover" />}
              {p.images.length > 1 && <span className="absolute bottom-0 right-0 bg-volt px-0.5 font-mono text-[9px] font-bold leading-tight text-ink">×{p.images.length}</span>}
            </span>
          ) },
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
              <ImagesEditor images={p.images} name={p.name} slug={p.slug} errors={e} onChange={(images) => set({ images })} />
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

// ---------------------------------------------------------------- images (many per product → carousel slides)
const SIDES = [{ id: 'front', label: 'Front' }, { id: 'back', label: 'Back' }, { id: 'detail', label: 'Detail' }] as const
const sq = 'grid size-11 place-items-center border-2 border-paper/20 text-paper/60 focus-ring disabled:opacity-30'

function ImagesEditor({ images, name, slug, errors, onChange }: { images: ProductImage[]; name: string; slug: string; errors: Record<string, string>; onChange: (v: ProductImage[]) => void }) {
  const [busy, setBusy] = useState(0)
  // hierarchy rule: removing an image is a delete → superadmin only (admins can still add, replace, reorder)
  const canDel = useCanDelete()
  const nextSide = (list: ProductImage[]): ProductImage['side'] =>
    !list.some((x) => x.side === 'front') ? 'front' : !list.some((x) => x.side === 'back') ? 'back' : 'detail'
  const altFor = (side: ProductImage['side']) => (name ? `${name} — ${side === 'back' ? 'back print' : side}` : '')
  const patch = (i: number, x: Partial<ProductImage>) => onChange(images.map((img, j) => (j === i ? { ...img, ...x } : img)))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= images.length) return
    const next = [...images]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const remove = (i: number) => {
    const gone = images[i]
    const next = images.filter((_, j) => j !== i)
    onChange(next)
    toast('Image removed', { action: { label: 'Undo', onClick: () => onChange([...next.slice(0, i), gone, ...next.slice(i)]) } })
  }
  const uploadMany = async (files: File[]) => {
    if (!files.length) return
    if (!getAdminClient()) return explainDemo()
    setBusy(files.length)
    let list = [...images]
    let ok = 0
    for (const f of files) {
      try {
        const src = await uploadProductImage(f, `products/${slug || 'new'}`)
        const side = nextSide(list)
        list = [...list, { src, alt: altFor(side), side }]
        onChange(list)
        ok++
      } catch (err) {
        toast.error(`Upload failed: ${f.name}`, { description: (err as Error).message })
      }
      setBusy((b) => Math.max(0, b - 1))
    }
    if (ok) toast.success(ok === 1 ? 'Image uploaded' : `${ok} images uploaded`, { description: 'Check each alt text and side.' })
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <label className={adminBtn({ variant: 'primary', size: 'sm', className: cn('min-h-11 cursor-pointer', busy && 'skeleton-tone') })}>
          <ImagePlus aria-hidden className="size-4" /> {busy ? `Uploading ${busy}…` : 'Upload images'}
          <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" disabled={!!busy} onChange={(ev) => {
            const files = Array.from(ev.target.files ?? [])
            ev.target.value = ''
            void uploadMany(files)
          }} />
        </label>
        <button type="button" onClick={() => onChange([...images, { src: '', alt: altFor(nextSide(images)), side: nextSide(images) }])} className={adminBtn({ variant: 'ghost', size: 'sm', className: 'min-h-11' })}><Plus aria-hidden className="size-4" /> Add by URL</button>
        <p className="w-full text-[12.5px] text-paper/55">Pick several files at once. The first non-back image is the cover; every image becomes a carousel slide on the card and product page. Front / Back sides power the “Front” and “Back print” shortcuts.</p>
      </div>
      {images.map((img, i) => (
        <div key={`${img.src}-${i}`} className="space-y-2 border-2 border-paper/10 p-3 sm:col-span-2">
          <p className="label flex items-center gap-2 text-[10px] text-paper/60">
            <span className="bg-volt px-1.5 py-0.5 text-ink">{i + 1}</span>{i === 0 ? 'Cover' : `Slide ${i + 1}`}
          </p>
          <ImageInput value={img.src} error={errors[`images.${i}.src`]} folder={`products/${slug || 'new'}`} onChange={(src) => patch(i, { src })} />
          <div className="grid grid-cols-[1fr_44px_44px_44px] items-end gap-2 sm:grid-cols-[1fr_140px_44px_44px_44px]">
            <TextField className="col-span-4 sm:col-span-1" label="Alt text" value={img.alt} error={errors[`images.${i}.alt`]} onChange={(alt) => patch(i, { alt })} />
            <SelectField label="Side" value={img.side ?? 'front'} onChange={(side) => patch(i, { side })} options={SIDES.map((x) => ({ id: x.id, label: x.label }))} />
            <button type="button" aria-label={`Move image ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} className={cn(sq, 'can-hover:hover:border-volt can-hover:hover:text-volt')}><ArrowUp aria-hidden className="size-4" /></button>
            <button type="button" aria-label={`Move image ${i + 1} down`} disabled={i === images.length - 1} onClick={() => move(i, 1)} className={cn(sq, 'can-hover:hover:border-volt can-hover:hover:text-volt')}><ArrowDown aria-hidden className="size-4" /></button>
            {canDel ? (
              <button type="button" aria-label={`Remove image ${i + 1}`} onClick={() => remove(i)} className={cn(sq, 'can-hover:hover:border-hype can-hover:hover:text-hype')}><Trash2 aria-hidden className="size-4" /></button>
            ) : (
              <button type="button" aria-label={`Remove image ${i + 1} — ${DELETE_LOCK_NOTE}`} aria-disabled title={DELETE_LOCK_NOTE} onClick={() => toast(DELETE_LOCK_NOTE, { id: 'delete-locked', description: 'You can replace the image, change its alt text or move it.' })} className={cn(sq, 'cursor-not-allowed opacity-50')}><Lock aria-hidden className="size-4" /></button>
            )}
          </div>
        </div>
      ))}
      {!images.length && <p className="text-[12.5px] text-paper/55 sm:col-span-2">No images? The shop draws the product art from the colour block and arc.</p>}
    </>
  )
}
