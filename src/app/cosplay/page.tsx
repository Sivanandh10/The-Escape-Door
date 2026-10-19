// /cosplay — Cosplay, panel by panel (SITEMAP §2.8). Owner: P5.
// Editorial + commercial-investigation; buy intent lives on /shop/cosplay-props (cannibalisation guard).
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Panel } from '@/components/fx/Panel'
import { Sfx } from '@/components/fx/Sfx'
import { Reveal } from '@/components/motion/Reveal'
import JsonLd from '@/components/seo/JsonLd'
import { PageHero } from '@/components/content/PageHero'
import { SectionHead } from '@/components/content/SectionHead'
import { KatanaCompare, type KatanaSide } from '@/components/content/KatanaCompare'
import { PropTile } from '@/components/content/PropTile'
import { Accordion } from '@/components/content/Accordion'
import { CtaPanel } from '@/components/content/CtaPanel'
import { pageMeta } from '@/components/content/meta'
import { COSPLAY_FAQ, faqById } from '@/components/content/faq'
import { getCollections, getPartnerships, getProducts } from '@/lib/data/repo'
import { collectionPageJsonLd, faqJsonLd } from '@/lib/seo'
import { productPriceLabel } from '@/lib/pricing'
import type { Product } from '@/lib/types'

export const metadata = pageMeta({
  title: 'Anime Cosplay Props India — Katanas, Capes | Escape Door',
  description:
    'Plan your anime cosplay: basic katanas ₹1200–2000, LED katanas ₹3000–4000, capes ₹700–1000, keychains and earrings. Build your fest look.',
  path: '/cosplay',
  ogImage: false,
})

function side(p: Product): KatanaSide {
  const img = p.images[0]
  return {
    slug: p.slug,
    name: p.name,
    src: img?.src ?? `/mockups/${p.slug}-front.webp`,
    alt: img?.alt ?? `${p.name} by The Escape Door`,
    price: productPriceLabel(p),
    line: p.description,
  }
}

const isEarring = (p: Product) => p.tags.includes('earrings')

