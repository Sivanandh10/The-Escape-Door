// /lab/cart — QA bench for the cart drawer, /cart, /wishlist and /checkout-success. noindex. Owner: P2.
// Query: ?seed=mix|deals|quote|one|empty  &open=1|details  &wish=1  &order=sent|blocked
import type { Metadata } from 'next'
import { getProducts } from '@/lib/data/repo'
import type { CartItem, Product } from '@/lib/types'
import { LabCart } from './LabCart'

export const metadata: Metadata = { title: 'Lab · Cart', robots: { index: false, follow: false } }

function line(p: Product | undefined, qty: number, vIdx = 0, size?: string): CartItem | null {
  if (!p) return null
  const v = p.variants[vIdx] ?? p.variants[0]
  const img = p.images.find((i) => i.side !== 'back') ?? p.images[0]
  return {
    key: `${p.id}|${v.id}|${size ?? ''}`,
    productId: p.id,
    slug: p.slug,
    name: p.name,
    type: p.type,
    collection: p.collection,
    variantId: v.id,
    variantLabel: v.label,
    ...(size ? { size } : {}),
    unitPrice: v.price,
    qty,
    image: img?.src ?? '',
    ...(v.attrs ? { variantAttrs: v.attrs } : {}),
  }
}

export default async function LabCartPage() {
  const all = await getProducts()
  const by = (pred: (p: Product) => boolean, n = 0) => all.filter(pred)[n]
  const tee = by((p) => p.dropOfWeek)
  const fitTee = by((p) => p.type === 'tshirt' && p.variants.length > 1)
  const hoodie = by((p) => p.type === 'hoodie')
  const pol = by((p) => p.type === 'polaroid')
  const pol2 = by((p) => p.type === 'polaroid', 1)
  const badge = by((p) => p.type === 'badge')
  const katana = by((p) => p.type === 'katana' && p.tags.includes('led'))
  const hat = by((p) => !!p.priceOnRequest)
  const sets: Record<string, CartItem[]> = {
    mix: [line(tee, 1, 0, 'L'), line(hoodie, 1, 2, 'M'), line(pol, 2), line(pol2, 2), line(katana, 1)].filter(Boolean) as CartItem[],
    deals: [line(pol, 3), line(badge, 4), line(fitTee, 2, 1, 'S')].filter(Boolean) as CartItem[],
    quote: [line(katana, 1), line(hat, 1)].filter(Boolean) as CartItem[],
    one: [line(tee, 1, 0, 'M')].filter(Boolean) as CartItem[],
    empty: [],
  }
  const wish = [tee, hoodie, pol, katana, fitTee, badge].filter(Boolean).map((p) => (p as Product).id)
  return <LabCart sets={sets} wish={wish} />
}
