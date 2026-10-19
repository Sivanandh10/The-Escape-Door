// S10 FANDOM PARTNER ARC (#16 scroll-drawn timeline · #37 "As seen at" ticker · #13 word reveal).
// Owner: S10 section agent. Server component: partnerships come from page.tsx, pop-up cities from
// getEvents() (same 'use cache' repo, so the page stays static). Fest names are text only — no logos.
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getEvents } from '@/lib/data/repo'
import { Ticker } from '@/components/fx/Ticker'
import type { Partnership } from '@/lib/types'
import { PartnerTimeline } from './s10/PartnerTimeline'
import { WordReveal } from './s10/WordReveal'

export default async function S10Partners({ partnerships = [] }: { partnerships?: Partnership[] }) {
  const events = await getEvents()
  const cities = [...new Set(events.filter((e) => e.kind === 'popup' && e.city).map((e) => e.city))]
  const fests = partnerships.map((p) => (p.institution ? `${p.fest} · ${p.institution}` : p.fest))
  const n = partnerships.length

  return (
    <section id="partners" aria-labelledby="partners-title" className="section-y relative overflow-hidden border-t-4 border-ink bg-paper text-ink grain">
      <div className="container-x">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="label text-tone-3">Chapter 10 · Fandom partner arc</p>
            <h2 id="partners-title" className="h-display mt-4 max-w-[12ch] text-h2">
              Your fest&apos;s Fandom <em>Partner</em>
            </h2>
            <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block text-tone-3">
              ファンダム・パートナー
            </span>
          </div>
          {n > 0 && (
            <WordReveal
              className="text-[clamp(21px,2.2vw,30px)] font-medium leading-[1.3] lg:col-span-5 lg:pb-3"
              text={`Stalls, gifting and cosplay hampers at ${n} fests and cosplay events. Here is the arc so far. Your fest could be the next episode.`}
            />
          )}
        </div>
      </div>

      {n > 0 && (
        <div className="container-x mt-16 lg:mt-20">
          <PartnerTimeline items={partnerships} />
        </div>
      )}

      {/* #37 "As seen at" — two bands, opposite directions */}
      <div className="relative mt-20 lg:mt-24" aria-label="As seen at">
        <span className="label absolute left-4 top-0 z-10 -translate-y-1/2 -rotate-3 border-[3px] border-ink bg-hype px-3 py-1.5 font-bold text-paper shadow-hard-sm sm:left-8">
          As seen at
        </span>
        <Ticker items={fests} tone="ink" rotate={-2} size="lg" speed={60} label={`As seen at: ${fests.join(', ')}`} />
        {cities.length > 0 && (
          <Ticker
            items={cities.map((c) => `Pop-up · ${c}`)}
            tone="lav"
            rotate={1.5}
            size="md"
            speed={45}
            direction="right"
            className="-mt-2"
            label={`Pop-ups in ${cities.join(', ')}`}
          />
        )}
      </div>

      <div className="container-x mt-16">
        <div className="relative grid gap-6 border-4 border-ink bg-volt p-6 shadow-hard-lg sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="font-display text-[clamp(32px,4vw,56px)] uppercase leading-[0.9]">Running a fest?</p>
            <p className="mt-3 max-w-[48ch] text-[17px] leading-snug">
              Make The Escape Door your Fandom Partner: an anime merch stall for your fest, plus custom merch for your committee.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/fests#partner"
              data-cursor="OPEN"
              className="press focus-ring group inline-flex min-h-14 items-center gap-3 border-[3px] border-ink bg-ink px-6 py-3 font-display text-[22px] uppercase leading-none text-paper shadow-hard-door"
            >
              Partner with us
              <ArrowRight className="size-5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" strokeWidth={3} />
            </Link>
            <Link href="/fests" className="focus-ring inline-flex min-h-11 items-center font-bold underline decoration-[3px] underline-offset-4 hover:text-door">
              See the full arc
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
