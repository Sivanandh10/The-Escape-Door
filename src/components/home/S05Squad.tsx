// STUB by F1 so the home page composes. Owner: S05 section agent (replace freely).
import Link from 'next/link'
import type { Product } from '@/lib/types'

const CATS = [
  { href: '/shop/oversized-t-shirts', label: 'Oversized tees', bg: 'bg-volt' },
  { href: '/shop/hoodies', label: 'Hoodies', bg: 'bg-lav' },
  { href: '/shop/polaroids', label: 'Polaroids', bg: 'bg-pink' },
  { href: '/shop/cosplay-props', label: 'Cosplay props', bg: 'bg-paper' },
]

export default function S05Squad({ products = [] }: { products?: Product[] }) {
  return (
    <section id="squad" aria-labelledby="squad-title" className="section-y border-t-4 border-ink bg-ink text-paper">
      <div className="container-x">
        <p className="label text-tone-4">Chapter 05 · The squad{products.length ? ` · ${products.length} featured` : ''}</p>
        <h2 id="squad-title" className="h-display mt-4 max-w-[16ch] text-h2">
          Every <em>panel</em> of the shop: tees to katanas
        </h2>
        <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
          全コマ
        </span>
        <ul className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CATS.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className={`press flex min-h-36 items-end border-4 border-ink p-4 text-ink shadow-hard-paper ${c.bg}`}>
                <span className="font-display text-[28px] uppercase leading-[0.9]">{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
