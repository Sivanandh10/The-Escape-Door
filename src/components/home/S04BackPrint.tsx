// STUB by F1 so the home page composes. Owner: S04 section agent (replace freely).
import type { Product } from '@/lib/types'

export default function S04BackPrint({ product }: { product?: Product | null }) {
  return (
    <section id="back-print" aria-labelledby="back-print-title" className="section-y border-t-4 border-ink bg-ink text-paper">
      <div className="container-x">
        <p className="label text-tone-4">Chapter 04 · Back-print reveal</p>
        <h2 id="back-print-title" className="h-display mt-4 max-w-[16ch] text-h2">
          Turn it around: back prints up to 12×15 <em>inches</em>
        </h2>
        <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
          背中で語れ
        </span>
        <p className="mt-6 max-w-[52ch] text-tone-4">
          The front print area is 4×4 inches. The back runs up to 12×15 inches{product ? `, like ${product.designTitle}` : ''}.
        </p>
      </div>
    </section>
  )
}
