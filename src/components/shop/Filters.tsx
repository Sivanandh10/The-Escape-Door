'use client'
// Filters — controlled catalogue toolbar (owner: P1 shop): search, arc chips, category chips,
// price range (dual slider), in-stock toggle, sort, reset. Pure UI; ShopBrowser owns state + URL.
import { useId } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { formatINR } from '@/lib/pricing'
import { cn } from '@/lib/utils'

export type SortKey = 'featured' | 'new' | 'price-asc' | 'price-desc'
export const SORTS: Array<[SortKey, string]> = [
  ['featured', 'Featured'],
  ['new', 'Newest'],
  ['price-asc', 'Price: low → high'],
  ['price-desc', 'Price: high → low'],
]

export interface ShopQuery {
  q: string
  arc: string
  cat: string
  f: string
  min: number | null
  max: number | null
  stock: boolean
  sort: SortKey
}

export interface ChipOption { value: string; label: string; count?: number; swatch?: [string, string] }

export interface FiltersProps {
  query: ShopQuery
  onChange: (patch: Partial<ShopQuery>, opts?: { debounce?: boolean }) => void
  onReset: () => void
  arcs?: ChipOption[]
  cats?: ChipOption[]
  fandoms?: ChipOption[]
  bounds: [number, number]
  active: number
  searchValue: string
  className?: string
}

