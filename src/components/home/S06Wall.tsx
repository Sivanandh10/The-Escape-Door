// S06 POLAROID & STICKER WALL (#45 #52 #29). Owner: s05-s06 agent.
// An ink wall of scattered polaroids, a poster, badges, die-cut stickers and a bookmark — all original
// art (ArcMotif + our type), captions handwritten. Everything is draggable (WallBoard, client).
// The tilted pill (#52) sells the real bundle rule from data; secondary pills for bookmarks / badges.
import type { CSSProperties } from 'react'
import Link from 'next/link'
import type { BundleRule, Collection, Product } from '@/lib/types'
import { getBundleRules, getCollections } from '@/lib/data/repo'
import { formatINR } from '@/lib/pricing'
import { ArcMotif } from '@/components/fx/ArcMotif'
import { readableOn } from '@/components/layout/nav'
import { cn } from '@/lib/utils'
import WallBoard, { type WallItem } from './s06/WallBoard'
import { hand } from './s06/hand'
import './s06/wall.css'
import { styles } from './s06/classes'

type Slot = { d: [number, number, number]; m: [number, number, number] | null }
type SlotKey = 'poster' | 'polE' | 'polA' | 'badgeA' | 'polB' | 'note' | 'polC' | 'bookmark' | 'polD' | 'stickerA' | 'stickerB' | 'badgeB'

// hand-placed composition (left %, top %, rotation) — desktop/tablet and phone
const SLOTS = {
  // key order = DOM order = initial stacking (later = on top)
  poster: { d: [3, 8, -4], m: [3, 3, -4] },
  polE: { d: [4, 57, 8], m: null },
  polA: { d: [19, 5, 6], m: [50, 2, 6] },
  badgeA: { d: [35, 4, 0], m: [37, 27, 0] },
  polB: { d: [33, 33, -7], m: [4, 37, -6] },
  note: { d: [51, 7, 4], m: [62, 32, 4] },
  polC: { d: [50, 44, 5], m: [55, 69, 5] },
  bookmark: { d: [66, 9, 11], m: null },
  polD: { d: [71, 40, -5], m: null },
  stickerA: { d: [17, 72, -9], m: [40, 58, -7] },
  stickerB: { d: [83, 30, 8], m: null },
  badgeB: { d: [88, 66, 0], m: null },
} satisfies Record<SlotKey, Slot>

const TAPES = ['var(--color-lav)', 'var(--color-volt)', 'var(--color-pink)']

function ruleText(r: BundleRule | undefined): string | null {
  if (!r) return null
  if (r.kind === 'nForPrice' && r.price) return `${r.n} for ${formatINR(r.price)}`
  if (r.kind === 'buyXgetY') return `Buy ${r.n}, get ${r.free ?? 1} free`
  return null
}

