// /about — Behind the Escape Door (SITEMAP §2.9). Owner: P5.
// ONLY facts we have: Instagram bio lines, the notebook's design-library sizes, fest history and pop-up
// cities from data. "Who's behind the door" stays hidden until the owner supplies names/city/year.
import Link from 'next/link'
import { ArrowRight, Camera } from 'lucide-react'
import { Badge } from '@/components/brand'
import { ArcMotif } from '@/components/fx/ArcMotif'
import { Panel } from '@/components/fx/Panel'
import { Reveal } from '@/components/motion/Reveal'
import { Tilt } from '@/components/motion/Tilt'
import JsonLd from '@/components/seo/JsonLd'
import { PageHero } from '@/components/content/PageHero'
import { SectionHead } from '@/components/content/SectionHead'
import { CountUp } from '@/components/content/CountUp'
import { CtaPanel } from '@/components/content/CtaPanel'
import { pageMeta } from '@/components/content/meta'
import { getCollections, getEvents, getPartnerships } from '@/lib/data/repo'
import { absUrl, DISCLAIMER, INSTAGRAM_URL, ORG_ID, orgJsonLd, WEBSITE_ID } from '@/lib/seo'
import { readableOn } from '@/components/layout/nav'

export const metadata = pageMeta({
  title: 'About The Escape Door — Fandom Merch, Anime First',
  description:
    'The Escape Door makes fan-inspired, original merch for anime and every other fandom: tees, hoodies, polaroids, props. Find us at college fests.',
  path: '/about',
  ogImage: false,
})

// Instagram bio (@escapedoor.in) — verbatim lines.
const BIO = ['Premium Fandom Collectibles', 'Custom-Made', 'Collabs & Pop-Up Events', 'Crafting Your Fandom Dreams', 'DM to Personalize']

// Notebook (docs/source/NOTEBOOK_TRANSCRIPTION.md) design-library sizes.
const LIBRARY = [
  { n: 2000, s: '', label: 'T-shirt designs', tone: 'bg-volt' },
  { n: 1500, s: '', label: 'Polaroid designs', tone: 'bg-lav' },
  { n: 1800, s: '', label: 'Plain bookmark designs', tone: 'bg-pink' },
  { n: 450, s: '', label: 'Magnetic bookmark designs', tone: 'bg-paper' },
  { n: 750, s: '', label: 'Poster designs', tone: 'bg-volt' },
  { n: 400, s: '+', label: 'Badge designs', tone: 'bg-lav' },
] as const

