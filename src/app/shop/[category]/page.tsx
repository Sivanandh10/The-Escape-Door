// /shop/[category] — category pages (SITEMAP §2.3). Static per category; same grid pre-filtered.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCollections, getProducts } from '@/lib/data/repo'
import { breadcrumbJsonLd, collectionPageJsonLd, faqJsonLd } from '@/lib/seo'
import { JsonLd } from '@/components/seo/JsonLd'
import { ShopBrowserSuspended } from '@/components/shop/ShopBrowser'
import { CATEGORIES, categoryBySlug, TYPE_LABEL } from '@/components/shop/catalog'
import { ArcDoorStrip, CategoryTiles, CustomCta, PacksStrip, SectionHead, ShopHero } from '@/components/shop/ShopSections'

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }))
}

export async function generateMetadata({ params }: PageProps<'/shop/[category]'>): Promise<Metadata> {
  const c = categoryBySlug((await params).category)
  if (!c) return {}
  const path = `/shop/${c.slug}`
  return {
    title: { absolute: c.title },
    description: c.meta,
    alternates: { canonical: path },
    openGraph: { title: c.title, description: c.meta, url: path, type: 'website' },
    twitter: { card: 'summary_large_image', title: c.title, description: c.meta },
  }
}

const HERO: Record<string, { jp: string; a: string; b: string; motif: string; sfx: string }> = {
  'oversized-t-shirts': { jp: 'オーバーサイズ', a: '#FFE14D', b: '#C9B8FF', motif: 'smoke', sfx: 'ドン!' },
  't-shirts': { jp: 'Tシャツ', a: '#C9B8FF', b: '#FFE14D', motif: 'speedlines', sfx: 'バン!' },
  hoodies: { jp: 'パーカー', a: '#6D3BFF', b: '#C9B8FF', motif: 'walls', sfx: 'ゴゴゴ' },
  polaroids: { jp: 'ポラロイド', a: '#FFB8DE', b: '#FFE14D', motif: 'ribbons', sfx: 'パシャ!' },
  bookmarks: { jp: 'しおり', a: '#C9B8FF', b: '#FFB8DE', motif: 'ribbons', sfx: 'パチン!' },
  posters: { jp: 'ポスター', a: '#FFE14D', b: '#FF2D3D', motif: 'speedlines', sfx: 'バン!' },
  badges: { jp: '缶バッジ', a: '#FFB8DE', b: '#6D3BFF', motif: 'spiral', sfx: 'ポン!' },
  stickers: { jp: 'ステッカー', a: '#FFE14D', b: '#C9B8FF', motif: 'spiral', sfx: 'ペタ!' },
  'cosplay-props': { jp: 'コスプレ', a: '#FF6A13', b: '#12A5A0', motif: 'flames', sfx: 'シャキン!' },
  accessories: { jp: 'アクセサリー', a: '#C9B8FF', b: '#FFE14D', motif: 'waves', sfx: 'キラッ' },
}

export default async function CategoryPage({ params }: PageProps<'/shop/[category]'>) {
  const c = categoryBySlug((await params).category)
  if (!c) notFound()
  const [all, collections] = await Promise.all([getProducts(), getCollections()])
  const products = all.filter(c.match)
  const h = HERO[c.slug]
  const path = `/shop/${c.slug}`
  const arcs = collections.map(({ slug, name, jp, accentA, accentB, motif, tagline }) => ({ slug, name, jp, accentA, accentB, motif, tagline }))
  const counts = Object.fromEntries(collections.map((a) => [a.slug, products.filter((p) => p.collection === a.slug).length]))
  const types = [...new Set(products.map((p) => p.type))]

  return (
    <>
      <JsonLd
        data={[
          collectionPageJsonLd(c.h1, path, products, c.meta),
          breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: c.label, path }]),
          c.faq ? faqJsonLd(c.faq) : null,
        ]}
      />
      <ShopHero
        crumbs={[{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: c.label }]}
        kicker={`Category · ${types.map((t) => TYPE_LABEL[t][1]).join(' · ')}`}
        jp={h.jp}
        title={<CategoryTitle h1={c.h1} />}
        intro={<p>{c.intro}</p>}
        stats={[['pieces', String(products.length)], ['arcs', String(new Set(products.map((p) => p.collection)).size)]]}
        accentA={h.a}
        accentB={h.b}
        motif={h.motif}
        sfx={h.sfx}
      />

      <section aria-labelledby="grid-h" className="container-x pt-10 md:pt-14">
        <SectionHead id="grid-h" before={`${c.label} by `} accent="arc" className="mb-6" />
        <ShopBrowserSuspended products={products} collections={collections} lock={{ cat: c.slug }} hideCats />
      </section>

      <section aria-labelledby="unique-h" className="container-x pt-20 md:pt-28">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-start">
          <div>
            <SectionHead id="unique-h" before={c.h2[0]} accent={c.h2[1]} after={c.h2[2]} className="mb-4" />
            <p className="max-w-xl text-paper/80">
              {c.kind === 'apparel'
                ? 'Fit and print details live on each product page. No size chart yet — message us on WhatsApp and we’ll share measurements before you order.'
                : c.kind === 'collectible'
                  ? 'Bundle prices apply automatically in the cart, and you can mix designs and arcs in one set.'
                  : 'Props are display and cosplay items. We confirm the exact piece, finish and price with you on WhatsApp before anything is made.'}
            </p>
          </div>
          {c.kind === 'collectible' ? <PacksStrip types={types} /> : null}
          {c.faq && (
            <dl className="flex flex-col gap-4">
              {c.faq.map((f) => (
                <div key={f.q} className="panel-paper p-4 shadow-hard-volt">
                  <dt className="h-display text-2xl">{f.q}</dt>
                  <dd className="mt-2 text-tone-2">{f.a}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <section aria-labelledby="more-h" className="container-x pt-20 md:pt-28">
        <SectionHead id="more-h" before="Keep " accent="browsing" jp="ほかの棚" className="mb-8" />
        <CategoryTiles products={all} only={c.related} className="mb-6 lg:grid-cols-3" />
        <p className="label text-[0.6875rem] text-paper/70">
          Or open the <Link href="/shop" className="underline decoration-2 underline-offset-4 focus-ring">full catalogue</Link>
        </p>
        {Object.values(counts).some(Boolean) && (
          <div className="mt-14">
            <p className="label mb-5 text-[0.6875rem] text-volt">{c.label} by arc</p>
            <ArcDoorStrip arcs={arcs.filter((a) => counts[a.slug])} counts={counts} />
          </div>
        )}
      </section>

      <CustomCta before="Make it " accent="yours" after="" />
    </>
  )
}

/** Puts the accent highlight on the last word of the SITEMAP H1 (keeps the exact copy). */
function CategoryTitle({ h1 }: { h1: string }) {
  const i = h1.lastIndexOf(' ')
  return <>{h1.slice(0, i + 1)}<em>{h1.slice(i + 1)}</em></>
}
