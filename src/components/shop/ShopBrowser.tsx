'use client'
// ShopBrowser — catalogue state machine (owner: P1 shop → RECS+SHOP). The page renders the catalogue statically;
// this filters/sorts/searches/pages on the client and mirrors the query into the URL with the native History API
// (Next syncs useSearchParams; no server round-trip):
//   filters → history.replaceState (page resets to 1) · numbered page → history.pushState (Back returns to it)
//   URL params: q, collection (arc; legacy `arc` is read too — /shop?arc= alone 308s to /arc/<slug>), cat, f,
//   min, max, stock=in, sort, page. Canonical stays /shop (page metadata). Refresh / Back / Forward restore state.
// Chip counts are faceted: each chip counts the results it would give with every OTHER active filter applied.
//
// Usage (server page):
//   <ShopBrowserSuspended products={…} collections={…} lock={{ cat: 'hoodies' }} />
// The Suspense fallback is the SAME grid without query params, so the static HTML always contains
// every product (SEO) and nothing jumps when the param-aware version hydrates.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { Collection, Product } from '@/lib/types'
import { track } from '@/lib/analytics'
import { prefersReducedMotion } from '@/lib/motion'
import { pushSignalSearch } from '@/lib/recs/signals'
import { cn } from '@/lib/utils'
import { Mascot } from '@/components/brand/Mascot'
import { CATEGORIES, minPrice, searchText, slugify } from './catalog'
import { Filters, type ChipOption, type ShopQuery, type SortKey } from './Filters'
import { ProductGrid } from './ProductGrid'

export type ArcLite = Pick<Collection, 'slug' | 'name' | 'jp' | 'accentA' | 'accentB'>

export interface ShopBrowserProps {
  products: Product[]
  collections: ArcLite[]
  /** pre-applied, not user-removable scope (category page / arc page) */
  lock?: { arc?: string; cat?: string }
  /** sub-fandom chips (beyond-anime): labels; matched against product tags by slug */
  fandoms?: string[]
  /** hide the category chips (e.g. on a category page) */
  hideCats?: boolean
  pageSize?: number
  className?: string
}

const DEFAULT: ShopQuery = { q: '', arc: '', cat: '', f: '', min: null, max: null, stock: false, sort: 'featured', page: 1 }
const SORT_KEYS: SortKey[] = ['featured', 'new', 'price-asc', 'price-desc']

function parse(search: string): ShopQuery {
  const sp = new URLSearchParams(search)
  const num = (k: string) => {
    const v = sp.get(k)
    const n = v == null || v === '' ? NaN : Number(v)
    return Number.isFinite(n) ? n : null
  }
  const sort = sp.get('sort') as SortKey | null
  const page = Math.floor(Number(sp.get('page')))
  return {
    q: (sp.get('q') ?? '').slice(0, 80),
    arc: sp.get('collection') ?? sp.get('arc') ?? '',
    cat: sp.get('cat') ?? sp.get('category') ?? '',
    f: sp.get('f') ?? '',
    min: num('min'),
    max: num('max'),
    stock: sp.get('stock') === 'in',
    sort: sort && SORT_KEYS.includes(sort) ? sort : 'featured',
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 999) : 1,
  }
}

function serialize(q: ShopQuery): string {
  const sp = new URLSearchParams()
  if (q.q.trim()) sp.set('q', q.q.trim())
  if (q.arc) sp.set('collection', q.arc) // not `arc`: /shop?arc=<slug> is a 308 to the arc page (next.config)
  if (q.cat) sp.set('cat', q.cat)
  if (q.f) sp.set('f', q.f)
  if (q.min != null) sp.set('min', String(q.min))
  if (q.max != null) sp.set('max', String(q.max))
  if (q.stock) sp.set('stock', 'in')
  if (q.sort !== 'featured') sp.set('sort', q.sort)
  if (q.page > 1) sp.set('page', String(q.page))
  const s = sp.toString()
  return s ? `?${s}` : ''
}

