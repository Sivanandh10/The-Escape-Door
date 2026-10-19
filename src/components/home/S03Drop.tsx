// STUB by F1 so the home page composes. Owner: S03 section agent (replace freely).
import Link from 'next/link'
import type { Product } from '@/lib/types'
import { productPriceLabel } from '@/lib/pricing'

export default function S03Drop({ product }: { product?: Product | null }) {
  return (
    <section id="drop" aria-labelledby="drop-title" className="section-y border-t-4 border-ink bg-volt text-ink">
      <div className="container-x">
        <p className="label">Chapter 03 · Drop of the week</p>
        <h2 id="drop-title" className="h-display mt-4 max-w-[14ch] text-h2">
          Oversized tees that own the <em className="accent accent-door">frame</em>
        </h2>
        <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
          今週の一枚
        </span>
        {product && (
          <p className="mt-8 text-[18px]">
            This week:{' '}
            <Link href={`/product/${product.slug}`} className="font-bold underline decoration-2 underline-offset-4">
              {product.name}
            </Link>{' '}
            <span className="font-mono">{productPriceLabel(product)}</span>
          </p>
        )}
      </div>
    </section>
  )
}
