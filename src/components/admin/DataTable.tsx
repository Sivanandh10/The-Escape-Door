'use client'
// Admin data table (P4a): search, sortable headers, pagination, designed loading/empty/error states,
// row exit animation (pairs with ConfirmShred), card layout on phones (<768px).
// Client-only props (functions) → use it from a 'use client' component.
//   <DataTable caption="Leads" rows={leads} rowKey={(r) => r.id} columns={[{ id: 'name', header: 'Name', cell: (r) => r.name, sortValue: (r) => r.name }]} />
import { useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { AdminSkeleton, EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { adminInput } from './ui'

export interface DataTableColumn<T> {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** enables sorting on this column */
  sortValue?: (row: T) => string | number | null | undefined
  align?: 'left' | 'right' | 'center'
  /** th/td classes (e.g. width "w-[140px]") */
  className?: string
  /** omit from the phone card layout */
  hideOnMobile?: boolean
  /** label in the phone card layout (defaults to header when it is a string) */
  mobileLabel?: string
}

export interface DataTableProps<T> {
  rows: T[]
  columns: DataTableColumn<T>[]
  rowKey: (row: T) => string
  /** accessible table caption (visually hidden) */
  caption: string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** custom empty state (default: EmptyState "Nothing here yet") */
  empty?: ReactNode
  /** client-side search box; `text` returns the searchable string for a row */
  search?: { placeholder?: string; text: (row: T) => string }
  /** extra controls left of the search box (filters, export) */
  toolbar?: ReactNode
  /** row click (also Enter/Space on the focused row) — e.g. open a detail drawer */
  onRowClick?: (row: T) => void
  /** trailing actions cell (e.g. <ConfirmShred …/>) */
  rowActions?: (row: T) => ReactNode
  /** default 25; 0 = no pagination */
  pageSize?: number
  initialSort?: { id: string; dir: 'asc' | 'desc' }
  /** highlights a row (e.g. the one open in a drawer) */
  selectedKey?: string | null
  dense?: boolean
  className?: string
}

export function DataTable<T>({
  rows, columns, rowKey, caption, loading, error, onRetry, empty, search, toolbar, onRowClick, rowActions,
  pageSize = 25, initialSort, selectedKey, dense, className,
}: DataTableProps<T>) {
  const reduced = useReducedMotion()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(initialSort ?? null)
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = needle && search ? rows.filter((r) => search.text(r).toLowerCase().includes(needle)) : rows
    if (sort) {
      const col = columns.find((c) => c.id === sort.id)
      if (col?.sortValue) {
        const sv = col.sortValue
        const dir = sort.dir === 'asc' ? 1 : -1
        out = [...out].sort((a, b) => {
          const x = sv(a), y = sv(b)
          if (x == null && y == null) return 0
          if (x == null) return 1
          if (y == null) return -1
          return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en', { numeric: true })) * dir
        })
      }
    }
    return out
  }, [rows, q, search, sort, columns])

  const pages = pageSize > 0 ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1
  const safePage = Math.min(page, pages - 1)
  const visible = pageSize > 0 ? filtered.slice(safePage * pageSize, safePage * pageSize + pageSize) : filtered

  const toggleSort = (id: string) => {
    setPage(0)
    setSort((s) => (!s || s.id !== id ? { id, dir: 'desc' } : s.dir === 'desc' ? { id, dir: 'asc' } : null))
  }

  const exit = reduced ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, x: 48, transition: { duration: 0.26 } }
  const alignCls = (a?: 'left' | 'right' | 'center') => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')
  const cellPad = dense ? 'px-3 py-2' : 'px-4 py-3'
  const rowProps = (row: T) =>
    onRowClick
      ? {
          tabIndex: 0,
          role: 'button' as const,
          onClick: () => onRowClick(row),
          onKeyDown: (e: React.KeyboardEvent) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onRowClick(row) }
          },
        }
      : {}

  const showToolbar = Boolean(search || toolbar)

  return (
    <div className={cn('min-w-0', className)}>
      {showToolbar && (
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
          {search && (
            <label className="relative block sm:ml-auto sm:w-[300px]">
              <span className="sr-only">Search {caption}</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-paper/45" />
              <input
                type="search"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(0) }}
                placeholder={search.placeholder ?? 'Search…'}
                className={cn(adminInput, 'pl-9')}
              />
            </label>
          )}
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : loading ? (
        <AdminSkeleton variant="table" rows={6} />
      ) : filtered.length === 0 ? (
        q ? (
          <EmptyState compact mood="shock" sfx="ゴゴゴ" title="No door leads there" body={<>Nothing matches “{q}”. Try fewer words.</>} />
        ) : (
          empty ?? <EmptyState compact title="Nothing here yet" body="New entries show up here as soon as they arrive." />
        )
      ) : (
        <>
          {/* ── table (≥768px) ── */}
          <div className="hidden overflow-x-auto border-2 border-paper/15 bg-tone-1 md:block" data-lenis-prevent-horizontal="">
            <table className="w-full border-collapse text-[14px]">
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr className="border-b-2 border-paper/15 bg-ink">
                  {columns.map((c) => {
                    const active = sort?.id === c.id
                    return (
                      <th
                        key={c.id}
                        scope="col"
                        aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                        className={cn('label whitespace-nowrap text-[10.5px] font-medium text-paper/60', cellPad, alignCls(c.align), c.className)}
                      >
                        {c.sortValue ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c.id)}
                            className={cn('inline-flex min-h-8 items-center gap-1 uppercase focus-ring can-hover:hover:text-paper', active && 'text-volt')}
                          >
                            {c.header}
                            {active ? (
                              sort!.dir === 'asc' ? <ArrowUp aria-hidden="true" className="size-3.5" /> : <ArrowDown aria-hidden="true" className="size-3.5" />
                            ) : (
                              <ArrowUpDown aria-hidden="true" className="size-3.5 opacity-40" />
                            )}
                          </button>
                        ) : (
                          c.header
                        )}
                      </th>
                    )
                  })}
                  {rowActions && <th scope="col" className={cn(cellPad, 'w-px')}><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {visible.map((row) => {
                    const k = rowKey(row)
                    return (
                      <motion.tr
                        key={k}
                        layout={reduced ? false : 'position'}
                        exit={exit}
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        {...rowProps(row)}
                        className={cn(
                          'border-b border-paper/10 transition-colors duration-150 last:border-b-0',
                          onRowClick && 'cursor-pointer focus-ring can-hover:hover:bg-paper/[0.04]',
                          selectedKey === k && 'bg-door/25 shadow-[inset_4px_0_0_var(--color-volt)]',
                        )}
                      >
                        {columns.map((c) => (
                          <td key={c.id} className={cn('align-middle', cellPad, alignCls(c.align), c.className)}>
                            {c.cell(row)}
                          </td>
                        ))}
                        {rowActions && (
                          <td className={cn(cellPad, 'w-px whitespace-nowrap text-right')} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                            {rowActions(row)}
                          </td>
                        )}
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* ── cards (<768px) ── */}
          <ul className="space-y-3 md:hidden" aria-label={caption}>
            <AnimatePresence initial={false}>
              {visible.map((row) => {
                const k = rowKey(row)
                const [head, ...rest] = columns.filter((c) => !c.hideOnMobile)
                return (
                  <motion.li
                    key={k}
                    layout={reduced ? false : 'position'}
                    exit={exit}
                    {...rowProps(row)}
                    className={cn(
                      'border-2 border-paper/15 bg-tone-1 p-4',
                      onRowClick && 'cursor-pointer focus-ring active:bg-paper/[0.04]',
                      selectedKey === k && 'border-volt',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 text-[15px] font-semibold">{head?.cell(row)}</div>
                      {rowActions && (
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          {rowActions(row)}
                        </div>
                      )}
                    </div>
                    {rest.length > 0 && (
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13.5px]">
                        {rest.map((c) => (
                          <div key={c.id} className="min-w-0">
                            <dt className="label text-[9.5px] text-paper/45">{c.mobileLabel ?? (typeof c.header === 'string' ? c.header : c.id)}</dt>
                            <dd className="mt-0.5 min-w-0 break-words">{c.cell(row)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>

          {pageSize > 0 && filtered.length > pageSize && (
            <nav aria-label={`${caption} pages`} className="mt-3 flex items-center justify-between gap-3">
              <p className="font-mono text-[12px] tabular-nums text-paper/60">
                {safePage * pageSize + 1}–{Math.min(filtered.length, (safePage + 1) * pageSize)} of {filtered.length}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                  className="grid size-11 place-items-center border-2 border-paper/25 focus-ring disabled:opacity-30 can-hover:hover:border-volt"
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={safePage >= pages - 1}
                  onClick={() => setPage(safePage + 1)}
                  className="grid size-11 place-items-center border-2 border-paper/25 focus-ring disabled:opacity-30 can-hover:hover:border-volt"
                >
                  <ChevronRight aria-hidden="true" className="size-4" />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
