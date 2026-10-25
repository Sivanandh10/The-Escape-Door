// HOME · DROP OF THE WEEK + BACK-PRINT, merged into one compact block (review feedback #4).
// Stage = DropFlip (front ↔ back print, tap/hover). Buy panel = the existing DropBuy (#66 add to cart).
// The Custom Forge teaser is folded in as one line: "your own art on the back". Server shell. Owner: HOME.
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Product } from '@/lib/types'
import { getCollection } from '@/lib/data/repo'
import { PriceTag } from '@/components/shop/PriceTag'
import { KadoArt } from '@/components/brand/BrandArt'
import { DropBuy } from './s03/DropBuy'
import { DropFlip } from './s03/DropFlip'

/** The first sentence of the product copy (the honest one-liner about the art). */
function lead(text: string) {
  const m = text.match(/^.+?[.!?](\s|$)/)
  return (m ? m[0] : text).trim()
}

export default async function HomeDrop({ product }: { product?: Product | null }) {
  const collection = product ? await getCollection(product.collection) : null

  return (
    <section
      id="drop"
      aria-labelledby="drop-title"
      className="relative isolate overflow-hidden border-t-4 border-ink text-ink"
      style={{ backgroundColor: product?.colorBlock ?? 'var(--color-lav)' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 -z-10 h-[60%] w-[46%] opacity-25"
        style={{
          backgroundImage: 'radial-gradient(circle, #0B0B0F 34%, transparent 38%)',
          backgroundSize: '12px 12px',
          maskImage: 'radial-gradient(ellipse at 0% 100%, #000 10%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 0% 100%, #000 10%, transparent 70%)',
        }}
      />
      <div className="container-x py-12 md:py-16">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="label flex items-center gap-3">
              <span className="bg-ink px-2 py-1 text-volt">Chapter 04</span>
              Front to back
            </p>
            <h2 id="drop-title" className="h-display mt-3 text-[clamp(40px,5.4vw,80px)] leading-[0.88]">
              Drop of the <em className="accent accent-door">week</em>
            </h2>
          </div>
          <span lang="ja" aria-hidden="true" className="jp-sub">
            今週の一枚 · 背中で語れ
          </span>
        </header>

        {product ? (
          <div className="mt-7 grid grid-cols-[minmax(0,44%)_minmax(0,1fr)] gap-x-4 gap-y-6 sm:gap-x-6 lg:grid-cols-12 lg:gap-x-10">
            <div className="lg:col-span-5 lg:row-span-3">
              <DropFlip product={product} label="Drop 01" />
            </div>
            <div className="min-w-0 lg:col-span-7">
              {collection && (
                <Link href={`/arc/${collection.slug}`} className="label focus-ring inline-block bg-ink px-2 py-0.5 text-paper can-hover:hover:bg-door">
                  {collection.name}
                </Link>
              )}
              <h3 id="drop-product" className="h-display mt-2 text-[clamp(30px,4.2vw,58px)] leading-[0.88]">
                {product.designTitle}
              </h3>
              {product.jpTitle && (
                <span lang="ja" className="jp-sub mt-1.5 block">
                  {product.jpTitle}
                </span>
              )}
              <PriceTag product={product} size="lg" sticker rotate={-3} className="mt-3 inline-flex" />
              <p className="mt-3 hidden max-w-[48ch] text-[15px] leading-[1.5] text-ink/80 sm:block">
                {lead(product.description)} Small mark on the chest, the whole story on the back: prints up to 12×15&nbsp;in.
              </p>
            </div>
            <div className="col-span-2 lg:col-span-7">
              <DropBuy product={product} />
            </div>
            <Link
              href="/custom"
              data-cursor="DESIGN"
              className="press focus-ring group col-span-2 flex min-h-14 items-center justify-between gap-4 border-[3px] border-ink bg-ink px-4 py-3 text-paper shadow-hard-sm lg:col-span-7"
            >
              <span className="text-[15px] leading-snug">
                <strong className="font-display text-[20px] uppercase tracking-[0.02em] text-volt">Your own art on the back?</strong>{' '}
                <span className="text-tone-4">Send your design, we print front and back.</span>
              </span>
              <span className="label inline-flex shrink-0 items-center gap-1.5">
                Design Your Own
                <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={3} />
              </span>
            </Link>
          </div>
        ) : (
          <div className="panel-paper mt-7 flex items-center gap-6 p-6 shadow-hard">
            <KadoArt name="kado-sleepy" size={96} />
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
