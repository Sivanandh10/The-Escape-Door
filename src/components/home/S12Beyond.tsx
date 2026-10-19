// STUB by F1 so the home page composes. Owner: S12 section agent (replace freely).
import Link from 'next/link'
import type { Collection } from '@/lib/types'

export default function S12Beyond({ collection }: { collection?: Collection | null }) {
  return (
    <section id="beyond" aria-labelledby="beyond-title" data-arc="beyond-anime" className="section-y border-t-4 border-ink bg-pink text-ink">
      <div className="container-x">
        <p className="label">Chapter 12 · Beyond anime</p>
        <h2 id="beyond-title" className="h-display mt-4 max-w-[16ch] text-h2">
          Beyond anime: K-pop, F1, films and <em className="accent accent-door">more</em>
        </h2>
        <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
          {collection?.jp ?? 'その先へ'}
        </span>
        {collection?.blurb && <p className="mt-6 max-w-[52ch]">{collection.blurb}</p>}
        <Link
          href="/arc/beyond-anime"
          className="press label mt-8 inline-flex min-h-12 items-center border-[3px] border-ink bg-paper px-6 py-4 font-bold shadow-hard"
        >
          Open the Beyond Anime door
        </Link>
      </div>
    </section>
  )
}