export default async function S06Wall({ products = [] }: { products?: Product[] }) {
  const [rules, collections] = await Promise.all([getBundleRules(), getCollections()])
  const col = (slug: string): Collection | undefined => collections.find((c) => c.slug === slug)
  const of = (t: Product['type']) => products.filter((p) => p.type === t)
  const motifFor = (p: Product) => {
    const c = col(p.collection)
    return { motif: c?.motif ?? 'speedlines', a: c?.accentA ?? '#6D3BFF', b: c?.accentB ?? '#C9B8FF', name: c?.name ?? '', jp: c?.jp ?? '' }
  }

  const polaroidRule = rules.find((r) => r.appliesTo.type === 'polaroid')
  const plainBookmarkRule = rules.find((r) => r.appliesTo.type === 'bookmark' && r.appliesTo.variantAttr?.[1] === 'plain')
  const badgeRule = rules.find((r) => r.appliesTo.type === 'badge')
  const posterRule = rules.find((r) => r.appliesTo.type === 'poster')
  const polaroidPrice = Math.min(...of('polaroid').map((p) => p.priceFrom ?? Infinity))
  const posterPrice = Math.min(...of('poster').map((p) => p.priceFrom ?? Infinity))

  const bySlot: Partial<Record<SlotKey, WallItem>> = {}
  const put = (k: SlotKey, it: Omit<WallItem, 'd' | 'm'>) => {
    bySlot[k] = { ...it, ...SLOTS[k] }
  }

  // polaroids — one per arc where possible
  const polKeys = ['polA', 'polB', 'polC', 'polD', 'polE'] as const
  const seen = new Set<string>()
  const pols = [...of('polaroid').filter((p) => !seen.has(p.collection) && seen.add(p.collection)), ...of('polaroid')]
  polKeys.forEach((k, i) => {
    const p = pols[i]
    if (!p) return
    const m = motifFor(p)
    put(k, {
      id: `pol-${p.slug}-${i}`,
      label: `Polaroid print: ${p.designTitle}${m.name ? ` (${m.name})` : ''}`,
      node: (
        <div className={cn(styles.polaroid, styles.lift)} style={{ '--a': m.a, '--tape': TAPES[i % TAPES.length] } as CSSProperties}>
          <span className={styles.tape} aria-hidden="true" />
          <div className={styles.photo}>
            <ArcMotif motif={m.motif} colorA={m.a} colorB={m.b} width={400} height={400} density={0.7} seed={`${p.slug}-wall`} />
          </div>
          <span className={cn(styles.caption, hand.className)}>{p.designTitle.toLowerCase()}</span>
        </div>
      ),
    })
  })

  // poster
  const poster = of('poster')[0]
  if (poster) {
    const m = motifFor(poster)
    put('poster', {
      id: `poster-${poster.slug}`,
      label: `Poster: ${poster.designTitle}${m.name ? ` (${m.name})` : ''}`,
      node: (
        <div className={cn(styles.poster, styles.lift)} style={{ '--a': m.b } as CSSProperties}>
          <span className={styles.pin} aria-hidden="true" />
          <div className={styles.posterArt}>
            <ArcMotif motif={m.motif} colorA={m.a} colorB={m.b} width={360} height={300} density={0.75} seed={`${poster.slug}-wall`} />
          </div>
          <span className={styles.posterTitle}>{poster.designTitle}</span>
          <span className={styles.posterSub}>{m.jp || 'POSTER'} · THE ESCAPE DOOR</span>
        </div>
      ),
    })
  }

  // badges
  of('badge')
    .slice(0, 2)
    .forEach((p, i) => {
      const m = motifFor(p)
      put(i === 0 ? 'badgeA' : 'badgeB', {
        id: `badge-${p.slug}`,
        label: `Pin badge: ${p.designTitle}${m.name ? ` (${m.name})` : ''}`,
        node: (
          <div className={cn(styles.badge, styles.lift)} style={{ '--a': m.a } as CSSProperties}>
            <ArcMotif motif={m.motif} colorA={m.a} colorB={m.b} width={240} height={240} density={0.8} seed={`${p.slug}-pin`} />
            <span className={styles.badgeShine} aria-hidden="true" />
          </div>
        ),
      })
    })

  // die-cut stickers
  of('sticker')
    .slice(0, 2)
    .forEach((p, i) => {
      const m = motifFor(p)
      const fill = i === 0 ? m.a : m.b
      put(i === 0 ? 'stickerA' : 'stickerB', {
        id: `sticker-${p.slug}`,
        label: `Sticker: ${p.designTitle}${m.name ? ` (${m.name})` : ''}`,
        node: (
          <span
            className={cn(styles.sticker, styles.lift)}
            style={{ '--a': fill, '--on-a': readableOn(fill) === 'ink' ? 'var(--color-ink)' : 'var(--color-paper)' } as CSSProperties}
          >
            {p.designTitle}
            {m.jp ? (
              <span lang="ja" className={styles.stickerJp}>
                {m.jp}
              </span>
            ) : null}
          </span>
        ),
      })
    })

  // bookmark
  const bm = of('bookmark')[0]
  if (bm) {
    const m = motifFor(bm)
    put('bookmark', {
      id: `bookmark-${bm.slug}`,
      label: `Bookmark: ${bm.designTitle}${m.name ? ` (${m.name})` : ''}`,
      node: (
        <div className={cn(styles.bookmark, styles.lift)} style={{ '--a': m.a } as CSSProperties}>
          <span className={styles.tassel} aria-hidden="true" />
          <ArcMotif motif={m.motif} colorA={m.a} colorB={m.b} width={120} height={440} density={0.8} seed={`${bm.slug}-wall`} />
          <span className={styles.bookmarkTitle}>{bm.designTitle}</span>
        </div>
      ),
    })
  }

  // handwritten note with the real deal
  const pText = polaroidRule?.kind === 'nForPrice' && polaroidRule.price ? `${polaroidRule.n} polaroids = ${formatINR(polaroidRule.price)}` : null
  if (pText) {
    put('note', {
      id: 'note-deal',
      label: `Note: ${pText}`,
      node: (
        <div className={cn(styles.note, styles.lift, hand.className)}>
          <span className={styles.tape} aria-hidden="true" style={{ '--tape': 'var(--color-pink)' } as CSSProperties} />
          {pText} ✦<span className={styles.noteSmall}>mix any designs</span>
        </div>
      ),
    })
  }

  const items = (Object.keys(SLOTS) as SlotKey[]).flatMap((k) => (bySlot[k] ? [bySlot[k]] : []))

  const pill = ruleText(polaroidRule)
  const minis = [
    { href: '/shop/bookmarks', label: 'Bookmarks', deal: ruleText(plainBookmarkRule) },
    { href: '/shop/badges', label: 'Badges', deal: ruleText(badgeRule) },
    { href: '/shop/posters', label: 'Posters', deal: ruleText(posterRule) },
  ].filter((m) => m.deal)

  return (
    <section id="wall" aria-labelledby="wall-title" className="section-y relative overflow-hidden border-t-4 border-ink bg-lav text-ink">
      <div className="container-x">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="label">Chapter 06 · Polaroid & sticker wall</p>
            <h2 id="wall-title" className="h-display mt-4 max-w-[14ch] text-h2">
              Pin up the <em>wall</em>: polaroids 3 for ₹100
            </h2>
            <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
              壁を埋めろ
            </span>
          </div>
          <p className="max-w-[44ch] lg:col-span-5 lg:pb-2">
            {Number.isFinite(polaroidPrice) ? `Polaroids are ${formatINR(polaroidPrice)} each` : 'Polaroids'}
            {pText ? ` or ${formatINR(polaroidRule!.price!)} for ${polaroidRule!.n}` : ''}.
            {Number.isFinite(posterPrice) ? ` Posters are ${formatINR(posterPrice)}` : ''}
            {posterRule?.kind === 'buyXgetY' ? `: buy ${posterRule.n}, get ${posterRule.free ?? 1} free` : ''}. Go on, rearrange the wall —
            every pin moves.
          </p>
        </div>

        <div className={styles.wrap}>
          <WallBoard items={items} hint="Drag anything" hintJp="ドラッグ" />
          {pill ? (
            <Link href="/shop/polaroids" className={styles.pill} data-cursor="OPEN">
              <span className={styles.pillBig}>{pill}</span>
              <span className={styles.pillSmall}>Shop anime polaroids →</span>
            </Link>
          ) : null}
        </div>

        {minis.length ? (
          <ul className={styles.minis} aria-label="More bundle deals">
            {minis.map((m) => (
              <li key={m.href}>
                <Link href={m.href} className={styles.mini}>
                  {m.label} <span className={styles.miniPrice}>{m.deal}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
