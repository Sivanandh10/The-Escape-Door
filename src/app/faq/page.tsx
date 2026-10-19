// /faq — Questions fans ask us (SITEMAP §2.10 + §4 GEO answer blocks). Owner: P5.
// Question H2s with self-contained 40–60-word answers, grouped under #prices #custom #cosplay #fests #about.
// FAQPage JSON-LD mirrors the visible text exactly. Held-back [CONFIRM] questions are not rendered.
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { Mascot } from '@/components/brand'
import { Reveal } from '@/components/motion/Reveal'
import JsonLd from '@/components/seo/JsonLd'
import { PageHero } from '@/components/content/PageHero'
import { Accordion } from '@/components/content/Accordion'
import { CtaPanel } from '@/components/content/CtaPanel'
import { pageMeta } from '@/components/content/meta'
import { FAQ, FAQ_GROUPS } from '@/components/content/faq'
import { faqJsonLd, INSTAGRAM_URL } from '@/lib/seo'
import { cn } from '@/lib/utils'

export const metadata = pageMeta({
  title: 'FAQ — Prices, Custom Orders & Fests | The Escape Door',
  description: 'Straight answers: oversized tees ₹800, hoodies ₹1200–2500 by GSM, custom polaroids from 20 pieces, print sizes, fest stalls and more.',
  path: '/faq',
  ogImage: false,
})

const GROUP_TONE = ['bg-volt', 'bg-lav', 'bg-pink', 'bg-paper', 'bg-volt'] as const

export default function FaqPage() {
  let n = 0
  const groups = FAQ_GROUPS.map((g) => {
    const items = FAQ.filter((f) => f.group === g.id)
    const startAt = n + 1
    n += items.length
    return { ...g, items, startAt }
  }).filter((g) => g.items.length)

  return (
    <>
      <PageHero
        kicker={`FAQ · ${FAQ.length} answers`}
        title={
          <>
            Questions fans <em>ask</em> us
          </>
        }
        jp="よくある質問"
        crumbs={[{ name: 'FAQ', path: '/faq' }]}
        sfx="!?"
        focus={{ x: 0.85, y: 0.5 }}
        intro={
          <p>
            Prices, custom orders, cosplay props and fest stalls, answered in plain words. Every price here comes from our
            current price list. Something missing? Ask us directly.
          </p>
        }
        aside={
          <div className="relative hidden justify-end lg:flex">
            <Mascot mood="wave" size={220} animate title="" />
          </div>
        }
      />

      <div className="relative border-t-4 border-ink bg-paper text-ink grain">
        <div className="container-x grid gap-10 py-12 sm:py-16 lg:grid-cols-12 lg:gap-12 lg:py-24">
          {/* group index — sticky on desktop, a scrollable chip row on mobile */}
          <nav aria-label="FAQ topics" className="lg:col-span-3">
            <div className="lg:sticky lg:top-28">
              <p className="label text-tone-2">Jump to</p>
              <ul className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:gap-3 lg:overflow-visible lg:px-0" data-lenis-prevent-horizontal>
                {groups.map((g, i) => (
                  <li key={g.id} className="shrink-0">
                    <Link
                      href={`#${g.id}`}
                      className={cn(
                        'press focus-ring group flex min-h-11 items-center gap-3 border-[3px] border-ink px-3 py-2 shadow-hard-sm transition-colors duration-150 hover:bg-ink hover:text-paper',
                        GROUP_TONE[i % GROUP_TONE.length],
                      )}
                    >
                      <span className="font-display text-[22px] uppercase leading-none">{g.label}</span>
                      <span lang="ja" aria-hidden="true" className="jp-sub ml-auto hidden text-[11px] lg:inline">
                        {g.jp}
                      </span>
                      <span className="font-mono text-[12px] font-bold">{g.items.length}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="flex flex-col gap-16 lg:col-span-9 lg:gap-20">
            {groups.map((g, i) => (
              <section key={g.id} id={g.id} aria-label={g.label} className="scroll-mt-28">
                <Reveal self className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b-4 border-ink pb-4">
                  <div>
                    <p className="label text-tone-2">
                      Part {String(i + 1).padStart(2, '0')} · <span lang="ja">{g.jp}</span>
                    </p>
                    <p className="font-display mt-2 text-[clamp(40px,5vw,72px)] uppercase leading-[0.85]">{g.label}</p>
                  </div>
                  <p className="max-w-[34ch] text-[15px] text-tone-2">{g.blurb}</p>
                </Reveal>
                <Accordion items={g.items} level={2} startAt={g.startAt} defaultOpen={0} />
              </section>
            ))}

            <aside className="relative border-4 border-ink bg-ink p-6 text-paper shadow-hard sm:p-8">
              <p className="font-display text-[clamp(32px,4vw,48px)] uppercase leading-[0.9]">
                Still stuck at the <span className="accent">door</span>?
              </p>
              <p className="mt-3 max-w-[52ch] text-[16px] text-tone-4">
                Shipping times, returns and cash on delivery are being finalised. Until they are published, message us and we will
                answer for your order.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/contact" className="press focus-ring label inline-flex min-h-12 items-center gap-2 border-[3px] border-paper bg-volt px-4 py-3 font-bold text-ink hover:bg-volt-hot">
                  <MessageCircle aria-hidden="true" className="size-4" />
                  Contact us
                </Link>
                <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="focus-ring label inline-flex min-h-12 items-center border-[3px] border-paper px-4 py-3 hover:bg-paper hover:text-ink">
                  DM @escapedoor.in ↗
                </a>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <CtaPanel
        kicker="Next chapter · 次の章"
        title="Pick your arc"
        jp="アークを選べ"
        primary={{ href: '/shop', label: 'Shop every arc' }}
        links={[
          { href: '/custom', label: 'Custom Forge' },
          { href: '/fests', label: 'Fest stalls' },
          { href: '/cosplay', label: 'Cosplay guide' },
        ]}
      />

      <JsonLd data={faqJsonLd(FAQ.map(({ q, a }) => ({ q, a })))} />
    </>
  )
}
