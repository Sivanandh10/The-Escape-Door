// S04 BACK-PRINT REVEAL — pinned turntable front → back (#63 #10 #64). Owner: s03-s04-tee.
// Server shell (H2 + honest copy) handed to the client Turntable, which owns the pin / flip / reduced layouts.
import type { Product } from '@/lib/types'
import { Turntable } from './s04/Turntable'

export default function S04BackPrint({ product }: { product?: Product | null }) {
  const intro = (
    <header>
      <p className="label flex items-center gap-3 text-tone-4">
        <span className="bg-volt px-2 py-1 text-ink">Chapter 04</span>
        Back-print reveal
      </p>
      <h2 id="back-print-title" className="h-display mt-5 max-w-[11ch] text-[clamp(44px,8vw,96px)] lg:text-[clamp(52px,5vw,84px)]">
        Turn it around: back prints up to 12×15 <em>inches</em>
      </h2>
      <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
        背中で語れ
      </span>
      <p className="mt-6 max-w-[40ch] text-tone-4">
        A small 4×4&nbsp;in mark on the chest. The whole story on the back: prints run up to 12×15&nbsp;in
        {product ? <>, like {product.designTitle} here</> : null}. Want your own art on either side? Design Your Own does front and back.
      </p>
    </header>
  )

  return (
    <section id="back-print" aria-labelledby="back-print-title" className="relative isolate border-t-4 border-ink bg-ink text-paper">
      {/* screentone wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12]"
        style={{ backgroundImage: 'radial-gradient(circle, #6E6E78 30%, transparent 34%)', backgroundSize: '9px 9px' }}
      />
      {product ? (
        <Turntable product={product} intro={intro} />
      ) : (
        <div className="container-x section-y">{intro}</div>
      )}
    </section>
  )
}
