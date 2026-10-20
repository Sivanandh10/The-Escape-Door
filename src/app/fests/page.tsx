// /fests — The Fandom Partner arc (SITEMAP §2.7). Owner: P5.
// Static: every read is a 'use cache' repo function. Event JSON-LD only for confirmed + dated events.
import Link from 'next/link'
import { ArrowDown, ArrowRight, Camera } from 'lucide-react'
import { Ticker } from '@/components/fx/Ticker'
import { Panel } from '@/components/fx/Panel'
import { Reveal } from '@/components/motion/Reveal'
import JsonLd from '@/components/seo/JsonLd'
import { PageHero } from '@/components/content/PageHero'
import { SectionHead } from '@/components/content/SectionHead'
import { InkTimeline } from '@/components/content/InkTimeline'
import { EventStub } from '@/components/content/EventStub'
import { LeadForm } from '@/components/content/LeadForm'
import { CountUp } from '@/components/content/CountUp'
import { CtaPanel } from '@/components/content/CtaPanel'
import { pageMeta } from '@/components/content/meta'
import { getBundleRules, getCustomRules, getEvents, getHoodieTiers, getPartnerships, getProducts, getTeeFits } from '@/lib/data/repo'
import { eventJsonLd, INSTAGRAM_URL, serviceJsonLd } from '@/lib/seo'
import { formatINR, productPriceLabel } from '@/lib/pricing'

export const metadata = pageMeta({
  title: 'College Fest Merch Partner & Anime Stalls | Escape Door',
  description:
    'Bring The Escape Door to your fest: anime merch stalls and custom fest merch. Seen at Thomso IIT Roorkee, Fluxus IIT Indore and Alcheringa IIT Guwahati.',
  path: '/fests',
  ogImage: false,
})

const CUSTOM_LABEL: Partial<Record<string, string>> = { polaroid: 'Polaroids', bookmark: 'Bookmarks', sticker: 'Stickers', badge: 'Badges' }

