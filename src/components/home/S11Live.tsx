// STUB by F1 so the home page composes. Owner: S11 section agent (replace freely).
import type { FestEvent } from '@/lib/types'

export default function S11Live({ events = [] }: { events?: FestEvent[] }) {
  const upcoming = events.filter((e) => e.status === 'upcoming')
  return (
    <section id="live" aria-labelledby="live-title" className="section-y border-t-4 border-ink bg-ink text-paper">
      <div className="container-x">
        <p className="label text-tone-4">Chapter 11 · Catch us live</p>
        <h2 id="live-title" className="h-display mt-4 max-w-[16ch] text-h2">
          Catch us <em>live</em> at your college fest
        </h2>
        <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
          ライブ会場で
        </span>
        <ul className="mt-10 divide-y-2 divide-tone-2 border-y-2 border-tone-2">
          {upcoming.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-4">
              <span className="font-display text-[28px] uppercase leading-none">{e.name}</span>
              <span className="label text-tone-4">{e.dateLabel}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
