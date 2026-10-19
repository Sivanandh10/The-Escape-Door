// /product/[slug] — product page (SITEMAP §2.5). Static for every product.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCollection, getProduct, getProducts, getRelatedProducts } from '@/lib/data/repo'
import { productPriceLabel } from '@/lib/pricing'
import { breadcrumbJsonLd, productJsonLd } from '@/lib/seo'
import { JsonLd } from '@/components/seo/JsonLd'
import { ProductView } from '@/components/shop/ProductView'
import { ProductCard } from '@/components/shop/ProductCard'
import { primaryCategory } from '@/components/shop/catalog'
import { Crumbs, SectionHead } from '@/components/shop/ShopSections'

export async function generateStaticParams() {
  const all = await getProducts()
  return all.map((p) => ({ slug: p.slug }))
}

const titleCase = (s: string) => s.split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ')

export async function generateMetadata({ params }: PageProps<'/product/[slug]'>): Promise<Metadata> {
  const p = await getProduct((await params).slug)
  if (!p) return {}
  const c = await getCollection(p.collection)
  const arc = c?.name ?? titleCase(p.collection)
  const price = productPriceLabel(p)
  let title = `${p.name} — ${price} | The Escape Door`
  if (title.length > 60) title = `${p.name} — ${price}`
  if (title.length > 60) title = p.name
  const desc = `${p.name}, fan-inspired by ${arc}. ${price}. ${p.description.split('. ')[0]}. Original design by The Escape Door.`.slice(0, 155)
  const img = p.images[0]
  const path = `/product/${p.slug}`
  return {
    title: { absolute: title },
    description: desc,
    alternates: { canonical: path },
    openGraph: { title, description: desc, url: path, type: 'website', images: img ? [{ url: img.src, width: 1200, height: 1500, alt: img.alt }] : undefined },
    twitter: { card: 'summary_large_image', title, description: desc, images: img ? [img.src] : undefined },
  }
}

export default async function ProductPage({ params }: PageProps<'/product/[slug]'>) {
  const p = await getProduct((await params).slug)
  if (!p) notFound()
  const [c, related] = await Promise.all([getCollection(p.collection), getRelatedProducts(p.slug, 4)])
  const arc = c?.name ?? titleCase(p.collection)
  const cat = primaryCategory(p)
  const path = `/product/${p.slug}`
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    ...(cat ? [{ name: cat.label, path: `/shop/${cat.slug}` }] : []),
    { name: p.designTitle, path },
  ]

  return (
    <>
      <JsonLd data={[productJsonLd(p, { collectionName: arc }), breadcrumbJsonLd(crumbs)]} />
      <div className="relative overflow-hidden bg-ink pt-[calc(var(--header-h)+24px)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 screentone screentone-light [--tone-color:var(--color-paper)] [--tone-opacity:0.06]" />
        <div className="container-x relative pb-16">
          <Crumbs items={crumbs} className="mb-6 text-paper" />
          <ProductView product={p} collectionName={arc} collectionJp={c?.jp} accent={c?.accentB} />
        </div>
      </div>

      <section aria-labelledby="details-h" className="container-x grid gap-6 py-14 md:grid-cols-2 md:py-20">
        <div className="panel-paper p-6 shadow-hard-volt">
          <SectionHead id="details-h" before={p.sizes?.length ? 'Size and ' : 'What’s in the '} accent={p.sizes?.length ? 'fit' : 'pack'} className="mb-3 [&_h2]:text-[clamp(2rem,4vw,3.25rem)]" />
          <p className="text-tone-2">
            {p.sizes?.length
              ? `Available in ${p.sizes.join(', ')}. We don’t publish measurements yet — message us on WhatsApp for the size chart before you order.`
              : `${p.variants.map((v) => v.label).join(' · ')}. ${p.bundleRuleId ? 'Bundle pricing applies automatically in the cart.' : ''}`}
          </p>
        </div>
        <div className="panel-paper p-6 shadow-hard">
          <h2 className="h-display mb-3 text-[clamp(2rem,4vw,3.25rem)]">Fan-made, <em>original</em> design</h2>
          <p className="text-tone-2">
            “{p.designTitle}” is an original illustration inspired by {arc}. Not official merchandise; not affiliated with or endorsed by any studio, publisher or rights holder.
          </p>
          <p className="mt-3 text-sm text-tone-2">
            Delivery and returns: being finalised — see <Link href="/policies/shipping" className="underline decoration-2 underline-offset-2">shipping</Link> or ask us on WhatsApp.
          </p>
        </div>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="pairs-h" className="container-x pb-20 md:pb-28">
          <SectionHead id="pairs-h" before="Pairs well " accent="with" jp="あわせて" className="mb-8" />
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-5 lg:grid-cols-4" role="list">
            {related.map((r, i) => (
              <li key={r.id} className="min-w-0">
                <ProductCard product={r} index={i} collectionName={r.collection === p.collection ? arc : undefined} />
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-4 label text-[0.6875rem] text-paper/80">
            {cat && <Link href={`/shop/${cat.slug}`} className="underline decoration-2 underline-offset-4 focus-ring">All {cat.label.toLowerCase()}</Link>}
            <Link href={`/arc/${p.collection}`} className="underline decoration-2 underline-offset-4 focus-ring">More from {arc}</Link>
          </div>
        </section>
      )}
    </>
  )
}
