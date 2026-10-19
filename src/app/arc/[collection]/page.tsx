// /arc/[collection] — the collection's ARC PAGE (SITEMAP §2.4). Static per collection (data-driven).
// Full-bleed hero in the arc's accents (ArcThemeSetter recolours the page), products grouped by type,
// Beyond Anime sub-fandom chips (?f=), disclaimer block, door strip to the other arcs.
import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { getCollection, getCollections, getProducts } from '@/lib/data/repo'
import { breadcrumbJsonLd, collectionPageJsonLd, DISCLAIMER } from '@/lib/seo'
import { formatINR } from '@/lib/pricing'
import type { Collection } from '@/lib/types'
import { JsonLd } from '@/components/seo/JsonLd'
import { ArcMotif } from '@/components/fx/ArcMotif'
import { Sfx } from '@/components/fx/Sfx'
import { ArcThemeSetter } from '@/components/shop/ArcThemeSetter'
import { ArcBrowser } from '@/components/shop/ArcBrowser'
import { ArcDoorStrip, Crumbs, CustomCta } from '@/components/shop/ShopSections'
import { TYPE_GROUPS, TYPE_LABEL, minPrice } from '@/components/shop/catalog'
import './arc.css'

type Props = { params: Promise<{ collection: string }> }

export async function generateStaticParams() {
  const all = await getCollections()
  const list = all.map((c) => ({ collection: c.slug }))
  return list.length ? list : [{ collection: 'jujutsu-kaisen' }]
}

/** Meta descriptions from SITEMAP §2.4; admin-added arcs get a generated one. */
const META: Record<string, string> = {
  'jujutsu-kaisen': 'Fan-inspired Jujutsu Kaisen merch: oversized tees ₹800, hoodies from ₹1200, polaroids, posters and badges. Original designs, not official merch.',
  'attack-on-titan': 'Fan-inspired Attack on Titan merch: oversized tees ₹800, hoodies, posters ₹200, polaroids ₹50 and badges. Original designs, not official merch.',
  'demon-slayer': 'Fan-inspired Demon Slayer merch: tees, hoodies, posters, badges and cosplay katanas from ₹1200. Original designs, not official merch.',
  'one-piece': 'Fan-inspired One Piece merch: oversized tees ₹800, posters 6 for ₹1000, polaroids, bookmarks and badges. Original designs, not official merch.',
  naruto: 'Fan-inspired Naruto merch: oversized tees ₹800, hoodies, magnetic bookmarks ₹100, posters and badges. Original designs, not official merch.',
  'beyond-anime': 'Beyond anime: tees, polaroids, bookmarks and posters for K-pop, K-drama, F1, films, series, books, games, sports, art and coffee fans.',
}
const describe = (c: Collection) =>
  META[c.slug] ?? `Fan-inspired ${c.name} merch from The Escape Door: tees, hoodies, polaroids, posters and more. ${c.tagline} Original designs, not official merch.`.slice(0, 155)

const SFX: Record<string, string> = { smoke: 'ゴゴゴ', walls: 'ドン!', flames: 'ボッ!', waves: 'ザバーン', spiral: 'ギュン!', ribbons: 'キラッ', speedlines: 'バン!' }

/** ink or paper text, whichever reads on the accent (WCAG relative luminance). */
function onAccent(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 'var(--color-ink)'
  const n = parseInt(m[1], 16)
  const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return L > 0.22 ? 'var(--color-ink)' : 'var(--color-paper)'
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCollection((await params).collection)
  if (!c) return {}
  const [first] = await getProducts({ collection: c.slug })
  const img = first?.images[0]
  const title = `${c.name} Merch India — Original Fan-Inspired Designs`
  const description = describe(c)
  const path = `/arc/${c.slug}`
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: 'website', images: img ? [{ url: img.src, alt: img.alt }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: img ? [img.src] : undefined },
  }
}

