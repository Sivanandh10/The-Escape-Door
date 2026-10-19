// /lab/s00 — isolated preview of the S00 preloader over a stand-in hero. Dev QA only; noindex. Owner: S00 agent.
//   /lab/s00?preload=force          → play it (bypasses session/bot/reduced-motion gates)
//   /lab/s00?preload=force&t=1.16   → freeze the timeline at t seconds (screenshots of each beat)
import type { Metadata } from 'next'
import S00Preloader from '@/components/home/S00Preloader'

export const metadata: Metadata = {
  title: 'Lab · S00 preloader',
  robots: { index: false, follow: false },
}

const BEATS: Array<[string, number]> = [
  ['brush draw', 0.3],
  ['counting', 0.7],
  ['gate · 90', 1.0],
  ['ドン! slam', 1.17],
  ['door opens', 1.62],
]

export default function LabS00() {
  return (
    <>
      <S00Preloader />
      <section id="hero" aria-labelledby="lab-hero" className="relative isolate overflow-hidden bg-ink">
        <div className="container-x flex min-h-[calc(100svh-var(--header-h))] flex-col justify-center py-16">
          <p className="label text-volt">Stand-in hero · /lab/s00</p>
          <h1 id="lab-hero" className="h-display mt-5 max-w-[12ch] text-[clamp(56px,8.6vw,132px)]">
            Anime merch, drawn like a <em>living</em> manga volume
          </h1>
          <p className="mt-6 max-w-[52ch] text-tone-4">
            The preloader is an overlay: this hero is already rendered underneath, so the door opens straight into it.
          </p>
          <nav aria-label="Preloader beats" className="mt-10 flex flex-wrap gap-3">
            <a href="/lab/s00?preload=force" className="press label focus-ring inline-flex min-h-11 items-center border-[3px] border-ink bg-volt px-4 text-ink shadow-hard-paper">
              Replay
            </a>
            {BEATS.map(([label, t]) => (
              <a
                key={t}
                href={`/lab/s00?preload=force&t=${t}`}
                className="press label focus-ring inline-flex min-h-11 items-center border-2 border-paper px-4 text-paper hover:bg-paper hover:text-ink"
              >
                {label} · {t}s
              </a>
            ))}
          </nav>
        </div>
      </section>
    </>
  )
}