function ChipRow({ label, options, value, onPick, name }: { label: string; options: ChipOption[]; value: string; onPick: (v: string) => void; name: string }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className="flex min-w-0 items-center gap-3">
      <span id={id} className="label w-12 shrink-0 text-[0.625rem] opacity-60 max-md:hidden">{label}</span>
      <div className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-lenis-prevent-horizontal="">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value || 'all'}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(on && o.value ? '' : o.value)}
              data-filter={name}
              className={cn(
                'press label inline-flex min-h-10 shrink-0 items-center gap-2 border-2 border-ink px-3 text-[0.6875rem] font-bold focus-ring',
                on ? 'bg-ink text-volt shadow-[3px_3px_0_0_var(--color-volt)]' : 'bg-paper text-ink shadow-hard-sm hover:bg-lav',
              )}
            >
              {o.swatch && (
                <span aria-hidden="true" className="inline-block h-3.5 w-3.5 border-2 border-current" style={{ background: `linear-gradient(135deg, ${o.swatch[0]} 50%, ${o.swatch[1]} 50%)` }} />
              )}
              {o.label}
              {o.count != null && <span className="font-mono text-[0.625rem] opacity-60">{o.count}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Filters({ query, onChange, onReset, arcs, cats, fandoms, bounds, active, searchValue, className }: FiltersProps) {
  const searchId = useId()
  const sortId = useId()
  const [lo, hi] = bounds
  const min = query.min ?? lo
  const max = query.max ?? hi
  const step = hi - lo > 1000 ? 50 : 10
  const pct = (v: number) => ((v - lo) / Math.max(1, hi - lo)) * 100

  return (
    <div className={cn('panel-paper relative flex flex-col gap-2 p-3 shadow-hard md:gap-3 md:p-4', className)} role="search" aria-label="Filter the catalogue">
      <div className="flex flex-wrap items-stretch gap-2">
        <label htmlFor={searchId} className="relative flex min-h-12 min-w-0 flex-[1_1_16rem] items-center border-[3px] border-ink bg-paper focus-within:outline focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-door">
          <Search aria-hidden="true" className="ml-3 h-5 w-5 shrink-0" strokeWidth={2.6} />
          <span className="sr-only">Search products</span>
          <input
            id={searchId}
            type="search"
            inputMode="search"
            autoComplete="off"
            value={searchValue}
            placeholder="Search designs, arcs, polaroids…"
            onChange={(e) => onChange({ q: e.target.value }, { debounce: true })}
            className="h-full min-w-0 flex-1 bg-transparent px-3 font-body text-base text-ink outline-none placeholder:text-tone-3 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchValue && (
            <button type="button" onClick={() => onChange({ q: '' })} aria-label="Clear search" className="mr-1 grid h-10 w-10 place-items-center focus-ring">
              <X aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
            </button>
          )}
        </label>
        <div className="relative flex min-h-12 items-center border-[3px] border-ink bg-volt">
          <label htmlFor={sortId} className="label pl-3 text-[0.625rem]">Sort</label>
          <select
            id={sortId}
            value={query.sort}
            onChange={(e) => onChange({ sort: e.target.value as SortKey })}
            className="h-full cursor-pointer appearance-none bg-transparent py-2 pl-2 pr-8 font-mono text-sm font-bold text-ink outline-none focus-visible:outline-3 focus-visible:outline-door"
          >
            {SORTS.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          <span aria-hidden="true" className="pointer-events-none absolute right-3 font-mono text-xs">▼</span>
        </div>
      </div>

      {arcs && arcs.length > 1 && <ChipRow name="arc" label="Arc" options={arcs} value={query.arc} onPick={(v) => onChange({ arc: v })} />}
      {fandoms && fandoms.length > 1 && <ChipRow name="fandom" label="Fandom" options={fandoms} value={query.f} onPick={(v) => onChange({ f: v })} />}
      {cats && cats.length > 1 && <ChipRow name="cat" label="Type" options={cats} value={query.cat} onPick={(v) => onChange({ cat: v })} />}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t-2 border-dashed border-ink/30 pt-2 md:pt-3">
        <div className="flex min-w-[14rem] flex-[1_1_18rem] items-center gap-3">
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2.6} />
          <span className="label shrink-0 text-[0.625rem] opacity-60">Price</span>
          <div className="relative h-11 flex-1">
            <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 border-2 border-ink bg-paper tone-bg [--tone-color:var(--color-tone-4)]" />
            <div aria-hidden="true" className="absolute top-1/2 h-2 -translate-y-1/2 border-y-2 border-ink bg-volt" style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }} />
            <input
              type="range" min={lo} max={hi} step={step} value={min}
              aria-label="Minimum price" aria-valuetext={formatINR(min)}
              onChange={(e) => onChange({ min: Math.min(Number(e.target.value), max - step) === lo ? null : Math.min(Number(e.target.value), max - step) }, { debounce: true })}
              className="ted-range absolute inset-0 w-full"
            />
            <input
              type="range" min={lo} max={hi} step={step} value={max}
              aria-label="Maximum price" aria-valuetext={formatINR(max)}
              onChange={(e) => onChange({ max: Math.max(Number(e.target.value), min + step) === hi ? null : Math.max(Number(e.target.value), min + step) }, { debounce: true })}
              className="ted-range absolute inset-0 w-full"
            />
          </div>
          <output className="shrink-0 font-mono text-xs font-bold tabular-nums">
            {formatINR(min)}–{formatINR(max).slice(1)}
          </output>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2">
          <input type="checkbox" checked={query.stock} onChange={(e) => onChange({ stock: e.target.checked })} className="peer sr-only" />
          <span aria-hidden="true" className="relative h-6 w-11 border-2 border-ink bg-paper transition-colors peer-checked:bg-ink peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-door peer-checked:[&>span]:translate-x-5 peer-checked:[&>span]:bg-volt">
            <span className="absolute left-0.5 top-0.5 h-4 w-4 border-2 border-ink bg-tone-4 transition-transform duration-200" />
          </span>
          <span className="label text-[0.6875rem]">Ready to ship only</span>
        </label>
        <button
          type="button"
          onClick={onReset}
          disabled={!active}
          className="label ml-auto min-h-11 px-2 text-[0.6875rem] underline decoration-2 underline-offset-4 focus-ring disabled:no-underline disabled:opacity-35"
        >
          Reset{active ? ` (${active})` : ''}
        </button>
      </div>
    </div>
  )
}

export default Filters
