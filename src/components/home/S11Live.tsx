// S11 CATCH US LIVE (#08 ticket stagger · #71 small success stamp). Owner: S11 section agent.
// Upcoming stalls as ticket stubs with an inline "Remind me" lead form; past pop-ups as a stamped row.
// dateLabel is shown exactly as stored (no invented years). Server shell + client ticket island.
import Link from 'next/link'
import { KadoArt } from '@/components/brand/BrandArt'
import { INSTAGRAM_URL } from '@/lib/seo'
import type { FestEvent } from '@/lib/types'
import { TicketList } from './s11/TicketList'

export default function S11Live({ events = [] }: { events?: FestEvent[] }) {
  const upcoming = events.filter((e) => e.status === 'upcoming')
  const past = events.filter((e) => e.status === 'past')

  return (
    <section id="live" aria-labelledby="live-title" className="section-y relative overflow-hidden border-t-4 border-ink bg-ink text-paper">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="label flex items-center gap-2 text-tone-4">
              <span aria-hidden="true" className="relative inline-flex size-2.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-hype opacity-70 motion-reduce:hidden" />
                <span className="relative size-2.5 rounded-full bg-hype" />
              </span>
              Chapter 11 · Catch us live
            </p>
            <h2 id="live-title" className="h-display mt-4 max-w-[13ch] text-h2">
              Catch us <em>live</em> at your college fest
            </h2>
            <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block text-tone-4">
              ライブ会場で
            </span>
          </div>
          <p className="max-w-[38ch] text-[17px] leading-snug text-tone-4">
            Our stall travels from campus to campus. Tap <strong className="text-paper">Remind me</strong> on a ticket and we&apos;ll message you before we open the door.
          </p>
        </div>

        <div className="mt-12 lg:mt-16">
          {upcoming.length > 0 ? (
            <TicketList events={upcoming} />
          ) : (
            <div className="flex flex-col items-start gap-5 border-4 border-paper p-6 sm:flex-row sm:items-center sm:p-8">
              <KadoArt name="kado-sleepy" size={96} />
              <div>
                <p className="font-display text-[clamp(28px,3vw,40px)] uppercase leading-none">No stalls on the calendar yet</p>
                <p className="mt-2 max-w-[48ch] text-tone-4">New dates land on Instagram first. Follow along and catch the next one.</p>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press focus-ring mt-4 inline-flex min-h-12 items-center border-[3px] border-ink bg-volt px-5 font-bold text-ink shadow-hard-paper"
                >
                  Follow @escapedoor.in
                </a>
              </div>
            </div>
          )}
        </div>

        {past.length > 0 && (
          <div className="mt-16 border-t-2 border-dashed border-tone-2 pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="label text-tone-4">Doors we&apos;ve already opened · past pop-ups</h3>
              <Link href="/fests" className="focus-ring inline-flex min-h-11 items-center font-bold text-paper underline decoration-volt decoration-[3px] underline-offset-4 hover:text-volt">
                Every fest and stall
              </Link>
            </div>
            <ul className="mt-5 flex flex-wrap gap-3">
              {past.map((e, i) => (
                <li
                  key={e.id}
                  className="border-[3px] border-paper px-4 py-3"
                  style={{ transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)` }}
                >
                  <span className="block font-display text-[28px] uppercase leading-none">{e.city || e.name}</span>
                  <span className="mt-1 block font-mono text-[12px] uppercase tracking-[0.12em] text-volt">{e.dateLabel}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