export default async function CosplayPage() {
  const [props, collections, partnerships] = await Promise.all([
    getProducts({ type: ['katana', 'cape', 'accessory', 'keychain', 'figurine', 'hat', 'cosplay'] }),
    getCollections(),
    getPartnerships(),
  ])
  const names = new Map(collections.map((c) => [c.slug, c.name]))
  const katanas = props.filter((p) => p.type === 'katana')
  const basic = katanas.find((k) => k.tags.includes('basic')) ?? katanas[0]
  const led = katanas.find((k) => k.tags.includes('led')) ?? katanas[1]
  const capes = props.filter((p) => p.type === 'cape')
  const touches = props.filter((p) => p.type === 'keychain' || isEarring(p))
  const figurines = props.filter((p) => p.type === 'figurine')
  const contests = partnerships.filter((p) => /cosplay/i.test(p.role)).sort((a, b) => a.order - b.order)
  const priceOf = (ps: Product[]) => (ps[0] ? productPriceLabel(ps[0]) : '')

  const qa = [faqById('katana-price')!, ...COSPLAY_FAQ]

  const PIECES = [
    { n: '01', t: 'The prop', d: 'A katana carries the whole silhouette.', p: priceOf(katanas), href: '#katana', tone: 'volt' as const },
    { n: '02', t: 'The cape', d: 'Movement for every photo and stage walk.', p: priceOf(capes), href: '#capes', tone: 'lav' as const },
    { n: '03', t: 'The details', d: 'Earrings and keychains people notice up close.', p: touches[0] ? productPriceLabel(touches[0]) : '', href: '#touches', tone: 'pink' as const },
    { n: '04', t: 'The base layer', d: 'A tee or hoodie from your arc under it all.', p: '', href: '/shop/oversized-t-shirts', tone: 'paper' as const },
  ]

  return (
    <>
      <PageHero
        kicker="Cosplay corner · Props & capes"
        title={
          <>
            Cosplay, panel by <em>panel</em>
          </>
        }
        jp="コスプレ"
        crumbs={[{ name: 'Cosplay', path: '/cosplay' }]}
        sfx="シャキン"
        rail="COSPLAY"
        focus={{ x: 0.75, y: 0.55 }}
        intro={
          <p>
            Plan a fest-ready look one panel at a time: a katana for the silhouette, a cape for movement and small accessories
            for the close-ups. Every prop is a cosplay and display piece, never a real blade.
          </p>
        }
      >
        <Link href="#katana" className="press focus-ring label inline-flex min-h-13 items-center gap-2 border-[3px] border-ink bg-volt px-5 py-3.5 text-[13px] font-bold text-ink shadow-[5px_5px_0_0_var(--color-paper)] hover:bg-volt-hot">
          Basic or LED? Compare
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        <Link href="/shop/cosplay-props" className="focus-ring label inline-flex min-h-12 items-center gap-2 border-[3px] border-paper px-4 py-3 text-paper transition-colors duration-150 hover:bg-paper hover:text-ink">
          Shop cosplay props
        </Link>
      </PageHero>

      {/* 01 — four pieces */}
      <section aria-labelledby="pieces" className="section-y relative border-t-4 border-ink bg-paper text-ink grain">
        <div className="container-x">
          <SectionHead n="01" label="The plan" jp="四つのパーツ" id="pieces" tone="paper" intro={<p>Most fest cosplays come down to four pieces. Start with the one people see from across the quad.</p>}>
            Build a look in four <em>pieces</em>
          </SectionHead>
          <Reveal as="ol" variant="slam" stagger={0.1} className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PIECES.map((x) => (
              <li key={x.n}>
                <Link href={x.href} className="group focus-ring block h-full">
                  <Panel tone={x.tone} shadow="ink" className="h-full transition-transform duration-200 can-hover:group-hover:-translate-y-1.5 can-hover:group-hover:-rotate-1" innerClassName="flex h-full min-h-[220px] flex-col p-5">
                    <span className="font-mono text-[13px] font-bold">{x.n}</span>
                    <span className="font-display mt-3 text-[40px] uppercase leading-[0.9]">{x.t}</span>
                    <span className="mt-3 text-[15px]">{x.d}</span>
                    <span className="mt-auto flex items-center justify-between pt-5">
                      <span className="font-mono text-[15px] font-bold">{x.p}</span>
                      <ArrowRight aria-hidden="true" className="size-5 transition-transform duration-200 can-hover:group-hover:translate-x-1" />
                    </span>
                  </Panel>
                </Link>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 02 — Basic or LED */}
      {basic && led && (
        <section id="katana" aria-labelledby="katana-title" className="section-y relative scroll-mt-20 bg-ink text-paper">
          <div className="container-x">
            <SectionHead
              n="02"
              label="The prop"
              jp="普通 vs LED"
              id="katana-title"
              className="mb-12"
              intro={<p>Both are cosplay and display props. The LED version adds a built-in blade glow for night photos and stage walks.</p>}
            >
              Basic or <em>LED</em> katana?
            </SectionHead>
            <KatanaCompare basic={side(basic)} led={side(led)} />
          </div>
        </section>
      )}

      {/* 03 — Capes */}
      <section id="capes" aria-labelledby="capes-title" className="section-y relative scroll-mt-20 border-t-4 border-ink bg-lav text-ink">
        <div className="container-x grid gap-12 lg:grid-cols-12">
          <SectionHead
            n="03"
            label="The cape"
            jp="マント"
            id="capes-title"
            tone="paper"
            className="lg:col-span-5"
            intro={
              <p>
                A cape is the cheapest way to make a costume move. Ours run {priceOf(capes) || 'by design'}, cut long so they catch the
                wind on a walk across campus.
              </p>
            }
          >
            Capes that <em className="accent-door">move</em> with you
          </SectionHead>
          <Reveal as="ul" stagger={0.1} className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
            {capes.map((p) => (
              <li key={p.id}>
                <PropTile product={p} collectionName={names.get(p.collection)} />
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 04 — Finishing touches */}
      <section id="touches" aria-labelledby="touches-title" className="section-y relative scroll-mt-20 border-t-4 border-ink bg-paper text-ink grain">
        <div className="container-x">
          <SectionHead
            n="04"
            label="The details"
            jp="仕上げ"
            id="touches-title"
            tone="paper"
            intro={<p>Earrings, keychains and figurines finish the look, and they are easy gifts for the friend you are cosplaying with.</p>}
          >
            Finishing touches: earrings and <em>keychains</em>
          </SectionHead>
          <Reveal as="ul" stagger={0.08} className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[...touches, ...figurines].slice(0, 8).map((p) => (
              <li key={p.id}>
                <PropTile product={p} collectionName={names.get(p.collection)} />
              </li>
            ))}
          </Reveal>
          <Link href="/shop/accessories" className="focus-ring label mt-8 inline-flex min-h-11 items-center gap-2 underline decoration-2 underline-offset-4 hover:text-door">
            All anime accessories and keychains
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>

      {/* 05 — Cosplay at your fest */}
      <section aria-labelledby="fest-title" className="section-y relative overflow-hidden border-t-4 border-ink bg-ink text-paper">
        <div className="container-x grid gap-12 lg:grid-cols-12">
          <SectionHead
            n="05"
            label="On stage"
            jp="フェスで"
            id="fest-title"
            className="lg:col-span-5"
            intro={<p>We back cosplay competitions at college fests and online. If your fest runs one, we would like to hear about it.</p>}
          >
            Cosplay for your college <em>fest</em>
          </SectionHead>
          <Reveal as="ul" variant="slam" stagger={0.12} className="grid gap-4 lg:col-span-7">
            {contests.map((c, i) => (
              <li key={c.id}>
                <Panel tone={i === 0 ? 'volt' : i === 1 ? 'pink' : 'paper'} shadow="paper" slant={i % 2 ? 'left' : 'right'} slantSize="6%" innerClassName="px-[8%] py-5 sm:py-6">
                  <p className="label">{c.role}</p>
                  <p className="font-display mt-2 text-[clamp(32px,4vw,52px)] uppercase leading-[0.9]">{c.fest}</p>
                  <p className="mt-2 text-[15px] font-medium">{[c.institution, c.detail].filter(Boolean).join(' · ')}</p>
                </Panel>
              </li>
            ))}
          </Reveal>
        </div>
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-4 left-[3%] hidden lg:block">
          <Sfx text="ゴゴゴ" size="lg" tone="door" rotate={-8} pop />
        </span>
        <div className="container-x relative mt-10">
          <Link href="/fests" className="press focus-ring label inline-flex min-h-12 items-center gap-2 border-[3px] border-paper px-4 py-3 font-bold transition-colors duration-150 hover:bg-paper hover:text-ink">
            See our fest partnerships
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>

      {/* 06 — FAQ */}
      <section aria-labelledby="ask" className="section-y relative border-t-4 border-ink bg-paper text-ink grain">
        <div className="container-x grid gap-12 lg:grid-cols-12">
          <SectionHead n="06" label="Before you buy" jp="よくある質問" id="ask" tone="paper" className="lg:col-span-4">
            Questions cosplayers <em>ask</em>
          </SectionHead>
          <Accordion items={qa} level={3} className="lg:col-span-8" />
        </div>
      </section>

      <CtaPanel
        kicker="Next chapter · 次の章"
        title="Gear up for the stage"
        jp="準備完了"
        primary={{ href: '/shop/cosplay-props', label: 'Shop cosplay props' }}
        links={[
          { href: '/arc/demon-slayer', label: 'Demon Slayer arc' },
          { href: '/arc/naruto', label: 'Naruto arc' },
          { href: '/arc/one-piece', label: 'One Piece arc' },
          { href: '/fests', label: 'Fest stalls' },
        ]}
        sfx="ドン!"
      />

      <JsonLd
        data={[
          collectionPageJsonLd('Anime cosplay props', '/cosplay', props, 'Cosplay katanas (basic and LED), capes, earrings, keychains and figurines from The Escape Door.'),
          faqJsonLd(qa.map(({ q, a }) => ({ q, a }))),
        ]}
      />
    </>
  )
}
