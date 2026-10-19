// S05 SQUAD GRID (#27 #26 #29-hinge "peel" + #08 entrance). Owner: s05-s06 agent.
// Four colour-blocked category panels. Hover / focus (desktop) or tap (touch) expands one panel
// (#27 accordion; Flip reshuffle on the mobile grid), greys the others (#26) and PEELS the active card:
// it tips back on its bottom hinge, a screentone plate shows underneath and an original sticker
// pops out. The peel is used ONCE on the site (DESIGN §7b) — here.
// Server component: all counts / prices come from the catalogue (repo, 'use cache'); the art is
// rendered here so the client bundle only carries the interaction.
import type { Product, ProductType } from '@/lib/types'
import { getApparelCustom, getBundleRules, getHoodieTiers, getProducts, getTeeFits } from '@/lib/data/repo'
import { formatINR, formatINRRange } from '@/lib/pricing'
import { ProductArt } from '@/components/shop/ProductArt'
import { Sfx } from '@/components/fx/Sfx'
import SquadGrid, { type SquadPanel } from './s05/SquadGrid'

interface CatDef {
  key: string
  types: ProductType[]
  href: string
  title: string
  /** short noun for the CTA ("Shop tees") */
  noun: string
  jp: string
  tone: SquadPanel['tone']
}

const CATS: CatDef[] = [
  { key: 'tees', types: ['tshirt'], href: '/shop/oversized-t-shirts', title: 'Tees', noun: 'tees', jp: 'Tシャツ', tone: 'volt' },
  { key: 'hoodies', types: ['hoodie'], href: '/shop/hoodies', title: 'Hoodies', noun: 'hoodies', jp: 'パーカー', tone: 'lav' },
  { key: 'prints', types: ['polaroid', 'poster'], href: '/shop/polaroids', title: 'Polaroids & Posters', noun: 'prints', jp: 'ポラロイド', tone: 'pink' },
  { key: 'cosplay', types: ['katana', 'cape', 'hat', 'cosplay'], href: '/shop/cosplay-props', title: 'Cosplay & Props', noun: 'props', jp: 'コスプレ', tone: 'door' },
]

const isApparel = (p: Product) => p.type === 'tshirt' || p.type === 'hoodie'

function pickHero(list: Product[], prefer?: ProductType): Product | undefined {
  const pool = prefer ? list.filter((p) => p.type === prefer) : list
  // the drop of the week already owns S03/S04 — show a different design here
  const fresh = pool.filter((p) => !p.dropOfWeek)
  return fresh.find((p) => p.featured) ?? fresh[0] ?? pool[0] ?? list[0]
}

function minPrice(list: Product[]): number | null {
  const prices = list.map((p) => p.priceFrom).filter((n): n is number => typeof n === 'number' && n > 0)
  return prices.length ? Math.min(...prices) : null
}

export default async function S05Squad(_props: { products?: Product[] }) {
  const [all, tiers, fits, rules, apparelCustom] = await Promise.all([getProducts(), getHoodieTiers(), getTeeFits(), getBundleRules(), getApparelCustom()])

  const polaroidRule = rules.find((r) => r.appliesTo.type === 'polaroid' && r.kind === 'nForPrice')
  const posterRule = rules.find((r) => r.appliesTo.type === 'poster')
  const topTier = [...tiers].sort((a, b) => b.level - a.level)[0]
  const back = apparelCustom.zones.back

  const panels: SquadPanel[] = CATS.map((c, i) => {
    const list = all.filter((p) => c.types.includes(p.type))
    const from = minPrice(list)
    const hero = pickHero(list, c.key === 'prints' ? 'polaroid' : c.key === 'cosplay' ? 'katana' : undefined)

    let detail = ''
    let sticker: SquadPanel['sticker'] = { big: c.jp, small: 'NEW' }
    if (c.key === 'tees') {
      detail = [...fits].sort((a, b) => b.price - a.price).map((f) => `${f.label} ${formatINR(f.price)}`).join(' · ')
      sticker = { big: `${back.w}×${back.h}`, small: 'BACK PRINT · IN' }
    } else if (c.key === 'hoodies') {
      const lo = Math.min(...tiers.map((t) => t.price))
      const hi = Math.max(...tiers.map((t) => t.price))
      detail = `${tiers.length} GSM levels · ${formatINRRange(lo, hi)}`
      if (topTier) sticker = { big: topTier.code, small: `${topTier.gsmMax} GSM` }
    } else if (c.key === 'prints') {
      const pol = minPrice(list.filter((p) => p.type === 'polaroid'))
      const pos = minPrice(list.filter((p) => p.type === 'poster'))
      const bits: string[] = []
      if (pol) bits.push(`Polaroids ${formatINR(pol)}`)
      if (polaroidRule?.price) bits.push(`${polaroidRule.n} for ${formatINR(polaroidRule.price)}`)
      if (pos) bits.push(`Posters ${formatINR(pos)}`)
      detail = bits.join(' · ')
      if (posterRule?.kind === 'buyXgetY' && pos) detail += ` · buy ${posterRule.n}, get ${posterRule.free ?? 1} free`
      if (polaroidRule?.price) sticker = { big: formatINR(polaroidRule.price), small: `${polaroidRule.n} POLAROIDS` }
    } else {
      const kinds = Array.from(
        new Set(list.map((p) => (p.type === 'katana' ? 'Katanas' : p.type === 'cape' ? 'Capes' : p.type === 'hat' ? 'Hats' : 'Props'))),
      )
      detail = kinds.join(' · ')
      const led = list.some((p) => p.type === 'katana' && /led/i.test(p.slug))
      sticker = led ? { big: 'LED', small: 'KATANA' } : { big: 'コス', small: 'PROPS' }
    }

    return {
      key: c.key,
      index: String(i + 1).padStart(2, '0'),
      href: c.href,
      title: c.title,
      noun: c.noun,
      jp: c.jp,
      tone: c.tone,
      count: list.length,
      from: from ? formatINR(from) : null,
      detail,
      sticker,
      art: hero ? <ProductArt product={hero} side={isApparel(hero) ? 'back' : 'front'} title="" className="h-full w-full" /> : null,
    }
  })

  return (
    <section id="squad" aria-labelledby="squad-title" className="section-y relative overflow-hidden border-t-4 border-ink bg-ink text-paper">
      <div className="container-x">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="label text-volt">Chapter 05 · The squad</p>
            <h2 id="squad-title" className="h-display mt-4 max-w-[15ch] text-h2">
              Every <em>panel</em> of the shop: tees to katanas
            </h2>
            <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
              全コマ、集合
            </span>
          </div>
          <div className="relative lg:col-span-4">
            <Sfx
              text="ズラッ"
              size={64}
              tone="volt"
              rotate={-8}
              pop
              className="pointer-events-none absolute -top-24 right-2 hidden lg:inline-block"
            />
            <p className="max-w-[40ch] text-paper/80">
              Four doors into the shop: tees, hoodies, prints and cosplay props. Pick a panel and it steps forward.
              Every design is original, fan-made art.
            </p>
            <p className="label mt-4 text-tone-4">
              <span className="hidden can-hover:inline">Hover a panel · click to open</span>
              <span className="can-hover:hidden">Tap a panel · tap again to open</span>
            </p>
          </div>
        </div>

        <SquadGrid panels={panels} />
      </div>
    </section>
  )
}
