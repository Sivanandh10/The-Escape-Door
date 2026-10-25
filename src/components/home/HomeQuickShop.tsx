// HOME · FAST SHOP — straight after the hero, for "people who just want a hoodie" (review feedback #4).
// Five category tiles + Shop all, each with a real mockup peeking out, the piece count and the price hook
// (GSM tiers, bundle deals) from the cached repo. Under them: one compact row of arc doors, then the honest
// library line (feedback #5) with a WhatsApp ask. Server component; hover/press are CSS only. Owner: HOME.
import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ArrowRight, MessageCircle } from 'lucide-react'
import type { BundleRule, Collection, HoodieTier, Product } from '@/lib/types'
import { formatINR, variantBounds } from '@/lib/pricing'
import { waLink } from '@/lib/whatsapp'
import { readableOn } from '@/components/layout/nav'
import { CATEGORIES } from '@/components/shop/catalog'
import { cn } from '@/lib/utils'

/** Library size from our own price book (docs/source/NOTEBOOK_TRANSCRIPTION.md) — not the online count. */
const LIBRARY_LABEL = '2,000+'

interface Tile {
  slug: string
  label: string
  jp: string
  tone: string
  hook: (ctx: { tiers: HoodieTier[]; rules: BundleRule[]; from: number | null }) => string
}

const TILES: Tile[] = [
  { slug: 'oversized-t-shirts', label: 'Tees', jp: 'Tシャツ', tone: 'bg-volt', hook: ({ from }) => (from ? `Oversized ${formatINR(from)}` : 'Big back prints') },
  {
    slug: 'hoodies',
    label: 'Hoodies',
    jp: 'パーカー',
    tone: 'bg-lav',
    hook: ({ tiers, from }) => {
      const lo = tiers.length ? Math.min(...tiers.map((t) => t.price)) : from
      return lo ? `From ${formatINR(lo)} · ${tiers.length > 1 ? `${tiers.length} GSM` : 'GSM'}` : 'Priced by GSM'
    },
  },
  { slug: 'polaroids', label: 'Polaroids', jp: 'ポラロイド', tone: 'bg-pink', hook: ({ rules }) => deal(rules, 'polaroid') ?? 'Mix any designs' },
  { slug: 'posters', label: 'Posters', jp: 'ポスター', tone: 'bg-paper', hook: ({ rules }) => deal(rules, 'poster') ?? 'Full wall sets' },
  { slug: 'cosplay-props', label: 'Cosplay', jp: 'コスプレ', tone: 'bg-door text-paper', hook: () => 'Katanas · capes' },
]

/** Short bundle hook from the rule itself ("3 for ₹100" / "Buy 5, get 1 free"); falls back to the admin label. */
function deal(rules: BundleRule[], type: string): string | undefined {
  const r = rules.find((x) => x.appliesTo.type === type && !x.appliesTo.variantAttr) ?? rules.find((x) => x.appliesTo.type === type)
  if (!r) return undefined
  if (r.kind === 'nForPrice' && r.price) return `${r.n} for ${formatINR(r.price)}`
  if (r.kind === 'buyXgetY' && r.free) return `Buy ${r.n}, get ${r.free} free`
  return r.label.replace(/^[^:]{1,24}:\s*/, '')
}

/** Lowest price in the list; `fit` limits it to that fit's variants (the tee tile quotes the oversized price). */
function lowest(list: Product[], fit?: string): number | null {
  const lows = list.flatMap((p) => (p.priceOnRequest ? [] : p.variants.filter((v) => !fit || v.attrs?.fit === fit).map(variantBounds).filter((b): b is [number, number] => b !== null).map((b) => b[0])))
  return lows.length ? Math.min(...lows) : null
}

/** Small mockup for a tile: featured apparel shows its back print; 600 px variant for generated mockups. */
function peekOf(list: Product[]): { src: string; alt: string } | null {
  const best = list.find((p) => p.featured) ?? list[0]
  if (!best) return null
  const img = (best.type === 'tshirt' || best.type === 'hoodie' ? best.images.find((i) => i.side === 'back') : null) ?? best.images[0]
  if (!img) return null
  return { src: img.src.startsWith('/mockups/') ? img.src.replace(/\.webp$/, '-600.webp') : img.src, alt: '' }
}