export default async function AboutPage() {
  const [collections, partnerships, events] = await Promise.all([getCollections(), getPartnerships(), getEvents()])
  const anime = collections.filter((c) => c.group === 'anime').sort((a, b) => a.order - b.order)
  const beyond = collections.find((c) => c.group === 'beyond')
  const fests = [...partnerships].sort((a, b) => a.order - b.order)
  const cities = events.filter((e) => e.kind === 'popup').map((e) => e.city)

  return (
    <>
      <PageHero
        kicker="About · Anime first"
        title={
          <>
            Behind the Escape <em>Door</em>
          </>
        }
        jp="扉の向こう"
        crumbs={[{ name: 'About', path: '/about' }]}
        rail="ESCAPE DOOR"
        intro={
          <p>
            The Escape Door makes original, fan-inspired merch for anime and every fandom beyond it: tees, hoodies, polaroids,
            posters, badges and cosplay props. You will find us on Instagram and at college fests across India.
          </p>
        }
        aside={
          <Tilt max={6} className="mx-auto block max-w-[420px] lg:ml-auto">
            <Panel tone="paper" shadow="volt" innerClassName="p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <Badge size={72} title="" />
                <div>
                  <p className="font-display text-[26px] uppercase leading-none">The Escape Door</p>
                  <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="focus-ring label mt-1 inline-flex min-h-8 items-center gap-1.5 hover:text-door">
                    <Camera aria-hidden="true" className="size-3.5" />
                    @escapedoor.in
                  </a>
                </div>
              </div>
              <ul className="mt-6 space-y-2 border-t-[3px] border-ink pt-5" aria-label="Our Instagram bio">
                {BIO.map((line, i) => (
                  <li key={line} className="flex items-baseline gap-3 text-[17px] font-semibold">
                    <span aria-hidden="true" className="font-mono text-[12px] text-tone-3">{String(i + 1).padStart(2, '0')}</span>
                    {line}
                  </li>
                ))}
              </ul>
            </Panel>
          </Tilt>
        }
      />

      {/* 01 — anime first */}
      <section aria-labelledby="first" className="section-y relative border-t-4 border-ink bg-paper text-ink grain">
        <div className="container-x grid gap-12 lg:grid-cols-12">
          <SectionHead
            n="01"
            label="The arcs"
            jp="アニメが先"
            id="first"
            tone="paper"
            className="lg:col-span-5"
            intro={
              <>
                <p>
                  Most of what we make starts with anime, so most of this site does too. Each series gets its own arc: a door with
                  its own colours, motif and set of original designs.
                </p>
                <p className="mt-4">Everything else, from K-pop and F1 to books and coffee, lives behind one more door: Beyond Anime.</p>
              </>
            }
          >
            Why anime comes <em>first</em>
          </SectionHead>
          <Reveal as="ul" stagger={0.07} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-7">
            {[...anime, ...(beyond ? [beyond] : [])].map((c) => {
              const fg = readableOn(c.accentA) === 'ink' ? 'text-ink' : 'text-paper'
              return (
                <li key={c.slug}>
                  <Link
                    href={`/arc/${c.slug}`}
                    data-cursor="OPEN"
                    className={`group focus-ring relative flex aspect-[3/4] flex-col justify-end overflow-hidden border-4 border-ink p-4 shadow-hard transition-transform duration-200 can-hover:hover:-translate-y-1 ${fg}`}
                    style={{ backgroundColor: c.accentA }}
                  >
                    <ArcMotif motif={c.motif} colorA={c.accentA} colorB={c.accentB} className="absolute inset-0 h-full w-full opacity-70 transition-transform duration-500 can-hover:group-hover:scale-110" />
                    <span className="relative font-display text-[clamp(24px,2.6vw,34px)] uppercase leading-[0.9]">{c.name}</span>
                    <span lang="ja" aria-hidden="true" className="jp-sub relative mt-1 block text-[11px]">{c.jp}</span>
                  </Link>
                </li>
              )
            })}
          </Reveal>
        </div>
      </section>

      {/* 02 — library */}
      <section aria-labelledby="designs" className="section-y relative bg-ink text-paper">
        <div className="container-x">
          <SectionHead n="02" label="The library" jp="デザイン" id="designs" intro={<p>Our design libraries, counted from our own price book. Every design is original fan art, not studio artwork.</p>}>
            Over 2000 <em>designs</em> and counting
          </SectionHead>
          <Reveal as="dl" variant="slam" stagger={0.08} className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {LIBRARY.map((x) => (
              <div key={x.label} className={`border-4 border-ink p-4 text-ink shadow-[6px_6px_0_0_var(--color-paper)] sm:p-6 ${x.tone}`}>
                <dd className="font-mono text-[clamp(40px,6vw,84px)] font-bold leading-none tracking-[-0.03em]">
                  <CountUp value={x.n} suffix={x.s} />
                </dd>
                <dt className="label mt-3">{x.label}</dt>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 03 — Instagram to campus */}
      <section aria-labelledby="campus" className="section-y relative border-t-4 border-ink bg-lav text-ink">
        <div className="container-x grid gap-12 lg:grid-cols-12">
          <SectionHead
            n="03"
            label="Where we show up"
            jp="キャンパスへ"
            id="campus"
            tone="paper"
            className="lg:col-span-6"
            intro={
              <p>
                New designs land on Instagram first. Then we pack them up and take them to fests: Fandom Partner at Thomso, IIT
                Roorkee, three times, with stalls, gifting and cosplay competitions at fests across the country.
              </p>
            }
          >
            From Instagram to your <em className="accent-door">campus</em>
          </SectionHead>
          <div className="lg:col-span-6 lg:pt-10">
            <p className="label">Fests & events</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {fests.map((f) => (
                <li key={f.id} className="label border-[3px] border-ink bg-paper px-2.5 py-1.5">
                  {f.fest}
                  {f.years ? ` · ${f.years}` : ''}
                </li>
              ))}
            </ul>
            {cities.length > 0 && (
              <>
                <p className="label mt-8">Pop-up cities</p>
                <p className="font-display mt-2 text-[clamp(40px,5vw,72px)] uppercase leading-[0.9]">{cities.join(' · ')}</p>
              </>
            )}
            <Link href="/fests" className="press focus-ring label mt-8 inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-ink px-4 py-3 font-bold text-paper shadow-hard-sm hover:bg-door">
              The full Fandom Partner story
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 04 — original work */}
      <section aria-labelledby="original" className="section-y relative border-t-4 border-ink bg-paper text-ink grain">
        <div className="container-x grid gap-12 lg:grid-cols-12">
          <SectionHead n="04" label="How we work" jp="オリジナル" id="original" tone="paper" className="lg:col-span-5">
            Fan-made, <em>original</em> work
          </SectionHead>
          <Reveal as="ul" stagger={0.1} className="grid gap-4 sm:grid-cols-3 lg:col-span-7 lg:grid-cols-1">
            {[
              ['Original art', 'Every print is drawn as original, fan-inspired art. We never use official artwork, screenshots or logos.'],
              ['Codename titles', 'Designs carry their own names, like Cursed Static or Tide Glow. Series names only say what inspired them.'],
              ['Made to order', 'Custom pieces start from your file or our sketch, and we confirm every detail with you on WhatsApp.'],
            ].map(([t, d]) => (
              <li key={t} className="border-4 border-ink bg-paper p-5 shadow-hard">
                <p className="font-display text-[30px] uppercase leading-[0.95]">{t}</p>
                <p className="mt-2 text-[15px] text-tone-2">{d}</p>
              </li>
            ))}
          </Reveal>
          <p className="border-l-[6px] border-door pl-4 text-[15px] italic text-tone-2 lg:col-span-12">{DISCLAIMER}</p>
        </div>
      </section>

      <CtaPanel
        kicker="Next chapter · 次の章"
        title="Step through the door"
        jp="扉を開けて"
        primary={{ href: '/shop', label: 'Shop every arc' }}
        links={[
          { href: '/custom', label: 'Design Your Own' },
          { href: '/faq', label: 'FAQ' },
          { href: '/contact', label: 'Contact' },
          { href: INSTAGRAM_URL, label: 'Instagram', external: true },
        ]}
      />

      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            name: 'About The Escape Door',
            url: absUrl('/about'),
            isPartOf: { '@id': WEBSITE_ID },
            about: { '@id': ORG_ID },
            inLanguage: 'en-IN',
          },
          orgJsonLd(true),
        ]}
      />
    </>
  )
}