export default async function ArcPage({ params }: Props) {
  const slug = (await params).collection
  const [c, collections, products] = await Promise.all([getCollection(slug), getCollections(), getProducts({ collection: slug })])
  if (!c) notFound()

  const path = `/arc/${c.slug}`
  const beyond = c.group === 'beyond'
  const fg = onAccent(c.accentA)
  const prices = products.map(minPrice).filter((n): n is number => n != null)
  const from = prices.length ? Math.min(...prices) : null
  const types = [...new Set(products.map((p) => p.type))]
  const groups = TYPE_GROUPS.filter((g) => products.some((p) => g.types.includes(p.type)))
  const hasProps = products.some((p) => ['katana', 'cape', 'hat', 'cosplay'].includes(p.type))
  const nameWords = c.name.split(' ')
  const arcs = collections.map(({ slug, name, jp, accentA, accentB, motif, tagline }) => ({ slug, name, jp, accentA, accentB, motif, tagline }))
  const all = await getProducts()
  const counts = Object.fromEntries(collections.map((a) => [a.slug, all.filter((p) => p.collection === a.slug).length]))
  const h1Tail = beyond ? 'open the other door' : 'arc'
  const sfx = SFX[c.motif] ?? 'バン!'

  return (
    <>
      <JsonLd
        data={[
          collectionPageJsonLd(beyond ? 'Beyond Anime: open the other door' : `The ${c.name} arc`, path, products, describe(c)),
          breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: c.name, path }]),
        ]}
      />
      <ArcThemeSetter slug={c.slug} />

      {/* ---------------------------------------------------------------- full-bleed arc hero */}
      <header
        className="relative isolate overflow-hidden border-b-4 border-ink pt-[calc(var(--header-h)+24px)]"
        style={{ background: c.accentA, color: fg } as CSSProperties}
      >
        <div aria-hidden="true" className="arc-hero-motif pointer-events-none absolute inset-0 -z-10 opacity-80">
          <ArcMotif motif={c.motif} colorA={c.accentA} colorB={c.accentB} animated width={1600} height={900} density={0.7} seed={`${c.slug}-hero`} />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 screentone screentone-mid [--tone-color:var(--color-ink)] [--tone-opacity:0.14]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-ink/55 to-transparent" />

        {/* giant vertical JP subtitle */}
        <p
          aria-hidden="true"
          lang="ja"
          className="arc-hero-jp pointer-events-none absolute right-[3%] top-[calc(var(--header-h)+12px)] hidden font-display leading-none md:block"
          style={{ writingMode: 'vertical-rl', fontSize: 'clamp(4rem,9vw,8.5rem)', color: c.accentB, WebkitTextStroke: '3px var(--color-ink)', paintOrder: 'stroke fill' } as CSSProperties}
        >
          {c.jp}
        </p>

        <div className="container-x relative pb-12 md:pb-16">
          <Crumbs items={[{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: c.name }]} className="mb-6 w-fit border-2 border-ink bg-paper px-2.5 py-1.5 text-ink" />

          <p className="label mb-4 inline-flex w-fit items-center gap-2 border-[3px] border-ink bg-ink px-2.5 py-1.5 text-[0.6875rem] text-paper" style={{ boxShadow: `3px 3px 0 0 ${c.accentB}` }}>
            {beyond ? 'The other door' : `Arc ${String(c.order).padStart(2, '0')}`} · fan-inspired original designs
          </p>

          <h1 className="max-w-[1180px] md:pr-[12%]">
            {!beyond && <span className="label mb-1 block text-[0.875rem] md:text-base">The </span>}
            <span
              className="arc-hero-name h-display block text-[clamp(4.25rem,15vw,11rem)] leading-[0.82]"
              style={{ textShadow: `5px 5px 0 ${c.accentB}, 9px 9px 0 var(--color-ink)` } as CSSProperties}
            >
              {nameWords.map((w, i) => (
                <span key={`${w}-${i}`} style={{ '--i': i } as CSSProperties}>{w}{i < nameWords.length - 1 ? ' ' : ''}</span>
              ))}
            </span>
            {beyond && <span className="sr-only">:</span>}{' '}
            <span className="h-display mt-3 block text-[clamp(1.5rem,3.4vw,2.75rem)]">{h1Tail}</span>
          </h1>
          <p lang="ja" className="jp-sub mt-3 md:hidden">{c.jp}</p>

          <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,560px)_1fr] md:items-end">
            <div className="arc-hero-panel border-[3px] border-ink bg-paper p-5 text-ink shadow-hard md:p-6" style={{ '--r': '-1deg' } as CSSProperties}>
              <p className="h-display text-[clamp(1.6rem,3vw,2.4rem)] leading-[0.95]">{c.tagline}</p>
              <p className="mt-3 text-[1.0625rem] leading-relaxed text-tone-2">{c.blurb}</p>
              <dl className="mt-4 flex flex-wrap gap-2">
                {([
                  ['pieces', String(products.length)],
                  ['types', String(types.length)],
                  ...(from != null ? [['from', formatINR(from)]] : []),
                ] as Array<[string, string]>).map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-2 border-2 border-ink bg-ink px-3 py-1.5">
                    <dt className="label order-2 text-[0.625rem] text-paper/70">{k}</dt>
                    <dd className="order-1 font-mono text-lg font-bold tabular-nums" style={{ color: c.accentB === '#F4EFE6' ? 'var(--color-volt)' : c.accentB }}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <nav aria-label={`${c.name} sections`} className="flex flex-wrap gap-2 md:justify-end">
              {groups.map((g) => (
                <a key={g.id} href={`#${g.id}`} className="press label inline-flex min-h-11 items-center gap-2 border-[3px] border-ink bg-paper px-3.5 text-[0.6875rem] text-ink shadow-hard-sm focus-ring">
                  {g.types.filter((t) => types.includes(t)).map((t) => TYPE_LABEL[t][1]).slice(0, 2).join(' & ')}
                  <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.6} />
                </a>
              ))}
            </nav>
          </div>
        </div>
        <div aria-hidden="true" className="arc-hero-sfx pointer-events-none absolute right-[16%] top-[30%] max-md:hidden">
          <Sfx text={sfx} size={84} tone="paper" rotate={-10} />
        </div>
      </header>

      {/* ---------------------------------------------------------------- products by type (+ Beyond chips) */}
      <ArcBrowser
        products={products}
        arcName={c.name}
        subFandoms={beyond ? c.subFandoms : undefined}
        titles={beyond ? { apparel: ['Tees for every ', 'fandom', ''], collectibles: ['Polaroids and ', 'bookmarks', ''] } : undefined}
      />

      {/* ---------------------------------------------------------------- disclaimer */}
      <section aria-labelledby="original-h" className="container-x pt-20 md:pt-28">
        <div className="grid gap-6 border-4 border-paper bg-tone-1 p-6 md:grid-cols-[1fr_1.2fr] md:items-center md:p-10">
          <div>
            <h2 id="original-h" className="h-display text-[clamp(2.25rem,5vw,4.25rem)] [&_em]:[--accent-bg:var(--arc-a)]">Fan-made, <em>original</em> designs</h2>
            <p lang="ja" className="jp-sub mt-2">オリジナル</p>
          </div>
          <div className="flex flex-col gap-3 text-paper/85">
            <p>
              Every {beyond ? 'Beyond Anime' : c.name} piece here is drawn by us as fan-inspired art: motifs, colours and moods, never official logos, key art or screenshots.
              It is not official or licensed merchandise. {DISCLAIMER.split('. ')[1]}
            </p>
            {hasProps && (
              <p>
                Cosplay pieces are display items — see the <Link href="/cosplay" className="underline decoration-2 underline-offset-4 focus-ring">cosplay &amp; props page</Link> for how we confirm each one on WhatsApp.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- other arcs */}
      <section aria-labelledby="next-h" className="container-x pt-20 md:pt-28">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 id="next-h" className="h-display text-[clamp(2.25rem,5.5vw,4.75rem)]">Next <em>arc</em></h2>
            <p lang="ja" className="jp-sub mt-2">次のアーク</p>
          </div>
          <Link href="/shop" className="label inline-flex min-h-11 items-center gap-2 text-[0.6875rem] text-paper underline decoration-2 underline-offset-4 focus-ring">
            Full catalogue <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.6} />
          </Link>
        </div>
        <ArcDoorStrip arcs={arcs} current={c.slug} counts={counts} className="lg:grid-cols-5" />
      </section>

      <CustomCta
        before={beyond ? 'Don’t see yours? Make it ' : 'Want your own '}
        accent="custom"
        after={beyond ? '' : ` ${c.name} print?`}
        body={beyond ? <>Any fandom, any quote, any art. Send your design or let us draw it — front prints up to 4×4 in, back prints up to 12×15 in, confirmed on WhatsApp.</> : undefined}
      />
    </>
  )
}
