'use client'
// ArcBrowser — an arc's products grouped by type (owner: P1 shop).
// Optional sub-fandom chips (Beyond Anime) filter client-side via ?f=<tag>. The Suspense fallback is
// the same markup unfiltered, so the static HTML always holds every product (SEO).
import { Suspense, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, X } from 'lucide-react'
import type { Product } from '@/lib/types'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { CATEGORIES, TYPE_GROUPS, TYPE_LABEL, slugify } from './catalog'
import { ProductGrid } from './ProductGrid'

export interface ArcBrowserProps {
  products: Product[]
  arcName: string
  /** sub-fandom chip labels (collection.subFandoms) — enables the ?f= filter */
  subFandoms?: string[]
  /** per-group H2 override: groupId → [before, accent, after] */
  titles?: Record<string, [string, string, string]>
}

function Inner({ products, arcName, subFandoms, titles, f, onPick }: ArcBrowserProps & { f: string | null; onPick?: (f: string | null) => void }) {
  const chips = useMemo(() => (subFandoms ?? []).map((name) => ({ name, f: slugify(name) })), [subFandoms])
  const active = f && chips.some((c) => c.f === f) ? f : null
  const list = useMemo(() => (active ? products.filter((p) => p.tags.includes(active)) : products), [products, active])
  const groups = TYPE_GROUPS.map((g) => ({ ...g, items: list.filter((p) => g.types.includes(p.type)) })).filter((g) => g.items.length)
  const activeName = chips.find((c) => c.f === active)?.name

  return (
    <>
      {chips.length > 0 && (
        <section aria-labelledby="fandom-h" className="container-x pt-12 md:pt-16">
          <h2 id="fandom-h" className="h-display text-[clamp(2.25rem,5.5vw,4.75rem)]">Pick another <em>fandom</em></h2>
          <p lang="ja" className="jp-sub mt-2">ファンダムを選ぶ</p>
          <div role="group" aria-label="Filter by fandom" className="mt-6 flex flex-wrap gap-2.5">
            {[{ name: 'All fandoms', f: null as string | null }, ...chips].map((c, i) => {
              const on = c.f === active
              return (
                <button
                  key={c.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPick?.(on && c.f ? null : c.f)}
                  className={cn(
                    'press label min-h-11 border-[3px] px-4 text-[0.75rem] transition-[transform,background-color,color] duration-150 focus-ring',
                    on ? 'border-ink bg-arc-a text-ink shadow-hard-paper' : 'border-paper bg-ink text-paper hover:-translate-y-0.5',
                  )}
                  style={{ rotate: on ? `${i % 2 ? 1.5 : -1.5}deg` : undefined }}
                >
                  {c.name}
                </button>
              )
            })}
          </div>
          <p aria-live="polite" className="label mt-4 text-[0.6875rem] text-paper/70">
            {activeName ? `${list.length} ${activeName}-inspired ${list.length === 1 ? 'piece' : 'pieces'}` : `${products.length} pieces across every fandom`}
          </p>
        </section>
      )}

      {groups.length === 0 && (
        <div className="container-x pt-12">
          <div className="panel-paper flex flex-col items-start gap-4 p-6 shadow-hard-volt">
            <p className="h-display text-3xl">No door leads there… yet</p>
            <p className="text-tone-2">Nothing in this fandom right now. Ask for it custom, or see everything.</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => onPick?.(null)} className="press label inline-flex min-h-11 items-center gap-2 border-[3px] border-ink bg-volt px-4 text-[0.75rem] text-ink shadow-hard-sm focus-ring">
                <X aria-hidden="true" className="h-4 w-4" /> Show all
              </button>
              <Link href="/custom" className="press label inline-flex min-h-11 items-center gap-2 border-[3px] border-ink bg-paper px-4 text-[0.75rem] text-ink shadow-hard-sm focus-ring">Make it custom</Link>
            </div>
          </div>
        </div>
      )}

      {groups.map((g, gi) => {
        const t = titles?.[g.id] ?? g.title
        const cats = CATEGORIES.filter((c) => g.items.some(c.match)).slice(0, 4)
        const types = [...new Set(g.items.map((p) => p.type))]
        return (
          <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="container-x scroll-mt-28 pt-16 md:pt-24">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-2">
                <p className="label text-[0.6875rem] text-arc-b">
                  {String(gi + 1).padStart(2, '0')} · {types.map((ty) => TYPE_LABEL[ty][1]).join(' · ')}
                </p>
                <h2 id={`${g.id}-h`} className="h-display text-[clamp(2.25rem,5.5vw,4.75rem)] [&_em]:[--accent-bg:var(--arc-a)]">
                  {t[0]}<em>{t[1]}</em>{t[2]}
                </h2>
              </div>
              {cats.length > 0 && (
                <ul className="flex flex-wrap gap-2 md:justify-end" role="list">
                  {cats.map((c) => (
                    <li key={c.slug}>
                      <Link href={`/shop/${c.slug}`} className="group label inline-flex min-h-11 items-center gap-1.5 border-2 border-paper/70 px-3 text-[0.6875rem] text-paper hover:border-paper hover:bg-paper hover:text-ink focus-ring">
                        {arcName} {c.label.toLowerCase()}
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 -rotate-45 transition-transform duration-200 group-hover:rotate-0" strokeWidth={2.6} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <ProductGrid products={g.items} pageSize={0} priorityCount={gi === 0 ? 2 : 0} flipKey={active ?? ''} />
          </section>
        )
      })}
    </>
  )
}

function WithParams(props: ArcBrowserProps) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const [f, setF] = useState<string | null>(params.get('f'))
  const onPick = (next: string | null) => {
    setF(next) // instant feedback; URL follows
    if (next) track('filter', { f: next, page: pathname })
    startTransition(() => router.replace(next ? `${pathname}?f=${encodeURIComponent(next)}` : pathname, { scroll: false }))
  }
  return <Inner {...props} f={f} onPick={onPick} />
}

export function ArcBrowser(props: ArcBrowserProps) {
  return (
    <Suspense fallback={<Inner {...props} f={null} />}>
      <WithParams {...props} />
    </Suspense>
  )
}

export default ArcBrowser
