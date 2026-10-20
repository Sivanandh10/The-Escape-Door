'use client'
// Admin → Customers (owner: AUTH). Real shoppers only (team members excluded), refreshed live every 90 s while the
// tab is visible (+ manual refresh). Filters, search, sortable table, detail drawer (addresses, orders, recent views,
// MyAnimeList) and CSV export of the current filter. Read-only room: nothing here writes.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, ExternalLink, Loader2, RefreshCw, Sparkles, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import { formatINR } from '@/lib/pricing'
import { statusMeta } from '@/lib/checkout/types'
import { malAnimeUrl } from '@/lib/recs/mal-map'
import { cn } from '@/lib/utils'
import { AdminPage, AdminPanel } from '../AdminPage'
import { DataTable, type DataTableColumn } from '../DataTable'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { StatCard } from '../StatCard'
import { adminBtn, adminPill } from '../ui'
import { Chips, Drawer } from '../crud/kit'
import { downloadText, toCsv } from '../crud/data'
import { getCustomerDetail, reloadCustomers } from './actions'
import type { CustomerDetail, CustomerRow, CustomersData, Provider } from './data'

type Filter = 'all' | 'ordered' | 'none' | 'mal' | 'google' | 'new'
const WEEK = 7 * 86_400_000
const REFRESH_MS = 90_000

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
function ago(iso: string | null, now: number): string {
  if (!iso) return '—'
  const s = Math.max(0, (now - Date.parse(iso)) / 1000)
  if (s < 90) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`
  if (s < 30 * 86_400) return `${Math.round(s / 86_400)} d ago`
  return fmtDate(iso)
}
const PROVIDER_TONE: Record<Provider, Parameters<typeof adminPill>[0]> = { Google: 'paper', Email: 'lav', MyAnimeList: 'door' }

export function CustomersManager({ initial, demo }: { initial: CustomersData; demo?: boolean }) {
  const [data, setData] = useState(initial)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.parse(initial.loadedAt))

  const refresh = useCallback(async (quiet = false) => {
    setRefreshing(true)
    const r = await reloadCustomers()
    setRefreshing(false)
    if (!r.ok) {
      if (!quiet) toast.error(r.error)
      return
    }
    setData(r.data)
    setNow(Date.parse(r.data.loadedAt))
    if (!quiet) toast.success('Customers refreshed.')
  }, [])

  useEffect(() => {
    if (demo) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(true)
    }, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [demo, refresh])

  const rows = data.rows
  const counts = useMemo(() => {
    const c = { all: rows.length, ordered: 0, none: 0, mal: 0, google: 0, new: 0 }
    for (const r of rows) {
      if (r.orders > 0) c.ordered++
      else c.none++
      if (r.providers.includes('MyAnimeList')) c.mal++
      if (r.providers.includes('Google')) c.google++
      if (now - Date.parse(r.signedUpAt) < WEEK) c.new++
    }
    return c
  }, [rows, now])
  const spent = useMemo(() => rows.reduce((a, r) => a + r.spent, 0), [rows])

  const shown = useMemo(() => {
    switch (filter) {
      case 'ordered':
        return rows.filter((r) => r.orders > 0)
      case 'none':
        return rows.filter((r) => r.orders === 0)
      case 'mal':
        return rows.filter((r) => r.providers.includes('MyAnimeList'))
      case 'google':
        return rows.filter((r) => r.providers.includes('Google'))
      case 'new':
        return rows.filter((r) => now - Date.parse(r.signedUpAt) < WEEK)
      default:
        return rows
    }
  }, [rows, filter, now])

  const exportCsv = () => {
    if (!shown.length) return void toast('Nothing to export in this view.')
    const csv = toCsv(
      shown.map((r) => ({
        name: r.name ?? '',
        email: r.email ?? '',
        phone: r.phone ?? '',
        login: r.providers.join(' + '),
        myanimelist: r.malUsername ?? '',
        signed_up: r.signedUpAt,
        last_seen: r.lastSeenAt ?? '',
        orders: r.orders,
        total_spent_inr: r.spent,
        product_views: r.views,
      })),
    )
    downloadText(`customers-${filter}-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    toast.success(`Exported ${shown.length} customer${shown.length === 1 ? '' : 's'}.`)
  }

  const columns: DataTableColumn<CustomerRow>[] = [
    {
      id: 'who',
      header: 'Customer',
      sortValue: (r) => (r.name ?? r.email ?? r.malUsername ?? '').toLowerCase(),
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center overflow-hidden border-2 border-ink bg-volt font-display text-[16px] text-ink">
            {r.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- third-party avatar
              <img src={r.avatarUrl} alt="" width={36} height={36} referrerPolicy="no-referrer" className="size-full object-cover" />
            ) : (
              (r.name ?? r.email ?? r.malUsername ?? '?')[0]?.toUpperCase()
            )}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-bold">{r.name || r.malUsername || r.email?.split('@')[0] || 'Unnamed'}</span>
            <span className="block truncate text-[12.5px] text-paper/60">{r.email ?? (r.malUsername ? `MAL · ${r.malUsername}` : '—')}</span>
          </span>
        </span>
      ),
    },
    {
      id: 'login',
      header: 'Login',
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {r.providers.map((p) => (
            <span key={p} className={adminPill(PROVIDER_TONE[p])}>
              {p === 'MyAnimeList' ? 'MAL' : p}
            </span>
          ))}
        </span>
      ),
      sortValue: (r) => r.providers.join(','),
    },
    { id: 'joined', header: 'Signed up', sortValue: (r) => r.signedUpAt, cell: (r) => fmtDate(r.signedUpAt), hideOnMobile: true },
    { id: 'seen', header: 'Last seen', sortValue: (r) => r.lastSeenAt ?? '', cell: (r) => ago(r.lastSeenAt, now) },
    { id: 'orders', header: 'Orders', align: 'right', sortValue: (r) => r.orders, cell: (r) => <span className="font-mono">{r.orders}</span> },
    { id: 'spent', header: 'Spent', align: 'right', sortValue: (r) => r.spent, cell: (r) => <span className="font-mono">{r.spent ? formatINR(r.spent) : '—'}</span> },
    { id: 'views', header: 'Views', align: 'right', sortValue: (r) => r.views, cell: (r) => <span className="font-mono">{r.views}</span>, hideOnMobile: true },
  ]

  const open = rows.find((r) => r.id === openId) ?? null

  return (
    <AdminPage
      no="06"
      title={
        <>
          Your <em>customers</em>
        </>
      }
      jp="顧客"
      kicker="Inbox"
      description="Everyone who made an account on the shop — how they log in, what they ordered, when they were last here. Team members are not listed."
      actions={
        <>
          <span className="label text-[10px] text-paper/60" aria-live="polite">
            {demo ? 'Demo mode' : `Updated ${new Date(data.loadedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`}
          </span>
          <button type="button" onClick={() => refresh()} disabled={refreshing || demo} className={adminBtn({ variant: 'ghost', size: 'sm' })}>
            {refreshing ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <RefreshCw aria-hidden className="size-4" />} Refresh
          </button>
          <button type="button" onClick={exportCsv} disabled={!rows.length} className={adminBtn({ variant: 'primary', size: 'sm' })}>
            <Download aria-hidden className="size-4" /> Export CSV
          </button>
        </>
      }
    >
      {demo ? (
        <EmptyState title="Connect Supabase to see customers" body="Customer accounts live in Supabase. Once it’s connected (and 0005_customers.sql is applied), real sign-ups show up here — never sample data." sfx="シーン…" />
      ) : data.error ? (
        <ErrorState title="Couldn’t open the customer file" message={data.error} onRetry={() => refresh()} retrying={refreshing} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Customers" value={counts.all} jp="顧客" tone="volt" index={0} icon={<UsersRound className="size-5" />} />
            <StatCard label="New this week" value={counts.new} jp="新規" tone="lav" index={1} />
            <StatCard label="Have ordered" value={counts.ordered} jp="購入" tone="pink" index={2} hint={counts.all ? `${Math.round((counts.ordered / counts.all) * 100)}% of accounts` : undefined} />
            <StatCard label="MAL linked" value={counts.mal} jp="MAL" tone="door" index={3} icon={<Sparkles className="size-5" />} />
            <StatCard label="Spent by accounts" value={spent} format="inr" jp="売上" tone="ink" index={4} hint="non-cancelled orders" />
          </div>
          {data.notes.length > 0 && (
            <p className="border-2 border-volt/60 px-3 py-2 text-[13px] text-paper/80">{data.notes.join(' ')}</p>
          )}
          <AdminPanel title="All accounts" jp="一覧" index={1}>
            <DataTable
              caption="Customers"
              rows={shown}
              columns={columns}
              rowKey={(r) => r.id}
              search={{ placeholder: 'Search name, email, phone, MAL…', text: (r) => [r.name, r.email, r.phone, r.malUsername].filter(Boolean).join(' ') }}
              toolbar={
                <Chips<Filter>
                  label="Filter customers"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { id: 'all', label: 'All', count: counts.all },
                    { id: 'new', label: 'New 7d', count: counts.new },
                    { id: 'ordered', label: 'Ordered', count: counts.ordered },
                    { id: 'none', label: 'No orders', count: counts.none },
                    { id: 'google', label: 'Google', count: counts.google },
                    { id: 'mal', label: 'MAL', count: counts.mal },
                  ]}
                />
              }
              onRowClick={(r) => setOpenId(r.id)}
              selectedKey={openId}
              initialSort={{ id: 'joined', dir: 'desc' }}
              empty={<EmptyState title={rows.length ? 'Nobody in this filter' : 'No customers yet'} body={rows.length ? 'Try another filter.' : 'When shoppers log in with Google, MyAnimeList or email, they appear here.'} compact />}
            />
          </AdminPanel>
        </>
      )}
      <CustomerDrawer row={open} onClose={() => setOpenId(null)} now={now} />
    </AdminPage>
  )
}