type Facet = 'arc' | 'cat' | 'f'

/** Does product p pass every active filter (optionally ignoring one facet, for faceted chip counts)? */
function makeMatcher(query: ShopQuery, hay: (p: Product) => string, skip?: Facet) {
  const words = query.q.toLowerCase().split(/\s+/).filter(Boolean)
  const cat = skip === 'cat' ? undefined : CATEGORIES.find((c) => c.slug === query.cat)
  return (p: Product): boolean => {
    if (skip !== 'arc' && query.arc && p.collection !== query.arc) return false
    if (cat && !cat.match(p)) return false
    if (skip !== 'f' && query.f && !p.tags.includes(query.f)) return false
    if (query.stock && !(p.stock === 'in' || p.stock === 'low')) return false
    if (query.min != null || query.max != null) {
      const m = minPrice(p)
      if (m == null) return false
      if (query.min != null && m < query.min) return false
      if (query.max != null && m > query.max) return false
    }
    if (words.length) {
      const h = hay(p)
      if (!words.every((w) => h.includes(w))) return false
    }
    return true
  }
}

function ShopBrowserInner({ products, collections, lock, fandoms, hideCats, pageSize = 24, className, search }: ShopBrowserProps & { search: string }) {
  const pathname = usePathname()
  const urlQuery = useMemo(() => parse(search), [search])
  const gridTop = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState<ShopQuery>(urlQuery)
  const [typed, setTyped] = useState(urlQuery.q)
  const debounce = useRef<number | undefined>(undefined)

  // URL → state (back/forward, header search landing on /shop?q=)
  const [lastSearch, setLastSearch] = useState(search)
  if (lastSearch !== search) {
    setLastSearch(search)
    setQuery(urlQuery)
    setTyped(urlQuery.q)
  }

  const names = useMemo(() => Object.fromEntries(collections.map((c) => [c.slug, c.name])), [collections])

  // scope = locked filters only
  const lockArc = lock?.arc
  const lockCat = lock?.cat
  const scope = useMemo(
    () =>
      products.filter((p) => {
        if (lockArc && p.collection !== lockArc) return false
        if (lockCat && !CATEGORIES.find((c) => c.slug === lockCat)?.match(p)) return false
        return true
      }),
    [products, lockArc, lockCat],
  )

  const bounds = useMemo<[number, number]>(() => {
    const prices = scope.map(minPrice).filter((n): n is number => n != null)
    if (!prices.length) return [0, 1000]
    const step = 50
    return [Math.floor(Math.min(...prices) / 10) * 10, Math.ceil(Math.max(...prices) / step) * step]
  }, [scope])

  // search text per product, built once per catalogue
  const hay = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of scope) m.set(p.id, searchText(p, names[p.collection]))
    return (p: Product) => m.get(p.id) ?? searchText(p, names[p.collection])
  }, [scope, names])

  const results = useMemo(() => {
    const out = scope.filter(makeMatcher(query, hay))
    const idx = new Map(scope.map((p, i) => [p.id, i]))
    const byPrice = (dir: 1 | -1) => (a: Product, b: Product) => {
      const pa = minPrice(a), pb = minPrice(b)
      if (pa == null && pb == null) return 0
      if (pa == null) return 1
      if (pb == null) return -1
      return (pa - pb) * dir
    }
    switch (query.sort) {
      case 'price-asc': return out.sort(byPrice(1))
      case 'price-desc': return out.sort(byPrice(-1))
      case 'new': return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || (idx.get(a.id)! - idx.get(b.id)!))
      default:
        return out.sort((a, b) => Number(b.dropOfWeek) - Number(a.dropOfWeek) || Number(b.featured) - Number(a.featured) || (idx.get(a.id)! - idx.get(b.id)!))
    }
  }, [scope, query, hay])

  // History API (Next keeps useSearchParams in sync): no RSC round-trip, no redirect hop
  const commit = useCallback(
    (next: ShopQuery, mode: 'replace' | 'push' = 'replace') => {
      const url = `${pathname}${serialize(next)}`
      if (url === `${window.location.pathname}${window.location.search}`) return
      if (mode === 'push') window.history.pushState(null, '', url)
      else window.history.replaceState(null, '', url)
    },
    [pathname],
  )

  // committed searches feed the recommendation engine (this device only)
  useEffect(() => {
    if (urlQuery.q.trim().length >= 2) pushSignalSearch(urlQuery.q)
  }, [urlQuery.q])

  const latest = useRef(query)
  // eslint-disable-next-line react-hooks/refs -- latest query for the debounced / page handlers (same render's state)
  latest.current = query
  const onChange = useCallback(
    (patch: Partial<ShopQuery>, opts?: { debounce?: boolean }) => {
      if ('q' in patch) setTyped(patch.q ?? '')
      const next = { ...latest.current, ...patch, page: 1 } // any filter change → back to page 1
      latest.current = next
      setQuery(next)
      window.clearTimeout(debounce.current)
      if (opts?.debounce) {
        debounce.current = window.setTimeout(() => {
          commit(next)
          if ('q' in patch && next.q.trim()) track('search', { q: next.q.trim().slice(0, 60) })
          else track('filter', { min: next.min, max: next.max })
        }, 320)
      } else {
        commit(next)
        track('filter', { ...patch } as Record<string, string | number | boolean | null>)
      }
    },
    [commit],
  )
  useEffect(() => () => window.clearTimeout(debounce.current), [])

  const scrollToGrid = useCallback(() => {
    const el = gridTop.current
    if (!el) return
    const hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64
    const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - hh - 16)
    const reduce = prefersReducedMotion()
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: reduce, duration: 0.7 })
    else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' })
  }, [])

  const onPage = useCallback(
    (page: number, how: 'jump' | 'more') => {
      const next = { ...latest.current, page }
      latest.current = next
      setQuery(next)
      window.clearTimeout(debounce.current)
      // numbered pages are real history entries (Back returns to the previous page); "load more" just updates
      commit(next, how === 'jump' ? 'push' : 'replace')
      if (how === 'jump') requestAnimationFrame(scrollToGrid)
      track('filter', { page })
    },
    [commit, scrollToGrid],
  )

  const reset = () => {
    // a search / price change still waiting on its 320 ms debounce would otherwise re-apply after the reset
    window.clearTimeout(debounce.current)
    setTyped('')
    latest.current = DEFAULT
    setQuery(DEFAULT)
    commit(DEFAULT)
  }

  // faceted counts: a chip counts what it would show with every OTHER active filter applied
  const facetCount = (skip: Facet, pred: (p: Product) => boolean) => {
    const m = makeMatcher(query, hay, skip)
    let n = 0
    for (const p of scope) if (pred(p) && m(p)) n++
    return n
  }
  const inScope = (pred: (p: Product) => boolean) => scope.some(pred)
  const arcOpts: ChipOption[] | undefined = lock?.arc
    ? undefined
    : [
        { value: '', label: 'All arcs', count: facetCount('arc', () => true) },
        ...collections
          .filter((c) => inScope((p) => p.collection === c.slug))
          .map((c) => ({ value: c.slug, label: c.name, count: facetCount('arc', (p) => p.collection === c.slug), swatch: [c.accentA, c.accentB] as [string, string] })),
      ]
  const catOpts: ChipOption[] | undefined = hideCats || lock?.cat
    ? undefined
    : [
        { value: '', label: 'Everything', count: facetCount('cat', () => true) },
        ...CATEGORIES.filter((c) => inScope(c.match)).map((c) => ({ value: c.slug, label: c.label, count: facetCount('cat', c.match) })),
      ]
  const fandomOpts: ChipOption[] | undefined = fandoms?.length
    ? [
        { value: '', label: 'All fandoms', count: facetCount('f', () => true) },
        ...fandoms
          .filter((f) => inScope((p) => p.tags.includes(slugify(f))))
          .map((f) => ({ value: slugify(f), label: f, count: facetCount('f', (p) => p.tags.includes(slugify(f))) })),
      ]
    : undefined

  const active = (['q', 'arc', 'cat', 'f'] as const).filter((k) => query[k]).length + (query.min != null || query.max != null ? 1 : 0) + (query.stock ? 1 : 0)
  const flipKey = serialize({ ...query, q: query.q.trim() })
  const pages = Math.max(1, Math.ceil(results.length / Math.max(1, pageSize)))
  const hrefFor = (page: number) => `${pathname}${serialize({ ...query, q: query.q.trim(), page: Math.min(Math.max(1, page), pages) })}`

  return (
    <div className={cn('flex flex-col gap-6 md:gap-8', className)}>
      <Filters
        query={query}
        onChange={onChange}
        onReset={reset}
        arcs={arcOpts}
        cats={catOpts}
        fandoms={fandomOpts}
        bounds={bounds}
        active={active}
        searchValue={typed}
      />
      <div ref={gridTop} className="flex scroll-mt-[calc(var(--header-h)+16px)] items-end justify-between gap-4">
        <p className="font-mono text-sm" aria-live="polite" aria-atomic="true">
          <strong className="text-volt">{results.length}</strong> {results.length === 1 ? 'piece' : 'pieces'}
          {query.q.trim() ? <> for “{query.q.trim()}”</> : null}
          {pages > 1 && query.page > 1 ? <span className="opacity-70"> · page {Math.min(query.page, pages)} of {pages}</span> : null}
        </p>
        <p className="label text-[0.625rem] opacity-60 max-sm:hidden">Fan-inspired · original designs</p>
      </div>
      <ProductGrid
        products={results}
        collectionNames={names}
        pageSize={pageSize}
        flipKey={flipKey}
        page={query.page}
        onPageChange={onPage}
        hrefFor={hrefFor}
        empty={<EmptyDoor onReset={reset} />}
      />
    </div>
  )
}

