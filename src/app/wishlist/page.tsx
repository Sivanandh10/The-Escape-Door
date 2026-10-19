// /wishlist — saved pieces with move-to-cart. Catalogue rendered statically; saved ids are client-side.
import type { Metadata } from 'next'
import { getCollections, getProducts } from '@/lib/data/repo'
import { productPriceLabel } from '@/lib/pricing'
import { WishlistView, type WishProduct } from '@/components/shop/WishlistView'
import { Masthead } from '@/components/shop/cart/Masthead'

export const metadata: Metadata = {
  title: 'Your wishlist',
  description: 'Pieces you saved at The Escape Door — move them to your cart when you are ready.',
  alternates: { canonical: '/wishlist' },
  robots: { index: false, follow: true },
}

export default async function WishlistPage() {
  const [products, collections] = await Promise.all([getProducts(), getCollections()])
  const names = new Map(collections.map((c) => [c.slug, c.name]))
  const slim: WishProduct[] = products.map((p) => {
    const img = p.images.find((i) => i.side !== 'back') ?? p.images[0]
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      type: p.type,
      collection: p.collection,
      collectionName: names.get(p.collection) ?? p.collection,
      variants: p.variants,
      ...(p.sizes ? { sizes: p.sizes } : {}),
      ...(p.priceOnRequest ? { priceOnRequest: true } : {}),
      ...(p.jpTitle ? { jpTitle: p.jpTitle } : {}),
      stock: p.stock,
      image: img?.src ?? '',
      alt: img?.alt ?? p.name,
      priceLabel: productPriceLabel(p),
    }
  })
  return (
    <>
      <Masthead kicker="Saved for later · Chapter 00" jp="ほしい物リスト" echo="Saved Saved">
        Your <em>wishlist</em>
      </Masthead>
      <section aria-label="Saved pieces" className="container-x pb-24 pt-8 md:pt-12">
        <WishlistView products={slim} />
      </section>
    </>
  )
}
