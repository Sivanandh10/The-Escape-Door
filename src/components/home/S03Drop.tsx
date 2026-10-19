// S03 DROP OF THE WEEK — product theatre (#51 #47 #66 #31). Owner: s03-s04-tee.
// Server shell (copy, price, SEO-visible text) + client islands: TitleRows (#47), DropStage (#51), DropBuy (#66).
import Link from 'next/link'
import type { Product } from '@/lib/types'
import { getCollection } from '@/lib/data/repo'
import { productPriceLabel } from '@/lib/pricing'
import { Mascot } from '@/components/brand'
import { TitleRows } from './s03/TitleRows'
import { DropStage } from './s03/DropStage'
import { DropBuy } from './s03/DropBuy'

const STOCK: Record<Product['stock'], string> = {
  in: 'In stock',
  low: 'Low stock',
  out: 'Sold out',
  'made-to-order': 'Made to order',
}

/** The first sentence of the product copy (the honest one-liner about the art). */
function lead(text: string) {
  const m = text.match(/^.+?[.!?](\s|$)/)
  return (m ? m[0] : text).trim()
}

export default async function S03Drop({ product }: { product?: Product | null }) {
  const collection = product ? await getCollection(product.collection) : null
  const dropLabel = 'Drop 01'

  return (
    <section
      id="drop"
      aria-labelledby="drop-title"
      className="relative isolate overflow-hidden border-t-4 border-ink text-ink"
      style={{ backgroundColor: product?.colorBlock ?? 'var(--color-lav)' }}
    >
      {product && <TitleRows title={product.designTitle} jp={product.jpTitle} className="absolute inset-0 -z-10" />}
      {/* screentone shading in the lower-left corner */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 -z-10 h-[46%] w-[40%] opacity-25"
        style={{
          backgroundImage: 'radial-gradient(circle, #0B0B0F 34%, transparent 38%)',
          backgroundSize: '12px 12px',
          maskImage: 'radial-gradient(ellipse at 0% 100%, #000 10%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 0% 100%, #000 10%, transparent 70%)',
        }}
      />

      <div className="container-x section-y grid gap-x-10 gap-y-8 lg:grid-cols-12 lg:items-center">
        <header className="lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:self-end">
          <p className="label flex items-center gap-3">
            <span className="bg-ink px-2 py-1 text-volt">Chapter 03</span>
            Drop of the week
          </p>
          <h2 id="drop-title" className="h-display mt-5 max-w-[12ch] text-h2">
            Oversized tees that own the <em className="accent accent-door">frame</em>
          </h2>
          <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
            今週の一枚
          </span>
        </header>

        {product ? (
          <>
            <div className="lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
              <DropStage product={product} dropLabel={dropLabel} />
            </div>

            <article
              aria-labelledby="drop-product"
              className="panel-paper relative shadow-hard-lg lg:col-span-5 lg:col-start-1 lg:row-start-2 lg:self-start"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b-[3px] border-ink bg-ink px-5 py-2.5 text-paper">
                <span className="label bg-volt px-2 py-0.5 text-ink">{dropLabel}</span>
                {collection && (
                  <Link href={`/arc/${collection.slug}`} className="label focus-ring underline-offset-4 can-hover:hover:underline">
                    {collection.name}
                  </Link>
                )}
                <span className="label ml-auto flex items-center gap-1.5 text-tone-4">
                  <span aria-hidden="true" className="size-2 rounded-full bg-volt" />
                  {STOCK[product.stock]}
                </span>
              </div>
              <div className="p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 id="drop-product" className="h-display text-[clamp(40px,4.4vw,60px)]">
                      {product.designTitle}
                    </h3>
                    {product.jpTitle && (
                      <span lang="ja" className="jp-sub mt-2 block">
                        {product.jpTitle}
                      </span>
                    )}
                  </div>
                  <p className="shrink-0 -rotate-3 border-[3px] border-ink bg-volt px-3 py-1.5 font-mono text-[clamp(20px,2vw,26px)] font-bold leading-none shadow-hard-sm">
                    <span className="sr-only">Price: </span>
                    {productPriceLabel(product)}
                  </p>
                </div>
                <p className="mt-4 max-w-[46ch] text-[15px] leading-[1.55] text-ink/80">
                  {lead(product.description)}
                  {product.type === 'tshirt' &&
                    (product.variants.length === 1 && product.variants[0].attrs?.fit === 'oversized'
                      ? ' Black oversized drop-shoulder tee.'
                      : ' Same print, pick your fit.')}
                </p>
                <div className="mt-6">
                  <DropBuy product={product} />
                </div>
              </div>
            </article>
          </>
        ) : (
          <div className="panel-paper flex items-center gap-6 p-6 shadow-hard lg:col-span-7">
            <Mascot mood="sleepy" size={96} title="" />
            <div>
              <p className="h-display text-h3">This week&rsquo;s drop is still being inked</p>
              <Link href="/shop" className="focus-ring mt-3 inline-block font-mono text-[13px] font-bold uppercase tracking-[0.12em] underline decoration-2 underline-offset-4">
                Browse the shop →
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
