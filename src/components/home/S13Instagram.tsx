// STUB by F1 so the home page composes. Owner: S13 section agent (replace freely).
import type { InstaPost } from '@/lib/types'

export default function S13Instagram({
  posts = [],
  instagram = 'https://www.instagram.com/escapedoor.in',
}: {
  posts?: InstaPost[]
  instagram?: string
}) {
  return (
    <section id="instagram" aria-labelledby="instagram-title" className="section-y border-t-4 border-ink bg-ink text-paper">
      <div className="container-x">
        <p className="label text-tone-4">Chapter 14 · @escapedoor.in{posts.length ? ` · ${posts.length} posts` : ''}</p>
        <h2 id="instagram-title" className="h-display mt-4 max-w-[16ch] text-h2">
          Fresh panels on <em>Instagram</em>
        </h2>
        <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
          最新のコマ
        </span>
        <a
          href={instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="press label mt-8 inline-flex min-h-12 items-center border-[3px] border-paper px-6 py-4 font-bold hover:bg-paper hover:text-ink"
        >
          Follow @escapedoor.in on Instagram
        </a>
      </div>
    </section>
  )
}