function EmptyDoor({ onReset }: { onReset: () => void }) {
  return (
    <div className="panel-paper relative grid place-items-center gap-5 overflow-hidden px-6 py-14 text-center shadow-hard-volt md:grid-cols-[auto_1fr] md:text-left">
      <div className="pointer-events-none absolute inset-0 screentone screentone-light [--tone-opacity:0.18]" aria-hidden="true" />
      <Mascot mood="peek" size={150} animate title="" className="relative" />
      <div className="relative flex flex-col items-center gap-3 md:items-start">
        <p lang="ja" className="jp-sub">行き止まり</p>
        <h2 className="h-display text-[clamp(2.4rem,6vw,4.5rem)] text-ink">No door leads there… <em>yet</em></h2>
        <p className="max-w-md text-tone-2">Nothing matches those filters. Loosen them, or tell us what you were hunting for and we’ll make it custom.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onReset} className="press h-display min-h-12 border-[3px] border-ink bg-volt px-5 text-xl text-ink shadow-hard-sm focus-ring">
            Reset filters
          </button>
          <Link href="/custom" className="press h-display inline-flex min-h-12 items-center border-[3px] border-ink bg-paper px-5 text-xl text-ink shadow-hard-sm focus-ring">
            Make it custom
          </Link>
        </div>
      </div>
    </div>
  )
}

function WithParams(props: ShopBrowserProps) {
  const sp = useSearchParams()
  return <ShopBrowserInner {...props} search={sp.toString()} />
}

/** Static-first catalogue: Suspense fallback = the full unfiltered grid (in the static HTML). */
export function ShopBrowserSuspended(props: ShopBrowserProps) {
  return (
    <Suspense fallback={<ShopBrowserInner {...props} search="" />}>
      <WithParams {...props} />
    </Suspense>
  )
}

export default ShopBrowserSuspended
