// /lab/shop — P1 shop kit preview (ProductCard, AddToCartButton, PriceTag, WishlistButton). noindex.
import type { Metadata } from 'next'
import { getProducts } from '@/lib/data/repo'
import { ProductCard } from '@/components/shop/ProductCard'
import { AddToCartButton } from '@/components/shop/AddToCartButton'
import { PriceTag } from '@/components/shop/PriceTag'
import { WishlistButton } from '@/components/shop/WishlistButton'

export const metadata: Metadata = { title: 'Lab · Shop kit', robots: { index: false, follow: false } }

export default async function LabShop() {
  const all = await getProducts()
  const pick = ['tshirt', 'hoodie', 'polaroid', 'katana', 'bookmark', 'poster', 'hat', 'badge']
    .map((t) => all.find((p) => p.type === t))
    .filter((p): p is NonNullable<typeof p> => !!p)
  const tee = pick[0]
  const polaroid = all.find((p) => p.type === 'polaroid')!
  return (
    <div className="container-x py-16">
      <h1 className="h-display text-h2 mb-10">Shop <em>kit</em></h1>
      <section className="mb-14 flex flex-wrap items-center gap-6">
        <AddToCartButton product={polaroid} />
        <AddToCartButton product={polaroid} scale="lg" />
        <AddToCartButton product={tee} />
        <AddToCartButton product={tee} size="M" mode="buy" />
        <AddToCartButton product={polaroid} scale="sm" label="Add" tone="paper" />
        <PriceTag product={tee} size="lg" />
        <PriceTag product={pick[1]} />
        <PriceTag product={pick[3]} tone="ink" />
        <WishlistButton productId={tee.id} name={tee.name} withLabel />
      </section>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {pick.map((p, i) => (
          <li key={p.id}>
            <ProductCard product={p} index={i} priority={i < 4} />
          </li>
        ))}
      </ul>
    </div>
  )
}
