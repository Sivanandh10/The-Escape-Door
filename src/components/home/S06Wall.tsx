// STUB by F1 so the home page composes. Owner: S06 section agent (replace freely).
import Link from 'next/link'
import type { Product } from '@/lib/types'

export default function S06Wall({ products = [] }: { products?: Product[] }) {
  return (
    <section id="wall" aria-labelledby="wall-title" className="section-y border-t-4 border-ink bg-lav text-ink">
      <div className="container-x">
        <p className="label">Chapter 06 · Polaroid & sticker wall{products.length ? ` · ${products.length} pieces` : ''}</p>
        <h2 id="wall-title" className="h-display mt-4 max-w-[16ch] text-h2">
          Pin up the <em>wall</em>: polaroids 3 for ₹100
        </h2>
        <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
          壁を埋めろ
        </span>
        <p className="mt-6 max-w-[52ch]">
          Polaroids are ₹50 each or ₹100 for three. Posters are ₹200, or ₹1000 for six.{' '}
          <Link href="/shop/polaroids" className="font-bold underline decoration-2 underline-offset-4">
            Browse anime polaroids
          </Link>
        </p>
      </div>
    </section>
  )
}