export default async function FestsPage() {
  const [partnerships, events, customRules, bundleRules, tiers, fits, katanas] = await Promise.all([
    getPartnerships(),
    getEvents(),
    getCustomRules(),
    getBundleRules(),
    getHoodieTiers(),
    getTeeFits(),
    getProducts({ type: 'katana' }),
  ])
  const sorted = [...partnerships].sort((a, b) => a.order - b.order)
  const upcoming = events.filter((e) => e.status === 'upcoming')
  const popups = events.filter((e) => e.kind === 'popup')
  const thomso = sorted.find((p) => /thomso/i.test(p.fest))
  const minTier = tiers.reduce((m, t) => Math.min(m, t.price), Infinity)
  const oversized = fits.find((f) => f.id === 'oversized')
  const polaroidDeal = bundleRules.find((r) => r.appliesTo.type === 'polaroid')
  const posterDeal = bundleRules.find((r) => r.appliesTo.type === 'poster')
  const badgeDeal = bundleRules.find((r) => r.appliesTo.type === 'badge')
  const basicKatana = katanas.find((k) => k.tags?.includes('basic'))
  const flatMins = customRules.filter((r) => CUSTOM_LABEL[r.type])

  const STALL = [
    { t: 'Oversized tees', p: oversized ? formatINR(oversized.price) : '', d: 'Original fan-inspired prints with big back pieces.', tone: 'volt' as const },
    { t: 'Hoodies by GSM', p: Number.isFinite(minTier) ? `From ${formatINR(minTier)}` : '', d: 'Four fabric weights, from light to heavyweight.', tone: 'lav' as const },
    { t: 'Polaroids', p: polaroidDeal?.label ?? '', d: 'Polaroid-style prints for walls, lockers and diaries.', tone: 'pink' as const },
    { t: 'Posters', p: posterDeal?.label ?? '', d: 'Mix series across a full wall set.', tone: 'paper' as const },
    { t: 'Badges', p: badgeDeal?.label ?? '', d: 'Small, cheap and the first thing to sell out at a stall.', tone: 'volt' as const },
    { t: 'Cosplay katanas', p: basicKatana ? productPriceLabel(basicKatana) : '', d: 'Display and cosplay props, never real blades.', tone: 'lav' as const },
  ]

  const tickerItems = sorted.map((p) => `${p.fest}${p.years ? ` ${p.years}` : ''}`.toUpperCase())

  return (
    <>
      <PageHero
        kicker="Fests & pop-ups · Fandom Partner"
        title={
          <>
            The Fandom <em>Partner</em> arc
          </>
        }
        jp="ファンダム・パートナー"
        crumbs={[{ name: 'Fests', path: '/fests' }]}
        sfx="ドン!"
        rail="CATCH US LIVE"
        intro={
          <p>
            We bring a stall full of original, fan-inspired anime merch to college fests: tees, hoodies, polaroids, badges and
            cosplay props. We also make custom merch for the teams that run them.
          </p>
        }
        aside={
          <Panel tone="paper" shadow="volt" border={4} className="-rotate-1" innerClassName="p-6 sm:p-8">
            <p className="label text-tone-2">Track record · 実績</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6">
              {thomso && (
                <div className="col-span-2 border-b-[3px] border-ink pb-5">
                  <dt className="label">{thomso.institution}</dt>
                  <dd className="font-display mt-1 text-[clamp(48px,6vw,80px)] uppercase leading-[0.85]">
                    {thomso.fest} <span className="accent">{thomso.years}</span>
                  </dd>
                  <dd className="mt-2 text-[15px] text-tone-2">{thomso.detail ?? thomso.role}</dd>
                </div>
              )}
              <div>
                <dt className="label">Fest & cosplay collabs</dt>
                <dd className="font-mono mt-1 text-[40px] font-bold leading-none">
                  <CountUp value={sorted.length} />
                </dd>
              </div>
              <div>
                <dt className="label">Pop-up cities</dt>
                <dd className="font-mono mt-1 text-[40px] font-bold leading-none">
                  <CountUp value={popups.length} />
                </dd>
              </div>
            </dl>
          </Panel>
        }
      >
        <Link href="#partner" className="press focus-ring label inline-flex min-h-13 items-center gap-2 border-[3px] border-ink bg-volt px-5 py-3.5 text-[13px] font-bold text-ink shadow-[5px_5px_0_0_var(--color-paper)] hover:bg-volt-hot">
          Book us for your fest
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        <Link href="#live" className="focus-ring label inline-flex min-h-12 items-center gap-2 border-[3px] border-paper px-4 py-3 text-paper transition-colors duration-150 hover:bg-paper hover:text-ink">
          Upcoming stalls
          <ArrowDown aria-hidden="true" className="size-4" />
        </Link>
      </PageHero>

      <Ticker items={tickerItems} tone="volt" rotate={-2} size="md" label="Fests we have partnered with" className="relative z-[2] -my-3" />

      {/* 01 — Become our Fandom Partner */}
      <section aria-labelledby="become" className="section-y relative border-b-4 border-ink bg-paper text-ink grain">
        <div className="container-x grid gap-12 lg:grid-cols-12">
          <SectionHead
            n="01"
            label="For fest teams"
            jp="パートナーになろう"
            id="become"
            tone="paper"
            className="lg:col-span-6"
            intro={
              <>
                <p>
                  Fest teams invite us as their <strong>Fandom Partner</strong>. We set up a stall stocked with anime-first merch and
                  work with your committee on merch made for your fest.
                </p>
                <p className="mt-4">
                  It is the same promise as the shop: original, fan-inspired designs at student prices, and nothing that pretends
                  to be official merchandise.
                </p>
              </>
            }
          >
            Become our Fandom <em>Partner</em>
          </SectionHead>
          <Reveal as="ul" variant="slam" stagger={0.1} className="grid gap-4 self-end sm:grid-cols-3 lg:col-span-6 lg:grid-cols-1">
            {[
              { k: 'Stalls', t: 'A merch stall at your fest', d: 'Tees, hoodies, polaroids, badges and props on one table.' },
              { k: 'Gifting', t: 'Gifting for your guests', d: "Gifting Partner at Ignus'25, IIT Jodhpur." },
              { k: 'Cosplay', t: 'Prizes for your cosplay contest', d: 'Hampers by The Escape Door for CosCon, with ₹50K in prizes.' },
            ].map((x, i) => (
              <li key={x.k} className={`border-4 border-ink p-5 shadow-hard ${i === 0 ? 'bg-volt' : i === 1 ? 'bg-lav' : 'bg-pink'}`}>
                <p className="label">{x.k}</p>
                <p className="font-display mt-2 text-[28px] uppercase leading-[0.95]">{x.t}</p>
                <p className="mt-2 text-[15px]">{x.d}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 02 — Catch us live: upcoming stalls come right after the pitch so visitors see dates first */}
      <section id="live" aria-labelledby="live-title" className="section-y relative scroll-mt-20 border-b-4 border-ink bg-volt text-ink">
        <div className="container-x">
          <SectionHead
            n="02"
            label="Upcoming stalls"
            jp="次の屋台"
            id="live-title"
            tone="paper"
            intro={
              <p>
                These dates come from our stall list. Years are still being confirmed, so check Instagram before you travel.
              </p>
            }
          >
            Catch us <em>live</em>: upcoming stalls
          </SectionHead>
          {upcoming.length ? (
            <Reveal as="ul" stagger={0.1} className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((e, i) => (
                <li key={e.id}>
                  <EventStub event={e} index={i} />
                </li>
              ))}
            </Reveal>
          ) : (
            <p className="mt-10 border-4 border-ink bg-paper p-6 text-[17px] shadow-hard">
              No stalls are announced right now. New dates land on Instagram first.
            </p>
          )}
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            {popups.length > 0 && (
              <p className="flex flex-wrap items-center gap-2">
                <span className="label mr-1">Past pop-ups</span>
                {popups.map((p) => (
                  <span key={p.id} className="label border-[3px] border-ink bg-paper px-2.5 py-1.5">
                    {p.city}
                  </span>
                ))}
              </p>
            )}
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="focus-ring label inline-flex min-h-11 items-center gap-2 underline decoration-2 underline-offset-4 hover:text-door">
              <Camera aria-hidden="true" className="size-4" />
              Follow @escapedoor.in for live updates
            </a>
          </div>
        </div>
      </section>

      {/* 03 — Fests we've opened doors at */}
      <section aria-labelledby="history" className="section-y relative bg-ink text-paper">
        <div className="container-x grid gap-12 lg:grid-cols-12">
          <SectionHead
            n="03"
            label="The story so far"
            jp="これまでの物語"
            id="history"
            className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start"
            intro={<p>Stalls, gifting and cosplay competitions, panel by panel. Fest names are text only: we never use fest or institute logos.</p>}
          >
            Fests we&apos;ve already <em>opened</em> doors at
          </SectionHead>
          <div className="lg:col-span-7">
            <InkTimeline items={sorted} />
          </div>
        </div>
      </section>

      {/* 04 — What a stall brings */}
      <section aria-labelledby="stall" className="section-y relative border-t-4 border-ink bg-paper text-ink grain">
        <div className="container-x">
          <SectionHead
            n="04"
            label="On the table"
            jp="屋台の中身"
            id="stall"
            tone="paper"
            intro={<p>Everything on a stall comes from the same catalogue as the shop, at the same prices.</p>}
          >
            What a stall brings to your <em>campus</em>
          </SectionHead>
          <Reveal as="ul" stagger={0.08} className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STALL.map((x) => (
              <li key={x.t} className="group">
                <Panel tone={x.tone} shadow="ink" className="h-full transition-transform duration-200 can-hover:group-hover:-translate-y-1" innerClassName="flex h-full flex-col p-5 sm:p-6">
                  <p className="font-display text-[34px] uppercase leading-[0.9]">{x.t}</p>
                  {x.p && <p className="font-mono mt-3 inline-block self-start border-[3px] border-ink bg-ink px-2 py-1 text-[15px] font-bold text-volt">{x.p}</p>}
                  <p className="mt-4 text-[15px]">{x.d}</p>
                </Panel>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 05 — Custom merch for your fest */}
      <section aria-labelledby="fest-custom" className="section-y relative border-t-4 border-ink bg-lav text-ink">
        <div className="container-x grid gap-12 lg:grid-cols-12 lg:items-end">
          <SectionHead
            n="05"
            label="Made for your fest"
            jp="フェス特注"
            id="fest-custom"
            tone="paper"
            className="lg:col-span-7"
            intro={
              <p>
                Committee tees, volunteer hoodies, polaroids and badges with your fest&apos;s own artwork. Send us the file, or let
                us draw it for {formatINR(200)} extra. Apparel prints go up to 4×4 in on the front and 12×15 in on the back.
              </p>
            }
          >
            Custom merch for your <em className="accent-door">fest</em>
          </SectionHead>
          <div className="lg:col-span-5">
            <p className="label">Minimum quantities</p>
            <ul className="mt-4 grid grid-cols-2 gap-3">
              {flatMins.map((r) => (
                <li key={r.type} className="border-4 border-ink bg-paper p-4 shadow-hard">
                  <p className="font-mono text-[34px] font-bold leading-none">{r.minQty}</p>
                  <p className="label mt-2">{CUSTOM_LABEL[r.type]} min.</p>
                </li>
              ))}
            </ul>
            <Link href="/custom" className="press focus-ring label mt-6 inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-ink px-5 py-3 font-bold text-paper shadow-hard-sm hover:bg-door">
              Plan custom fest merch: Design Your Own
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 06 — How to book us */}
      <section id="partner" aria-labelledby="book" className="section-y relative scroll-mt-20 border-t-4 border-ink bg-paper text-ink grain">
        <div className="container-x grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHead n="06" label="Partner with us" jp="予約方法" id="book" tone="paper">
              How to <em>book</em> us
            </SectionHead>
            <ol className="mt-10 grid gap-4">
              {[
                ['Tell us about your fest', 'Fest name, college, rough dates and what you have in mind.'],
                ['We reply on WhatsApp or email', 'We talk through the stall, custom merch and anything else you need.'],
                ['We open the door on your campus', 'Stall day: original anime merch, in person.'],
              ].map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[52px_1fr] items-start gap-4">
                  <span className="font-display grid size-[52px] place-items-center border-4 border-ink bg-volt text-[30px] leading-none shadow-hard-sm">{i + 1}</span>
                  <div>
                    <p className="font-display text-[26px] uppercase leading-[0.95]">{t}</p>
                    <p className="mt-1 text-[15px] text-tone-2">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="lg:col-span-7">
            <LeadForm variant="fest" />
          </div>
        </div>
      </section>

      <CtaPanel
        kicker="Next chapter · 次の章"
        title="Dress the whole committee"
        jp="チーム全員に"
        primary={{ href: '/custom', label: 'Design Your Own' }}
        links={[
          { href: '/shop/badges', label: 'Anime badges' },
          { href: '/shop/polaroids', label: 'Polaroid prints' },
          { href: '/cosplay', label: 'Cosplay guide' },
          { href: '/about', label: 'About us' },
        ]}
      />

      <JsonLd
        data={[
          serviceJsonLd({
            name: 'College fest merchandise partnership',
            serviceType: 'Fest merchandise stall and custom fest merch',
            path: '/fests',
            description: 'Anime merch stalls and custom fest merchandise for college fests in India.',
          }),
          ...upcoming.map(eventJsonLd),
        ]}
      />
    </>
  )
}