function CustomerDrawer({ row, onClose, now }: { row: CustomerRow | null; onClose: () => void; now: number }) {
  const [detail, setDetail] = useState<{ id: string; data: CustomerDetail } | { id: string; error: string } | null>(null)
  const id = row?.id ?? null

  useEffect(() => {
    if (!id) return
    let alive = true
    void getCustomerDetail(id).then((r) => {
      if (!alive) return
      setDetail(r.ok ? { id, data: r.data } : { id, error: r.error })
    })
    return () => {
      alive = false
    }
  }, [id])

  const cur = detail && detail.id === id ? detail : null
  return (
    <Drawer open={!!row} onClose={onClose} title={row ? row.name || row.malUsername || row.email || 'Customer' : 'Customer'} jp="顧客カード" wide>
      {row && (
        <div className="space-y-7 text-paper">
          <section aria-label="Contact" className="grid gap-3 sm:grid-cols-2">
            <Info k="Email" v={row.email ?? 'No email (MyAnimeList login)'} />
            <Info k="Phone" v={row.phone ?? '—'} />
            <Info k="Login" v={row.providers.join(' + ')} />
            <Info k="MyAnimeList" v={row.malUsername ?? 'Not linked'} />
            <Info k="Signed up" v={fmtDate(row.signedUpAt)} />
            <Info k="Last seen" v={ago(row.lastSeenAt, now)} />
            <Info k="Orders" v={`${row.orders} · ${row.spent ? formatINR(row.spent) : '₹0'}`} />
            <Info k="Product views" v={String(row.views)} />
          </section>

          {!cur ? (
            <div className="space-y-3" aria-hidden="true">
              <div className="skeleton-tone h-6 w-40" />
              <div className="skeleton-tone h-24" />
              <div className="skeleton-tone h-24" />
            </div>
          ) : 'error' in cur ? (
            <ErrorState message={cur.error} />
          ) : (
            <>
              {cur.data.notes.length > 0 && <p className="text-[13px] text-paper/70">{cur.data.notes.join(' ')}</p>}
              <Block title="Addresses" count={cur.data.addresses.length} empty="No saved addresses.">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {cur.data.addresses.map((a) => (
                    <li key={a.id} className="border-2 border-paper/20 p-3 text-[14px]">
                      <p className="font-bold">
                        {a.label} {a.isDefault && <span className={adminPill('volt')}>Default</span>}
                      </p>
                      {a.lines.map((l) => (
                        <p key={l} className="text-paper/80">
                          {l}
                        </p>
                      ))}
                      {a.phone && <p className="mt-1 font-mono text-[13px] text-paper/70">{a.phone}</p>}
                    </li>
                  ))}
                </ul>
              </Block>
              <Block title="Orders" count={cur.data.orders.length} empty="No orders yet.">
                <ul className="divide-y-2 divide-paper/10">
                  {cur.data.orders.map((o) => {
                    const m = statusMeta(o.status)
                    return (
                      <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[14px]">
                        <span className="font-mono font-bold">{o.ref}</span>
                        <span className={cn('border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase', m.tone)}>{m.label}</span>
                        <span className="text-paper/70">{fmtDate(o.createdAt)}</span>
                        <span className="text-paper/70">{o.items.reduce((n, l) => n + (l.qty ?? 1), 0)} items</span>
                        <span className="ml-auto font-mono">{o.totals.payable ? formatINR(o.totals.payable) : 'Quote'}</span>
                      </li>
                    )
                  })}
                </ul>
                <Link href="/admin/orders" className="label mt-2 inline-flex min-h-10 items-center gap-1 text-[11px] text-volt underline">
                  Open orders board <ExternalLink aria-hidden className="size-3.5" />
                </Link>
              </Block>
              <Block title="Recently viewed" count={cur.data.views.length} empty="No product views recorded.">
                <ul className="flex flex-wrap gap-2">
                  {cur.data.views.map((v) => (
                    <li key={v.slug}>
                      <Link href={`/product/${v.slug}`} target="_blank" className="inline-flex min-h-9 items-center gap-1.5 border-2 border-paper/25 px-2.5 text-[13px] hover:border-volt hover:text-volt">
                        {v.name}
                        {v.count > 1 && <span className="font-mono text-[11px] text-paper/60">×{v.count}</span>}
                        <span className="text-[11px] text-paper/50">{ago(v.viewedAt, now)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Block>
              <Block title="MyAnimeList" count={cur.data.mal ? cur.data.mal.top.length : 0} empty="Not linked.">
                {cur.data.mal && (
                  <>
                    <p className="text-[13px] text-paper/70">
                      {cur.data.mal.username} · synced {ago(cur.data.mal.syncedAt, now)}
                      {cur.data.mal.stats ? ` · ${cur.data.mal.stats.total} on list · ${cur.data.mal.stats.completed} completed · mean ${cur.data.mal.stats.meanScore ?? '—'}` : ''}
                    </p>
                    <ol className="mt-2 grid gap-1 sm:grid-cols-2">
                      {cur.data.mal.top.map((a, i) => (
                        <li key={a.id} className="text-[14px]">
                          <span className="font-mono text-paper/50">{String(i + 1).padStart(2, '0')}</span>{' '}
                          <a href={malAnimeUrl(a.id)} target="_blank" rel="noopener noreferrer" className="underline decoration-paper/30 underline-offset-2 hover:text-volt">
                            {a.en || a.title}
                          </a>
                          <span className="text-paper/50">
                            {a.status === 'watching' ? ' · watching' : ''}
                            {a.score ? ` · ★${a.score}` : ''}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </Block>
            </>
          )}
        </div>
      )}
    </Drawer>
  )
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-2 border-paper/15 px-3 py-2">
      <p className="label text-[10px] text-paper/50">{k}</p>
      <p className="mt-0.5 break-words text-[14.5px]">{v}</p>
    </div>
  )
}

function Block({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 flex items-baseline gap-2 font-display text-[22px] uppercase leading-none">
        {title} <span className="font-mono text-[13px] text-paper/50">{count}</span>
      </h3>
      {count ? children : <p className="text-[14px] text-paper/60">{empty}</p>}
    </section>
  )
}

export default CustomersManager