export default function HomeQuickShop({
  products = [],
  collections = [],
  tiers = [],
  rules = [],
  whatsapp,
}: {
  products?: Product[]
  collections?: Collection[]
  tiers?: HoodieTier[]
  rules?: BundleRule[]
  whatsapp?: string
}) {
  const online = products.length
  const onlineLabel = online >= 10 ? `${Math.floor(online / 10) * 10}+` : String(online)
  const arcs = [...collections].sort((a, b) => a.order - b.order)
  const askLibrary = waLink(
    `Hi Escape Door! I'm looking for a design that isn't in the online shop. Can you show me the full library? Fandom/character: `,
    whatsapp,
  )

  return (
    <section id="shop-fast" aria-labelledby="shop-fast-title" className="relative border-t-4 border-ink bg-ink py-12 text-paper md:py-16">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <p className="label text-tone-4">Chapter 02 · Straight to the shelf</p>
            <h2 id="shop-fast-title" className="h-display mt-3 text-[clamp(40px,5.4vw,80px)] leading-[0.88]">
              Just here for a <em>hoodie?</em>
            </h2>
          </div>
          <span lang="ja" aria-hidden="true" className="jp-sub hidden text-tone-4 sm:block">
            ショップへ直行
          </span>
        </div>

        <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4" role="list">
          {TILES.map((t, i) => {
            const cat = CATEGORIES.find((c) => c.slug === t.slug)
            const list = cat ? products.filter(cat.match) : []
            const peek = peekOf(list)
            const from = lowest(list, t.slug === 'oversized-t-shirts' ? 'oversized' : undefined)
            return (
              <li key={t.slug}>
                <Link
                  href={`/shop/${t.slug}`}
                  data-cursor="OPEN"
                  data-cursor-jp={t.jp}
                  className={cn(
                    'press focus-ring group relative flex h-[132px] flex-col justify-between overflow-hidden border-[3px] border-ink p-3 text-ink shadow-hard-paper sm:h-[150px] lg:h-[176px]',
                    t.tone,
                  )}
                >
                  {peek && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -bottom-6 -right-5 w-[58%] rotate-[8deg] border-2 border-ink bg-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] can-hover:group-hover:-translate-y-3 can-hover:group-hover:rotate-[2deg] lg:w-[62%]"
                    >
                      <Image src={peek.src} alt={peek.alt} width={600} height={750} sizes="(min-width:1024px) 140px, 120px" className="block h-auto w-full" />
                    </span>
                  )}
                  <span className="relative flex items-start justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold">{String(i + 1).padStart(2, '0')}</span>
                    {list.length > 0 && <span className="label bg-ink px-1.5 py-0.5 text-[10px] text-paper">{list.length} online</span>}
                  </span>
                  <span className="relative max-w-[74%]">
                    <span className="h-display block text-[clamp(28px,2.6vw,40px)] leading-[0.86]">{t.label}</span>
                    <span className="label mt-1.5 inline bg-ink px-1 py-px text-[10px] leading-[1.7] text-paper [box-decoration-break:clone]">{t.hook({ tiers, rules, from })}</span>
                  </span>
                </Link>
              </li>
            )
          })}
          <li>
            <Link
              href="/shop"
              data-cursor="SHOP"
              data-cursor-jp="ショップ"
              className="press focus-ring group flex h-[132px] flex-col items-start justify-between gap-3 border-[3px] border-paper bg-ink p-3 text-paper shadow-hard-volt sm:h-[150px] lg:h-[176px]"
            >
              <span className="label text-tone-4">Everything</span>
              <span className="h-display text-[clamp(28px,2.6vw,40px)] leading-[0.86]">
                Shop <em className="accent">all</em>
              </span>
              <ArrowRight aria-hidden="true" className="size-7 shrink-0 transition-transform duration-200 can-hover:group-hover:translate-x-1" strokeWidth={2.6} />
            </Link>
          </li>
        </ul>

        {arcs.length > 0 && (
          <nav aria-label="Shop by arc" className="mt-6">
            <p className="label mb-2 text-tone-4 sm:hidden">Or pick your arc</p>
            <ul className="-mx-4 flex snap-x items-center gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="list">
              <li className="label mr-1 hidden text-tone-4 sm:block">Or pick your arc</li>
              {arcs.map((a) => (
                <li key={a.slug} className="shrink-0 snap-start">
                  <Link
                    href={`/arc/${a.slug}`}
                    data-cursor="OPEN"
                    className="press focus-ring inline-flex min-h-11 items-center gap-2 border-2 border-paper/80 px-3 font-mono text-[12px] font-bold uppercase tracking-[0.1em] transition-colors duration-150 can-hover:hover:border-[var(--a)] can-hover:hover:bg-[var(--a)] can-hover:hover:text-[var(--fg)]"
                    style={{ '--a': a.accentA, '--fg': readableOn(a.accentA) === 'ink' ? 'var(--color-ink)' : 'var(--color-paper)' } as CSSProperties}
                  >
                    <span aria-hidden="true" className="size-2.5 shrink-0 border border-ink" style={{ background: a.accentA }} />
                    {a.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="mt-7 flex flex-col gap-4 border-t-2 border-dashed border-tone-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[60ch] text-[15px] leading-snug text-tone-4">
            <strong className="font-mono text-paper">{LIBRARY_LABEL} designs</strong> in our library ·{' '}
            <strong className="font-mono text-volt">{onlineLabel} online</strong> right now. Can&apos;t see your fandom? Ask us for the full library.
          </p>
          <a
            href={askLibrary}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="ASK"
            className="press focus-ring inline-flex min-h-12 shrink-0 items-center justify-center gap-2 border-[3px] border-ink bg-volt px-5 font-bold text-ink shadow-hard-paper"
          >
            <MessageCircle aria-hidden="true" className="size-5" strokeWidth={2.4} />
            Ask on WhatsApp
            <span className="sr-only"> (opens WhatsApp)</span>
          </a>
        </div>
      </div>
    </section>
  )
}
