// HOME · FEST CREDIBILITY — moved high (review: "the fest stuff is great for credibility, should be higher up").
// Thomso ×3 as the big stamp, every other fest / cosplay collab as a smaller stamp, the "As seen at" ticker (#37),
// and ONLY confirmed + dated stalls (feedback #6: never a bare month or TBC on the home page).
// The full scroll-drawn story, next-season stalls and the booking form live on /fests. Server. Owner: HOME.
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { FestEvent, Partnership } from '@/lib/types'
import { Ticker } from '@/components/fx/Ticker'
import { EventStub } from '@/components/content/EventStub'
import { RemindMeButton } from '@/components/auth/RemindMeButton'
import { cn } from '@/lib/utils'

function tone(role: string) {
  const r = role.toLowerCase()
  if (r.includes('fandom')) return 'bg-volt'
  if (r.includes('gifting')) return 'bg-pink'
  if (r.includes('cosplay')) return 'bg-lav'
  return 'bg-paper'
}

export default function HomeFests({ partnerships = [], dated = [] }: { partnerships?: Partnership[]; dated?: FestEvent[] }) {
  const sorted = [...partnerships].sort((a, b) => a.order - b.order)
  const lead = sorted.find((p) => /thomso/i.test(p.fest)) ?? sorted[0]
  const rest = sorted.filter((p) => p !== lead)
  const fests = sorted.map((p) => (p.institution ? `${p.fest} · ${p.institution}` : p.fest))
  const iit = new Set(sorted.map((p) => p.institution).filter((i) => /^IIT\b/i.test(i))).size

  return (
    <section id="partners" aria-labelledby="partners-title" className="relative overflow-hidden border-t-4 border-ink bg-paper text-ink grain">
      <div className="container-x py-12 md:py-16">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <p className="label text-tone-3">Chapter 03 · Fandom partner arc</p>
            <h2 id="partners-title" className="h-display mt-3 max-w-[16ch] text-[clamp(40px,4.6vw,72px)] leading-[0.88]">
              {lead ? (
                <>
                  Trusted by fests: {lead.fest} <em>{lead.years || 'partner'}</em>
                </>
              ) : (
                <>
                  Your fest&apos;s Fandom <em>Partner</em>
                </>
              )}
            </h2>
            <span lang="ja" aria-hidden="true" className="jp-sub mt-3 block text-tone-3">
              ファンダム・パートナー
            </span>
            <p className="mt-4 max-w-[44ch] text-[16px] leading-snug text-tone-2">
              {lead ? `${lead.detail ?? lead.role} at ${lead.fest}${lead.institution ? `, ${lead.institution}` : ''}. ` : ''}
              Stalls, gifting and cosplay prizes at {sorted.length} fests and cosplay events{iit > 1 ? `, across ${iit} IITs` : ''}. Fest names only, never their logos.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href="/fests#partner"
                data-cursor="OPEN"
                className="press focus-ring group inline-flex min-h-12 items-center gap-2.5 border-[3px] border-ink bg-ink px-5 font-display text-[20px] uppercase leading-none text-paper shadow-hard-door"
              >
                Bring us to your fest
                <ArrowRight aria-hidden="true" className="size-5 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={3} />
              </Link>
              <Link href="/fests" className="focus-ring inline-flex min-h-11 items-center font-bold underline decoration-[3px] underline-offset-4 hover:text-door">
                Every fest &amp; stall
              </Link>
            </div>
          </div>

          <ul className="grid grid-cols-2 gap-2.5 self-center sm:grid-cols-4 lg:col-span-7 lg:gap-3" role="list" aria-label="Fests and cosplay events we have partnered with">
            {lead && (
              <li className="col-span-2 row-span-2 -rotate-1 border-4 border-ink bg-ink p-4 text-paper shadow-hard-volt sm:p-5">
                <p className="label text-volt">{lead.role}</p>
                <p className="mt-2 font-display text-[clamp(52px,7vw,96px)] uppercase leading-[0.82]">
                  {lead.fest} <span className="text-volt">{lead.years}</span>
                </p>
                <p className="label mt-3 text-tone-4">{lead.institution}</p>
                {lead.detail && <p className="mt-1 text-[14px] text-tone-4">{lead.detail}</p>}
              </li>
            )}
            {rest.map((p, i) => (
              <li
                key={p.id}
                className={cn('border-[3px] border-ink px-3 py-2.5 shadow-hard-sm', tone(p.role))}
                style={{ transform: `rotate(${i % 3 === 0 ? -1.2 : i % 3 === 1 ? 0.8 : 0}deg)` }}
              >
                <p className="font-display text-[clamp(19px,1.7vw,24px)] uppercase leading-[0.9]">{p.fest}</p>
                <p className="label mt-1 text-[10px] leading-snug opacity-80">
                  {[p.institution, p.years && !/×/.test(p.years) ? p.years : ''].filter(Boolean).join(' · ') || p.role}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {dated.length > 0 && (
          <div className="mt-10">
            <p className="label flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-hype" />
              Catch us live · confirmed stalls
            </p>
            <ul className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3" role="list">
              {dated.slice(0, 3).map((e, i) => (
                <li key={e.id}>
                  <EventStub event={e} index={i} />
                  <RemindMeButton event={e} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="relative pb-6" aria-label="As seen at">
        <span className="label absolute left-4 top-0 z-10 -translate-y-1/2 -rotate-3 border-[3px] border-ink bg-hype px-3 py-1.5 font-bold text-paper shadow-hard-sm sm:left-8">
          As seen at
        </span>
        <Ticker items={fests} tone="ink" rotate={-1.5} size="md" speed={60} label={`As seen at: ${fests.join(', ')}`} />
      </div>
    </section>
  )
}
