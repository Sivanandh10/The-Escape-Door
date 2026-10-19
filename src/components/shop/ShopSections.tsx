// Shared server sections for shop / category / arc / product pages (owner: P1 shop).
// ShopHero · Crumbs · CategoryTiles · PacksStrip · CustomCta · ArcDoorStrip · SectionHead
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Collection, Product } from '@/lib/types'
import { bundleRules } from '@/lib/data/rules'
import { formatINR } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { ArcMotif } from '@/components/fx/ArcMotif'
import { Sfx } from '@/components/fx/Sfx'
import { DoorIcon } from '@/components/brand/DoorIcon'
import { CATEGORIES, minPrice, type Category } from './catalog'

// ---------------------------------------------------------------- breadcrumbs
export function Crumbs({ items, className }: { items: Array<{ name: string; path?: string }>; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('label text-[0.6875rem]', className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((c, i) => (
          <li key={c.name} className="inline-flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" className="opacity-50">／</span>}
            {c.path && i < items.length - 1 ? (
              <Link href={c.path} className="underline decoration-2 underline-offset-4 opacity-80 hover:opacity-100 focus-ring">
                {c.name}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined} className="opacity-100">{c.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

// ---------------------------------------------------------------- section head (H2 with accent + JP)
export function SectionHead({ id, before, accent, after, jp, kicker, className, tone = 'paper' }: {
  id?: string; before?: string; accent: string; after?: string; jp?: string; kicker?: string; className?: string; tone?: 'paper' | 'ink'
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {kicker && <p className={cn('label text-[0.6875rem]', tone === 'paper' ? 'text-volt' : 'text-door')}>{kicker}</p>}
      <h2 id={id} className="h-display text-[clamp(2.25rem,5.5vw,4.75rem)]">
        {before}<em>{accent}</em>{after}
      </h2>
      {jp && <p lang="ja" className="jp-sub">{jp}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- hero
export function ShopHero({
  crumbs, kicker, jp, title, intro, stats, accentA = 'var(--color-volt)', accentB = 'var(--color-lav)', accentFg = 'var(--color-ink)', motif = 'speedlines', sfx, children,
}: {
  accentFg?: string
  crumbs: Array<{ name: string; path?: string }>
  kicker: string
  jp?: string
  title: ReactNode
  intro: ReactNode
  stats?: Array<[string, string]>
  accentA?: string
  accentB?: string
  motif?: string
  sfx?: string
  children?: ReactNode
}) {
  return (
    <header className="relative overflow-hidden border-b-4 border-paper/90 bg-ink pt-[calc(var(--header-h)+28px)]">
      <div aria-hidden="true" className="ted-hero-motif pointer-events-none absolute inset-y-0 right-0 w-[min(62vw,860px)] opacity-[0.55] [mask-image:linear-gradient(90deg,transparent,#000_38%)]">
        <ArcMotif motif={motif} colorA={accentA} colorB={accentB} line="#F4EFE6" light="#0B0B0F" animated width={900} height={700} density={0.55} loading="eager" />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 screentone screentone-light [--tone-color:var(--color-paper)] [--tone-opacity:0.07]" />
      <div className="container-x relative pb-10 md:pb-14">
        <Crumbs items={crumbs} className="mb-6 text-paper" />
        <div className="flex max-w-[1100px] flex-col gap-4">
          <p className="label inline-flex w-fit items-center gap-2 border-2 border-paper px-2.5 py-1.5 text-[0.6875rem] text-paper" style={{ boxShadow: `3px 3px 0 0 ${accentA}` }}>
            <DoorIcon open={0.5} size={16} strokeWidth={2.4} /> {kicker}
          </p>
          <h1 className="h-display text-[clamp(3.1rem,9.2vw,9rem)] text-paper [&_em]:[--accent-bg:var(--hero-accent)] [&_em]:[--accent-fg:var(--hero-accent-fg)]" style={{ '--hero-accent': accentA, '--hero-accent-fg': accentFg } as CSSProperties}>
            {title}
          </h1>
          {jp && <p lang="ja" className="jp-sub text-paper">{jp}</p>}
          <div className="max-w-2xl text-[1.0625rem] leading-relaxed text-paper/85">{intro}</div>
          {stats && (
            <dl className="mt-2 flex flex-wrap gap-2">
              {stats.map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-2 border-2 border-paper/70 bg-tone-1 px-3 py-2">
                  <dt className="label order-2 text-[0.625rem] text-paper/70">{k}</dt>
                  <dd className="order-1 font-mono text-lg font-bold text-volt tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {children}
        </div>
      </div>
      {sfx && (
        <div aria-hidden="true" className="pointer-events-none absolute bottom-6 right-[6%] max-md:hidden">
          <Sfx text={sfx} size={72} tone="volt" rotate={-8} />
        </div>
      )}
    </header>
  )
}

// ---------------------------------------------------------------- category tiles
const TILE_TONES = ['bg-volt', 'bg-lav', 'bg-pink', 'bg-paper', 'bg-door text-paper']
export function CategoryTiles({ products, exclude, only, className, headingLevel = 'h3' }: {
  products: Product[]; exclude?: string; only?: string[]; className?: string; headingLevel?: 'h3' | 'h4'
}) {
  const cats = (only ? only.map((s) => CATEGORIES.find((c) => c.slug === s)).filter((c): c is Category => !!c) : CATEGORIES).filter((c) => c.slug !== exclude)
  const H = headingLevel
  return (
    <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5', className)} role="list">
      {cats.map((c, i) => {
        const items = products.filter(c.match)
        const prices = items.map(minPrice).filter((n): n is number => n != null)
        const from = prices.length ? Math.min(...prices) : null
        return (
          <li key={c.slug}>
            <Link
              href={`/shop/${c.slug}`}
              data-cursor="OPEN"
              className={cn('ted-tile press group relative flex h-full min-h-32 flex-col justify-between gap-4 border-[3px] border-ink p-3 text-ink shadow-hard focus-ring md:min-h-40 md:p-4', TILE_TONES[i % TILE_TONES.length])}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-mono text-[0.6875rem] font-bold">{String(i + 1).padStart(2, '0')}</span>
                <ArrowRight aria-hidden="true" className="h-5 w-5 -rotate-45 transition-transform duration-200 group-hover:rotate-0" strokeWidth={2.6} />
              </span>
              <span>
                <H className="h-display text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[0.9]">{c.label}</H>
                <span className="label mt-1.5 block text-[0.625rem] opacity-75">
                  {items.length} {items.length === 1 ? 'piece' : 'pieces'}{from != null ? ` · from ${formatINR(from)}` : ''}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------- packs (bundle rules from data)
export function PacksStrip({ types, className }: { types?: Product['type'][]; className?: string }) {
  const rules = bundleRules.filter((r) => !types || types.includes(r.appliesTo.type))
  if (!rules.length) return null
  const href: Record<string, string> = { polaroid: '/shop/polaroids', poster: '/shop/posters', bookmark: '/shop/bookmarks', badge: '/shop/badges' }
  return (
    <ul className={cn('flex flex-wrap gap-4', className)} role="list">
      {rules.map((r, i) => (
        <li key={r.id}>
          <Link
            href={href[r.appliesTo.type] ?? '/shop'}
            className="press group inline-flex min-h-14 items-center gap-3 border-[3px] border-ink bg-volt px-4 py-2 text-ink shadow-hard focus-ring"
            style={{ transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)` }}
          >
            <span className="h-display text-2xl leading-none md:text-3xl">{r.label}</span>
            <span className="label border-l-2 border-ink pl-3 text-[0.625rem]">
              {r.kind === 'buyXgetY' ? `${r.n + (r.free ?? 0)}th free` : 'auto in cart'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- custom CTA
export function CustomCta({ before = 'Want it ', accent = 'custom', after = '?', body, href = '/custom', cta = 'Open the Custom Forge', id = 'custom' }: {
  before?: string; accent?: string; after?: string; body?: ReactNode; href?: string; cta?: string; id?: string
}) {
  return (
    <section aria-labelledby={`${id}-h`} className="container-x py-16 md:py-24">
      <div className="relative grid gap-6 overflow-hidden border-4 border-paper bg-door p-6 text-paper shadow-hard-volt md:grid-cols-[1.3fr_1fr] md:items-end md:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 screentone screentone-mid [--tone-color:var(--color-ink)] [--tone-opacity:0.25]" />
        <div className="relative flex flex-col gap-3">
          <p lang="ja" className="jp-sub">カスタム</p>
          <h2 id={`${id}-h`} className="h-display text-[clamp(2.5rem,6vw,5rem)]">
            {before}<em>{accent}</em>{after}
          </h2>
          <p className="max-w-xl text-paper/90">
            {body ?? <>Send your own art or let us draw it for you. Front prints up to 4×4 in, back prints up to 12×15 in — we confirm everything on WhatsApp.</>}
          </p>
        </div>
        <div className="relative flex md:justify-end">
          <Link href={href} data-cursor="OPEN" className="press h-display inline-flex min-h-14 items-center gap-3 border-[3px] border-ink bg-volt px-6 text-2xl text-ink shadow-hard focus-ring">
            {cta} <ArrowRight aria-hidden="true" className="h-6 w-6" strokeWidth={2.8} />
          </Link>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- arc door strip
export type ArcCard = Pick<Collection, 'slug' | 'name' | 'jp' | 'accentA' | 'accentB' | 'motif' | 'tagline'>
export function ArcDoorStrip({ arcs, current, counts, className }: { arcs: ArcCard[]; current?: string; counts?: Record<string, number>; className?: string }) {
  const list = arcs.filter((a) => a.slug !== current)
  return (
    <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6', className)} role="list">
      {list.map((a) => (
        <li key={a.slug}>
          <Link
            href={`/arc/${a.slug}`}
            data-cursor="OPEN"
            data-cursor-jp={a.jp}
            className="ted-door group relative flex aspect-[3/4.4] flex-col justify-end overflow-hidden border-[3px] border-paper p-3 text-ink shadow-hard-paper focus-ring"
            style={{ background: a.accentA, borderTopLeftRadius: '999px 60%', borderTopRightRadius: '999px 60%' } as CSSProperties}
          >
            <span aria-hidden="true" className="absolute inset-0 opacity-90 transition-transform duration-500 ease-[var(--ease-expo)] group-hover:scale-110">
              <ArcMotif motif={a.motif} colorA={a.accentA} colorB={a.accentB} width={300} height={440} density={0.5} />
            </span>
            <span aria-hidden="true" className="ted-door-leaf absolute inset-[10px] origin-left border-[3px] border-ink bg-paper/0 transition-transform duration-300 ease-[var(--ease-slam)] [border-top-left-radius:999px_60%] [border-top-right-radius:999px_60%] group-hover:[transform:perspective(600px)_rotateY(-28deg)] group-focus-visible:[transform:perspective(600px)_rotateY(-28deg)]" />
            <span className="relative border-[3px] border-ink bg-paper px-2 py-1.5">
              <span className="h-display block text-xl leading-[0.9] md:text-2xl">{a.name}</span>
              <span lang="ja" className="jp-sub mt-0.5 block !text-[0.625rem] !tracking-[0.18em]">{a.jp}</span>
              {counts?.[a.slug] != null && <span className="label mt-1 block text-[0.5625rem] opacity-70">{counts[a.slug]} pieces</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
