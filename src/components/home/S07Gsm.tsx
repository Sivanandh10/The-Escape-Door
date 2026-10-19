// STUB by F1 so the home page composes. Owner: S07 section agent (replace freely).
import type { HoodieTier } from '@/lib/types'
import { formatINR } from '@/lib/pricing'

export default function S07Gsm({ tiers = [] }: { tiers?: HoodieTier[] }) {
  return (
    <section id="gsm" aria-labelledby="gsm-title" className="section-y border-t-4 border-ink bg-ink text-paper">
      <div className="container-x">
        <p className="label text-tone-4">Chapter 07 · Hoodie power levels</p>
        <h2 id="gsm-title" className="h-display mt-4 max-w-[16ch] text-h2">
          Hoodie power <em>levels</em>: 280 to 600 GSM
        </h2>
        <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
          パワーレベル
        </span>
        <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((t) => (
            <li key={t.id} className="border-4 border-paper p-4">
              <span className="label text-volt">{t.code}</span>
              <span className="mt-2 block font-display text-[30px] uppercase leading-none">
                {t.gsmMin}–{t.gsmMax} GSM
              </span>
              <span className="mt-2 block font-mono">{formatINR(t.price)}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
