// Compact product tile for editorial pages (/cosplay). Owner: P5. Server component.
// Links to the product page (P1 owns the full ProductCard); light lift + image push on hover.
import Image from 'next/image'
import Link from 'next/link'
import type { Product } from '@/lib/types'
import { productPriceLabel } from '@/lib/pricing'
import { cn } from '@/lib/utils'

function thumb(p: Product): string | null {
  const src = p.images[0]?.src
  if (!src) return null
  return src.startsWith('/mockups/') && src.endsWith('.webp') && !src.endsWith('-600.webp') ? src.replace(/\.webp$/, '-600.webp') : src
}

export function PropTile({ product, collectionName, className }: { product: Product; collectionName?: string; className?: string }) {
  const src = thumb(product)
  const img = product.images[0]
  return (
    <Link
      href={`/product/${product.slug}`}
      data-cursor="VIEW"
      className={cn(
        'group focus-ring relative flex h-full flex-col border-4 border-ink bg-paper text-ink shadow-hard transition-[translate,box-shadow] duration-200 can-hover:hover:-translate-y-1 can-hover:hover:shadow-[8px_10px_0_0_var(--color-ink)]',
        className,
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden border-b-4 border-ink" style={{ backgroundColor: product.colorBlock }}>
        {src && (
          <Image
            src={src}
            alt={img?.alt ?? `${product.name} by The Escape Door`}
            fill
            sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 90vw"
            className="object-cover transition-transform duration-500 can-hover:group-hover:scale-[1.04]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {collectionName && <p className="label text-tone-2">{collectionName}</p>}
        <p className="font-display mt-1 text-[24px] uppercase leading-[0.95]">{product.name}</p>
        <p className="font-mono mt-auto pt-3 text-[15px] font-bold">{productPriceLabel(product)}</p>
      </div>
    </Link>
  )
}

export default PropTile
