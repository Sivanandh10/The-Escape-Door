// STUB by F1 so the home page composes. Owner: S02 section agent (replace freely).
import Link from 'next/link'
import type { Collection } from '@/lib/types'

export default function S02ChooseArc({ collections = [] }: { collections?: Collection[] }) {
  return (
    <section id="choose-arc" aria-labelledby="choose-arc-title" className="section-y border-t-4 border-ink bg-paper text-ink grain">
      <div className="container-x">
        <p className="label text-tone-3">Chapter 02 · Choose your arc</p>
        <h2 id="choose-arc-title" className="h-display mt-4 max-w-[16ch] text-h2">
          Pick your <em>arc</em>: Jujutsu Kaisen, One Piece, Naruto and more
        </h2>
        <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
          物語を選べ
        </span>
        <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {collections.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/arc/${c.slug}`}
                data-cursor="OPEN"
                className="press flex min-h-40 flex-col justify-between border-4 border-ink bg-ink p-3 text-paper shadow-hard"
                style={{ borderLeftColor: c.accentA, borderLeftWidth: 14 }}
              >
                <span lang="ja" className="font-jp text-[12px] font-bold tracking-[0.2em] opacity-70">
                  {c.jp}
                </span>
                <span className="font-display text-[26px] uppercase leading-[0.9]">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
