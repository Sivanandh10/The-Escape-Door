// STUB by F1 so the home page composes. Owner: S10 section agent (replace freely).
import type { Partnership } from '@/lib/types'

export default function S10Partners({ partnerships = [] }: { partnerships?: Partnership[] }) {
  return (
    <section id="partners" aria-labelledby="partners-title" className="section-y border-t-4 border-ink bg-paper text-ink grain">
      <div className="container-x">
        <p className="label text-tone-3">Chapter 10 · Fandom partner arc</p>
        <h2 id="partners-title" className="h-display mt-4 max-w-[16ch] text-h2">
          Your fest&apos;s Fandom <em>Partner</em>
        </h2>
        <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
          ファンダム・パートナー
        </span>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {partnerships.map((p) => (
            <li key={p.id} className="border-4 border-ink bg-paper p-4 shadow-hard">
              <span className="block font-display text-[26px] uppercase leading-none">{p.fest}</span>
              <span className="label mt-2 block text-tone-3">{[p.institution, p.role, p.years].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
