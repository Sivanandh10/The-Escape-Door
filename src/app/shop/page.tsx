// /shop — full catalogue (SITEMAP §2.2). Static: every product is in the HTML; filters/search run client-side.
import type { Metadata } from 'next'
import { getCollections, getProducts } from '@/lib/data/repo'
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/seo'
import { JsonLd } from '@/components/seo/JsonLd'
import { ShopBrowserSuspended } from '@/components/shop/ShopBrowser'
import { CATEGORIES } from '@/components/shop/catalog'
import { CategoryTiles, CustomCta, PacksStrip, SectionHead, ShopHero, ArcDoorStrip } from '@/components/shop/ShopSections'
import { ForYou } from '@/components/recs/ForYou'

const TITLE = 'Shop Anime Merch Online — All Fandoms | The Escape Door'
const DESC = 'Shop 60+ anime designs online, with 2,000+ more in our library on WhatsApp. Filter by arc, size, GSM and price. Fan-inspired, original designs.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: '/shop' },
  openGraph: { title: TITLE, description: DESC, url: '/shop', type: 'website', siteName: 'The Escape Door', locale: 'en_IN' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
}

export default async function ShopPage() {
  const [products, collections] = await Promise.all([getProducts(), getCollections()])
  const arcs = collections.map(({ slug, name, jp, accentA, accentB, motif, tagline }) => ({ slug, name, jp, accentA, accentB, motif, tagline }))
  const counts = Object.fromEntries(collections.map((c) => [c.slug, products.filter((p) => p.collection === c.slug).length]))

  return (
    <>
      <JsonLd
        data={[
          collectionPageJsonLd('The Escape Door catalogue', '/shop', products, DESC),
          breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }]),
        ]}
      />
      <ShopHero
        crumbs={[{ name: 'Home', path: '/' }, { name: 'Shop' }]}
        kicker="Catalogue · Vol. 01"
        jp="全巻カタログ"
        title={<>The full catalogue: every arc, every <em>panel</em></>}
        intro={<p>Tees, hoodies, polaroids, posters, bookmarks, badges and cosplay props — fan-inspired, original designs. Filter by arc, type and price, then send the order on WhatsApp.</p>}
        stats={[
          ['pieces', String(products.length)],
          ['arcs', String(collections.length)],
          ['categories', String(CATEGORIES.length)],
        ]}
        sfx="ドン!"
      />

      {/* returning visitors only (client, from their own signals) — renders nothing for a first visit */}
      <ForYou variant="shop" />

      <section aria-labelledby="browse-h" className="container-x pt-10 md:pt-14">
        <SectionHead id="browse-h" before="Filter by " accent="arc" jp="アークで探す" className="mb-6" />
        <ShopBrowserSuspended products={products} collections={collections} />
      </section>

      <section aria-labelledby="cats-h" className="container-x pt-20 md:pt-28">
        <SectionHead id="cats-h" before="Shop by " accent="category" jp="カテゴリー" className="mb-8" />
        <CategoryTiles products={products} />
      </section>

      <section aria-labelledby="packs-h" className="container-x pt-20 md:pt-28">
        <SectionHead id="packs-h" before="Packs that " accent="save" jp="セット割" className="mb-4" />
        <p className="mb-8 max-w-2xl text-paper/80">Bundle prices apply automatically in the cart — mix designs and arcs freely.</p>
        <PacksStrip />
      </section>

      <section aria-labelledby="arcs-h" className="container-x pt-20 md:pt-28">
        <SectionHead id="arcs-h" before="Pick your " accent="arc" jp="扉を選べ" className="mb-8" />
        <ArcDoorStrip arcs={arcs} counts={counts} />
      </section>

      <CustomCta />
    </>
  )
}
