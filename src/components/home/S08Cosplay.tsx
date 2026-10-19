// STUB by F1 so the home page composes. Owner: S08 section agent (replace freely).
import Link from 'next/link'
import type { Product } from '@/lib/types'

export default function S08Cosplay({ products = [] }: { products?: Product[] }) {
  return (
    <section id="cosplay" aria-labelledby="cosplay-title" className="section-y border-t-4 border-ink bg-tone-1 text-paper">
      <div className="container-x">
        <p className="label text-tone-4">Chapter 08 · Cosplay & props{products.length ? ` · ${products.length} pieces` : ''}</p>
        <h2 id="cosplay-title" className="h-display mt-4 max-w-[16ch] text-h2">
          Props for your next <em>cosplay</em>
        </h2>
        <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
          コスプレ
        </span>
        <p className="mt-6 max-w-[52ch] text-tone-4">
          Basic katanas ₹1200–2000, LED katanas ₹3000–4000, capes ₹700–1000. Display props, not real blades.{' '}
          <Link href="/cosplay" className="font-bold text-paper underline decoration-2 underline-offset-4">
            See cosplay props and katanas
          </Link>
        </p>
      </div>
    </section>
  )
}
