'use client'
// Orders (05) — the full pipeline. Owner: CHECKOUT (was P4b).
// placed → confirmed → paid → packed → shipped → delivered (or cancelled). Board (one column per stage) or table,
// order drawer with customer, delivery address (copy for the courier), gift, voucher, server-priced lines,
// totals and the status timeline (stamped by the database trigger). Realtime: new checkout orders arrive live
// (Supabase Realtime on public.orders, RLS-filtered) with a toast + a NEW badge. Hand-added orders ("Add order")
// and the promote-from-lead strip for older WhatsApp leads still work. Deletes: superadmin only.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  ArrowRight, Banknote, Copy, Gift, KanbanSquare, MapPin, MessageCircle, Package, PackagePlus, Pencil, Plus, Radio,
  Rows3, TicketPercent, Truck, UserRound,
} from 'lucide-react'
import { formatINR } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { addressLines, formatPhone, type AddressSnapshot, type GiftOptions } from '@/lib/checkout/schema'
import {
  ALL_STATUSES, CANCELLED, ORDER_PIPELINE, isOrderStatus, orderRef, orderSnapshotFromRow, pipelineIndex, statusMeta,
  type OrderLine, type OrderStatus, type OrderTotals, type TimelineEntry,
} from '@/lib/checkout/types'
import { AdminPage, AdminPanel } from '../AdminPage'
import { ConfirmShred } from '../ConfirmShred'
import { DataTable, type DataTableColumn } from '../DataTable'
import { EmptyState } from '../EmptyState'
import { StatCard } from '../StatCard'
import { adminBtn, adminPill } from '../ui'
import { READONLY_NOTE, useCan } from '../AdminContext'
import { explainReadOnly, getAdminClient, useCrud, type Crud, type CrudConfig, type Row } from './data'
import { leadCfg, orderCfg, orderFromLead, type AdminLead, type AdminOrder } from './entities'
import { Chips, Drawer, SandboxSwitch, StateSwitch } from './kit'
import { OrderEditDrawer, blankOrder } from './ManualEntry'
import { fmtDate, waFor } from './util'

// ---------------------------------------------------------------- pipeline order (orders row + checkout columns)
export type PipelineOrder = Omit<AdminOrder, 'status'> & {
  status: OrderStatus
  orderNo: number | null
  userId: string | null
  email: string
  /** placed without a login (checkout guest); stays true after it's linked to an account */
  guest: boolean
  /** who placed it (guests: typed at checkout) */
  contactPhone: string
  contactEmail: string
  address: AddressSnapshot | null
  gift: GiftOptions | null
  voucherCode: string | null
  discount: number
  giftFee: number
  timeline: TimelineEntry[]
  /** server-priced totals incl. voucher + gift (checkout orders) */
  checkout: OrderTotals | null
}

const pipelineCfg: CrudConfig<PipelineOrder> = {
  table: 'orders',
  pk: 'id',
  order: { column: 'created_at', ascending: false },
  label: (o) => `Order ${refOf(o)}`,
  fromRow: (r: Row) => {
    const base = orderCfg.fromRow(r)
    const snap = orderSnapshotFromRow(r)
    // guest orders may have no address ("I'll share it on WhatsApp") — still checkout orders (nonce / guest flag)
    const isCheckout = !!r.user_id || !!r.address || r.guest === true || (typeof r.nonce === 'string' && r.nonce !== '')
    return {
      ...base,
      status: isOrderStatus(r.status) ? r.status : 'new',
      orderNo: snap.orderNo,
      userId: typeof r.user_id === 'string' ? r.user_id : null,
      email: typeof r.email === 'string' ? r.email : '',
      guest: snap.guest,
      contactPhone: snap.contact?.phone ?? '',
      contactEmail: snap.contact?.email ?? '',
      address: snap.address,
      gift: snap.gift,
      voucherCode: snap.voucherCode,
      discount: snap.totals.discount,
      giftFee: snap.totals.giftFee,
      timeline: snap.timeline,
      checkout: isCheckout ? snap.totals : null,
    }
  },
  // only the columns the admin edits — address / gift / voucher / timeline stay as the checkout stored them
  toRow: (o) => ({ ...orderCfg.toRow(o as unknown as AdminOrder), status: o.status }),
}

/** hand-added / demo / promoted orders → pipeline shape (keeps their dates) */
const fromAdmin = (o: AdminOrder): PipelineOrder => ({
  ...o,
  status: isOrderStatus(o.status) ? o.status : 'new',
  orderNo: null, userId: null, email: '', guest: false, contactPhone: '', contactEmail: '', address: null, gift: null, voucherCode: null,
  discount: 0, giftFee: 0, timeline: [], checkout: null,
})

const refOf = (o: Pick<PipelineOrder, 'orderNo' | 'id'>) => (o.orderNo ? orderRef(o.orderNo) : `#${o.id.replace(/^demo-order-/, 'D').replace(/-/g, '').slice(0, 6).toUpperCase()}`)
const meta = (s: OrderStatus) => statusMeta(s)

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string; icon: typeof Banknote }>> = {
  new: { to: 'confirmed', label: 'Confirm', icon: ArrowRight },
  placed: { to: 'confirmed', label: 'Confirm', icon: ArrowRight },
  confirmed: { to: 'paid', label: 'Mark paid', icon: Banknote },
  paid: { to: 'packed', label: 'Mark packed', icon: Package },
  packed: { to: 'shipped', label: 'Mark shipped', icon: Truck },
  shipped: { to: 'delivered', label: 'Delivered', icon: ArrowRight },
}
const OPEN: OrderStatus[] = ['new', 'placed', 'confirmed']
const PAID: OrderStatus[] = ['paid', 'packed', 'shipped', 'delivered']
const stageOf = (s: OrderStatus): OrderStatus => (s === 'new' ? 'placed' : s)

const pieces = (o: PipelineOrder) => o.items.reduce((a, i) => a + (i.qty || 0), 0)
const ago = (iso: string, now: number) => {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const m = Math.max(0, Math.round((now - t) / 60000))
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`)
  } catch {
    toast.error('Couldn’t copy', { description: 'Select it and copy by hand.' })
  }
}

export function OrdersManager({ initialOrders, initialLeads }: { initialOrders: AdminOrder[]; initialLeads: AdminLead[] }) {
  const [initial] = useState(() => initialOrders.map(fromAdmin))
  const crud = useCrud(pipelineCfg, initial, { perm: 'orders.edit' })
  const leads = useCrud(leadCfg, initialLeads, { perm: 'leads.edit' })
  const canCustomers = useCan('customers.view')
  const [view, setView] = useState<'board' | 'table'>('board')
  const [filter, setFilter] = useState<'all' | OrderStatus>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ order: PipelineOrder; isNew: boolean } | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [live, setLive] = useState<'off' | 'connecting' | 'on'>('off')
  const [now, setNow] = useState(() => Date.now())
  const [everReady, setEverReady] = useState(crud.status === 'ready')
  if (crud.status === 'ready' && !everReady) setEverReady(true)
  const reloadTimer = useRef<number | null>(null)
  const reloadRef = useRef(crud.reload)
  // eslint-disable-next-line react-hooks/refs -- latest reload for the realtime callback
  reloadRef.current = crud.reload

  const addOrder = () => setEditing({ order: fromAdmin(blankOrder()), isNew: true })
  const open = crud.rows.find((o) => o.id === openId) ?? null

  // "12m ago" labels tick once a minute
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  // ---------------------------------------------------------------- realtime: new orders arrive live
  useEffect(() => {
    if (crud.mode !== 'live') return
    const sb = getAdminClient()
    if (!sb) return
    const later = () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current)
      reloadTimer.current = window.setTimeout(() => reloadRef.current(), 600)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- connection indicator
    setLive('connecting')
    const ch = sb
      .channel('admin-orders-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const o = pipelineCfg.fromRow(payload.new as Row)
        setFresh((s) => new Set(s).add(o.id))
        setNow(Date.now())
        toast(`New order ${refOf(o)}`, {
          description: `${o.guest ? 'Guest · ' : ''}${o.name || 'Customer'}${o.city ? ` · ${o.city}` : ''} · ${o.total != null ? formatINR(o.total) : 'price on request'} · ${pieces(o)} pcs`,
          duration: 9000,
          action: { label: 'Open', onClick: () => setOpenId(o.id) },
        })
        later()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, later)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, later)
      .subscribe((status) => setLive(status === 'SUBSCRIBED' ? 'on' : status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'off' : 'connecting'))
    return () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current)
      void sb.removeChannel(ch)
    }
  }, [crud.mode])

  const rows = useMemo(
    () => (filter === 'all' ? crud.rows : crud.rows.filter((o) => stageOf(o.status) === stageOf(filter))),
    [crud.rows, filter],
  )
  const promotedLeadIds = useMemo(() => new Set(crud.rows.map((o) => o.leadId).filter(Boolean)), [crud.rows])
  const waiting = useMemo(
    () => leads.rows.filter((l) => l.kind === 'whatsapp_order' && l.status !== 'spam' && l.status !== 'closed' && l.status !== 'converted' && !promotedLeadIds.has(l.id)),
    [leads.rows, promotedLeadIds],
  )

  const stats = useMemo(() => {
    const sum = (xs: PipelineOrder[]) => xs.reduce((a, o) => a + (o.total ?? 0), 0)
    const today = new Date(now).toDateString()
    return {
      open: crud.rows.filter((o) => OPEN.includes(o.status)).length,
      toPack: crud.rows.filter((o) => o.status === 'paid').length,
      toShip: crud.rows.filter((o) => o.status === 'packed').length,
      paid: sum(crud.rows.filter((o) => PAID.includes(o.status))),
      pipeline: sum(crud.rows.filter((o) => OPEN.includes(o.status))),
      today: crud.rows.filter((o) => new Date(o.createdAt).toDateString() === today).length,
    }
  }, [crud.rows, now])

  const setStatus = (o: PipelineOrder, status: OrderStatus) => {
    setFresh((s) => {
      if (!s.has(o.id)) return s
      const n = new Set(s)
      n.delete(o.id)
      return n
    })
    return crud.update(o.id, (x) => ({ ...x, status }), { success: `${refOf(o)} → ${meta(status).label}` })
  }

  // promoting creates an order AND marks the lead converted → needs orders.edit + leads.edit
  const promoteReadOnly = crud.readOnly || leads.readOnly
  const promote = async (l: AdminLead) => {
    if (promoteReadOnly) return explainReadOnly()
    // eslint-disable-next-line react-hooks/purity -- runs in a click handler, not during render
    const base = orderFromLead(l, typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `o-${Date.now()}`)
    const order = fromAdmin(base)
    const ok = await crud.save(order, { quiet: true })
    if (!ok) return
    toast.success(`Order ${refOf(order)} created`, { description: `${l.name || 'Customer'} · ${order.total != null ? formatINR(order.total) : 'price on request'}` })
    void leads.update(l.id, (x) => ({ ...x, status: 'converted' }), { quiet: true })
  }

  const nextButton = (o: PipelineOrder, compact = false) => {
    const n = NEXT[o.status]
    if (!n) return null
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          void setStatus(o, n.to)
        }}
        disabled={crud.readOnly}
        title={crud.readOnly ? READONLY_NOTE : `Move to ${meta(n.to).label}`}
        className={adminBtn({ variant: 'ghost', size: 'sm', className: compact ? 'min-h-10 px-2.5 text-[10.5px]' : 'min-h-10' })}
      >
        <n.icon aria-hidden className="size-3.5" /> {n.label}
      </button>
    )
  }

  const columns: DataTableColumn<PipelineOrder>[] = [
    {
      id: 'ref', header: 'Order', sortValue: (o) => o.createdAt,
      cell: (o) => (
        <span className="block leading-tight">
          <span className="flex items-center gap-1.5 font-mono text-[13px] font-bold text-volt">
            {refOf(o)}
            {fresh.has(o.id) && <span className={adminPill('hype', 'animate-pulse')}>New</span>}
          </span>
          <span className="block font-mono text-[11px] text-paper/45">{fmtDate(o.createdAt)}</span>
        </span>
      ),
    },
    {
      id: 'who', header: 'Customer', sortValue: (o) => o.name,
      cell: (o) => (
        <span className="block min-w-0 leading-tight">
          <span className="flex items-center gap-1.5 truncate font-semibold">
            {o.name || '—'}
            <GuestPill o={o} />
            {o.gift?.enabled && <Gift aria-label="Gift" className="size-3.5 shrink-0 text-pink" />}
            {o.voucherCode && <TicketPercent aria-label={`Voucher ${o.voucherCode}`} className="size-3.5 shrink-0 text-volt" />}
          </span>
          <span className="block truncate text-[12.5px] text-paper/55">{[o.city || (o.checkout && !o.address ? 'Address: on WhatsApp' : ''), o.address?.pin, o.src && `src: ${o.src}`].filter(Boolean).join(' · ')}</span>
        </span>
      ),
    },
    { id: 'items', header: 'Items', hideOnMobile: true, sortValue: pieces, cell: (o) => <span className="font-mono text-[13px]">{pieces(o)} pcs</span> },
    { id: 'total', header: 'Total', align: 'right', sortValue: (o) => o.total ?? -1, cell: (o) => <span className="font-mono text-[14px] font-bold tabular-nums">{o.total != null ? formatINR(o.total) : '—'}</span> },
    { id: 'status', header: 'Status', sortValue: (o) => (o.status === 'cancelled' ? 99 : pipelineIndex(o.status)), cell: (o) => <span className={adminPill('muted', cn(meta(o.status).tone, 'border-ink'))}>{meta(o.status).label}</span> },
  ]

  const liveDot = (
    <span className={cn(adminPill(live === 'on' ? 'volt' : 'muted'), 'inline-flex items-center gap-1.5')} title={live === 'on' ? 'New orders appear here the moment they’re placed' : 'Realtime is not connected — use Reload'}>
      <Radio aria-hidden className={cn('size-3', live === 'on' && 'animate-pulse')} /> {live === 'on' ? 'Live' : live === 'connecting' ? 'Connecting…' : 'Not live'}
    </span>
  )

  return (
    <AdminPage
      no="05"
      kicker={`Orders · ${stats.open} open · ${stats.today} today`}
      title={<>Order <em>desk</em></>}
      jp="注文 · 入金 · 梱包 · 発送"
      description="Every checkout order lands here with its address, gift and voucher. Confirm on WhatsApp, mark paid when the UPI lands, pack, ship, deliver."
      actions={<>
        {crud.mode === 'live' && liveDot}
        <SandboxSwitch mode={crud.mode} readOnly={crud.readOnly} />
        <button type="button" onClick={addOrder} disabled={crud.readOnly} title={crud.readOnly ? READONLY_NOTE : 'Stall sale, DM or phone order — add it by hand'} className={adminBtn()}>
          <Plus aria-hidden className="size-4" /> Add order
        </button>
      </>}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard index={0} label="To confirm" jp="未処理" value={stats.open} tone="volt" hint="placed + confirmed" />
        <StatCard index={1} label="Paid, to pack" jp="梱包待ち" value={stats.toPack} tone="lav" />
        <StatCard index={2} label="Packed, to ship" jp="発送待ち" value={stats.toShip} tone="pink" />
        <StatCard index={3} label="Paid revenue" jp="売上" value={stats.paid} format="inr" tone="door" hint="paid → delivered" />
        <StatCard index={4} label="In pipeline" jp="見込み" value={stats.pipeline} format="inr" tone="ink" hint="not paid yet" />
      </div>

      {waiting.length > 0 && (
        <AdminPanel index={1} title={<>Older WhatsApp orders to <em className="accent">promote</em></>} jp="WhatsApp注文 → 注文" shadow="volt" bodyClassName="p-0">
          <ul className="divide-y-2 divide-paper/10">
            {waiting.slice(0, 6).map((l) => {
              const total = (l.payload?.totals as { total?: number } | undefined)?.total
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{l.name || 'No name'} <span className="font-normal text-paper/50">· {l.city || '—'}</span></span>
                    <span className="block font-mono text-[11.5px] text-paper/45">{fmtDate(l.createdAt)}{l.src ? ` · src: ${l.src}` : ''}</span>
                  </span>
                  {typeof total === 'number' && <span className="font-mono text-[14px] font-bold">{formatINR(total)}</span>}
                  <button type="button" onClick={() => promote(l)} disabled={promoteReadOnly} title={promoteReadOnly ? READONLY_NOTE : undefined} className={adminBtn({ size: 'sm', className: 'min-h-10' })}>
                    <PackagePlus aria-hidden className="size-4" /> Promote
                  </button>
                </li>
              )
            })}
          </ul>
          {waiting.length > 6 && <p className="border-t-2 border-paper/10 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-paper/45">+{waiting.length - 6} more in Leads</p>}
        </AdminPanel>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="View" className="inline-flex border-2 border-paper/20">
          {([['board', 'Board', KanbanSquare], ['table', 'Table', Rows3]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={cn('inline-flex min-h-11 items-center gap-2 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em] focus-ring', view === id ? 'bg-volt text-ink' : 'text-paper/70 can-hover:hover:text-paper')}
            >
              <Icon aria-hidden className="size-4" /> {label}
            </button>
          ))}
        </div>
        {crud.mode === 'live' && (
          <button type="button" onClick={crud.reload} className={adminBtn({ variant: 'quiet', size: 'sm', className: 'min-h-11' })}>
            Reload
          </button>
        )}
      </div>

      {view === 'board' ? (
        everReady ? (
          <Board
            rows={crud.rows}
            fresh={fresh}
            now={now}
            onOpen={(o) => setOpenId(o.id)}
            nextButton={(o) => nextButton(o, true)}
            onShowAll={(s) => {
              setFilter(s)
              setView('table')
            }}
          />
        ) : (
          <StateSwitch status={crud.status} error={crud.error} onRetry={crud.reload} variant="cards">
            <span />
          </StateSwitch>
        )
      ) : (
        <StateSwitch status={everReady && crud.status === 'loading' ? 'ready' : crud.status} error={crud.error} onRetry={crud.reload}>
          <DataTable
            caption="Orders"
            rows={rows}
            columns={columns}
            rowKey={(o) => o.id}
            onRowClick={(o) => setOpenId(o.id)}
            selectedKey={openId}
            initialSort={{ id: 'ref', dir: 'desc' }}
            search={{ placeholder: 'Search order no., name, city, PIN, product, voucher…', text: (o) => `${refOf(o)} ${o.name} ${o.city} ${o.contact} ${o.contactPhone} ${o.email} ${o.guest ? 'guest' : ''} ${o.address?.pin ?? ''} ${o.voucherCode ?? ''} ${o.src} ${o.items.map((i) => i.name).join(' ')}` }}
            toolbar={
              <Chips
                label="Status"
                value={filter}
                onChange={setFilter}
                options={[
                  { id: 'all' as const, label: 'All', count: crud.rows.length },
                  ...ALL_STATUSES.map((s) => ({ id: s.id, label: s.label, count: crud.rows.filter((o) => stageOf(o.status) === s.id).length })),
                ]}
              />
            }
            rowActions={(o) => (
              <span className="flex items-center gap-1">
                {nextButton(o)}
                <ConfirmShred {...crud.shredProps(o.id)} />
              </span>
            )}
            empty={
              <EmptyState
                title={crud.rows.length ? 'No orders in this state' : 'No orders yet'}
                body={crud.rows.length ? 'Try another status filter.' : 'Checkout orders appear here the moment a customer places one. Stall sales and DMs can be added by hand.'}
                action={crud.rows.length || crud.readOnly ? undefined : <button type="button" onClick={addOrder} className={adminBtn()}><Plus aria-hidden className="size-4" /> Add order</button>}
              />
            }
          />
        </StateSwitch>
      )}

      <OrderDrawer
        order={open}
        crud={crud}
        canCustomers={canCustomers}
        onClose={() => setOpenId(null)}
        onStatus={setStatus}
        onEdit={() => {
          if (open) {
            setOpenId(null)
            setEditing({ order: open, isNew: false })
          }
        }}
      />
      <OrderEditDrawer
        order={(editing?.order ?? null) as unknown as AdminOrder | null}
        isNew={!!editing?.isNew}
        crud={crud as unknown as Crud<AdminOrder>}
        onClose={() => setEditing(null)}
      />
    </AdminPage>
  )
}

// ---------------------------------------------------------------- board
function Board({
  rows, fresh, now, onOpen, nextButton, onShowAll,
}: {
  rows: PipelineOrder[]
  fresh: Set<string>
  now: number
  onOpen: (o: PipelineOrder) => void
  nextButton: (o: PipelineOrder) => ReactNode
  onShowAll: (s: OrderStatus) => void
}) {
  const LIMIT = 8
  const cancelled = rows.filter((o) => o.status === 'cancelled').length
  if (!rows.length) {
    return <EmptyState title="No orders yet" body="Checkout orders appear here the moment a customer places one — this page updates live." />
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {ORDER_PIPELINE.map((s) => {
          const list = rows.filter((o) => stageOf(o.status) === s.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          const sum = list.reduce((a, o) => a + (o.total ?? 0), 0)
          return (
            <section key={s.id} aria-label={`${s.label}: ${list.length}`} className="flex min-w-0 flex-col border-2 border-paper/15 bg-[#121218]">
              <header className={cn('flex items-center justify-between gap-2 border-b-2 border-ink px-3 py-2', s.tone)}>
                <span className="font-display text-[20px] uppercase leading-none">{s.label}</span>
                <span className="font-mono text-[12px] font-bold">{list.length}{sum ? ` · ${formatINR(sum)}` : ''}</span>
              </header>
              <ul className="flex flex-1 flex-col gap-2 p-2">
                {list.length === 0 && <li className="px-1 py-3 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-paper/35">Empty · {s.jp}</li>}
                {list.slice(0, LIMIT).map((o) => (
                  <li key={o.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Open order ${refOf(o)}`}
                      onClick={() => onOpen(o)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onOpen(o)
                        }
                      }}
                      className={cn(
                        'block cursor-pointer border-2 bg-ink p-2.5 text-left transition-[translate,box-shadow] duration-150 focus-ring can-hover:hover:-translate-y-0.5 can-hover:hover:shadow-[3px_3px_0_var(--color-door)]',
                        fresh.has(o.id) ? 'border-volt shadow-[3px_3px_0_var(--color-volt)]' : 'border-paper/20',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[12.5px] font-bold text-volt">{refOf(o)}</span>
                        {fresh.has(o.id) ? <span className={adminPill('hype', 'animate-pulse')}>New</span> : <span className="font-mono text-[10.5px] text-paper/45">{ago(o.createdAt, now)}</span>}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 truncate text-[13.5px] font-semibold">
                        {o.name || '—'}
                        <GuestPill o={o} />
                        {o.gift?.enabled && <Gift aria-label="Gift" className="size-3.5 shrink-0 text-pink" />}
                        {o.voucherCode && <TicketPercent aria-label="Voucher" className="size-3.5 shrink-0 text-volt" />}
                      </span>
                      <span className="flex items-center justify-between gap-2 text-[12px] text-paper/55">
                        <span className="truncate">{[o.city, `${pieces(o)} pcs`].filter(Boolean).join(' · ')}</span>
                        <span className="shrink-0 font-mono font-bold text-paper">{o.total != null ? formatINR(o.total) : '—'}</span>
                      </span>
                      <span className="mt-2 flex justify-end">{nextButton(o)}</span>
                    </div>
                  </li>
                ))}
                {list.length > LIMIT && (
                  <li>
                    <button type="button" onClick={() => onShowAll(s.id)} className="min-h-10 w-full border-2 border-dashed border-paper/20 font-mono text-[11px] uppercase tracking-[0.12em] text-paper/60 focus-ring can-hover:hover:text-paper">
                      +{list.length - LIMIT} more
                    </button>
                  </li>
                )}
              </ul>
            </section>
          )
        })}
      </div>
      {cancelled > 0 && (
        <button type="button" onClick={() => onShowAll('cancelled')} className={adminBtn({ variant: 'quiet', size: 'sm', className: 'min-h-11' })}>
          {cancelled} cancelled — view in table
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- drawer
function OrderDrawer({
  order: o, crud, canCustomers, onClose, onStatus, onEdit,
}: {
  order: PipelineOrder | null
  crud: Crud<PipelineOrder>
  canCustomers: boolean
  onClose: () => void
  onStatus: (o: PipelineOrder, s: OrderStatus) => void
  onEdit: () => void
}) {
  // who to reply to: the person who ordered (guests typed it at checkout), else the receiver
  const phone = o?.contactPhone || o?.contact || o?.address?.phone || ''
  const wa = o ? waFor(phone) : null
  const n = o ? NEXT[o.status] : undefined
  const stage = o ? (o.status === 'cancelled' ? -1 : pipelineIndex(o.status)) : -1
  const addressText = o?.address ? [`${o.address.name} · ${formatPhone(o.address.phone)}`, ...addressLines(o.address)].join('\n') : ''

  return (
    <Drawer
      open={!!o}
      onClose={onClose}
      wide
      title={o ? `Order ${refOf(o)}` : 'Order'}
      jp={o ? `${fmtDate(o.createdAt)} · ${meta(o.status).jp}` : undefined}
      footer={
        o && (
          <>
            {n && (
              <button type="button" onClick={() => onStatus(o, n.to)} disabled={crud.readOnly} title={crud.readOnly ? READONLY_NOTE : undefined} className={adminBtn()}>
                <n.icon aria-hidden className="size-4" /> {n.label}
              </button>
            )}
            {o.status !== 'cancelled' && o.status !== 'delivered' && (
              <button type="button" onClick={() => onStatus(o, 'cancelled')} disabled={crud.readOnly} className={adminBtn({ variant: 'ghost' })}>Cancel order</button>
            )}
            <button type="button" onClick={onEdit} disabled={crud.readOnly} title={crud.readOnly ? READONLY_NOTE : 'Edit customer, lines and total'} className={adminBtn({ variant: 'ghost' })}>
              <Pencil aria-hidden className="size-4" /> Edit
            </button>
            <span className="ml-auto" />
            <ConfirmShred {...crud.shredProps(o.id, onClose)} variant="button" label="Delete" />
          </>
        )
      }
    >
      {o && (
        <div className="space-y-7">
          <section aria-label="Status">
            <p className="label mb-2 text-paper/55">Pipeline</p>
            <ol className="flex flex-wrap gap-1.5">
              {[...ORDER_PIPELINE, CANCELLED].map((s, i) => {
                const on = stageOf(o.status) === s.id
                const done = s.id !== 'cancelled' && stage >= 0 && i < stage
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={crud.readOnly}
                      onClick={() => onStatus(o, s.id)}
                      className={cn(
                        'min-h-11 border-2 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-[translate,box-shadow] duration-150 focus-ring active:translate-y-px disabled:cursor-not-allowed',
                        on ? cn(s.tone, 'border-ink shadow-[3px_3px_0_var(--color-paper)]') : done ? 'border-paper/40 text-paper line-through decoration-volt decoration-2' : 'border-paper/20 text-paper/65 can-hover:hover:border-paper/60',
                      )}
                    >
                      {s.label}
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="border-2 border-ink bg-paper p-4 text-ink shadow-[5px_5px_0_var(--color-door)]">
              <p className="label mb-2 flex items-center gap-1.5 text-ink/55">
                <UserRound aria-hidden className="size-3.5" /> Customer
                {o.guest && <span className="ml-auto border-2 border-ink bg-lav px-1.5 py-0.5 text-[9.5px] text-ink">{o.userId ? 'Guest · linked' : 'Guest'}</span>}
              </p>
              <dl className="grid grid-cols-[72px_1fr] gap-y-1.5 text-[14px]">
                <dt className="label pt-0.5 text-ink/50">Name</dt><dd className="font-semibold">{o.name || '—'}</dd>
                <dt className="label pt-0.5 text-ink/50">Phone</dt><dd className="break-all font-mono text-[13px]">{phone ? formatPhone(phone) : '—'}</dd>
                <dt className="label pt-0.5 text-ink/50">Email</dt><dd className="break-all text-[13px]">{o.contactEmail || o.email || '—'}</dd>
                {o.guest && !o.userId && (
                  <>
                    <dt className="label pt-0.5 text-ink/50">Account</dt>
                    <dd className="text-[12.5px] leading-snug text-ink/70">None yet — links itself when they log in with this email (email link or Google).</dd>
                  </>
                )}
                <dt className="label pt-0.5 text-ink/50">Source</dt><dd className="font-mono text-[12.5px]">{o.src || '(direct)'}</dd>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                {wa && (
                  <a href={`${wa}?text=${encodeURIComponent(`Hi ${o.name || ''}! About your order ${refOf(o)} from The Escape Door — `)}`} target="_blank" rel="noopener noreferrer" className={cn(adminBtn({ variant: 'door', size: 'sm' }), 'min-h-10')}>
                    <MessageCircle aria-hidden className="size-4" /> WhatsApp
                  </a>
                )}
                {o.userId && canCustomers && (
                  <a href={`/admin/customers?id=${encodeURIComponent(o.userId)}`} className={cn(adminBtn({ variant: 'quiet', size: 'sm' }), 'min-h-10')}>
                    <UserRound aria-hidden className="size-4" /> Customer profile
                  </a>
                )}
              </div>
            </section>

            <section className="border-2 border-paper/20 p-4">
              <p className="label mb-2 flex items-center gap-1.5 text-paper/55"><MapPin aria-hidden className="size-3.5" /> Deliver to{o.address?.kind ? ` · ${o.address.kind}` : ''}</p>
              {o.address ? (
                <>
                  <p className="font-semibold">{o.address.name} · <span className="font-mono text-[13px]">{formatPhone(o.address.phone)}</span></p>
                  {addressLines(o.address).map((l) => <p key={l} className="text-[14px] leading-snug text-paper/80">{l}</p>)}
                  <button type="button" onClick={() => void copyText(addressText, 'Address')} className={cn(adminBtn({ variant: 'ghost', size: 'sm' }), 'mt-3 min-h-10')}>
                    <Copy aria-hidden className="size-4" /> Copy for courier
                  </button>
                </>
              ) : (
                <p className="text-[14px] text-paper/55">{o.checkout ? <><strong className="text-volt">Address: on WhatsApp</strong> — the customer chose to share it in the chat.</> : o.city ? `City: ${o.city}` : 'No address stored (hand-added or older order).'}</p>
              )}
            </section>
          </div>

          {(o.gift?.enabled || o.voucherCode) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {o.gift?.enabled && (
                <section className="border-2 border-ink bg-pink p-4 text-ink">
                  <p className="label mb-1.5 flex items-center gap-1.5"><Gift aria-hidden className="size-3.5" /> Pack as a gift{o.giftFee ? ` · ${formatINR(o.giftFee)}` : ''}</p>
                  {(o.gift.receiverName || o.gift.receiverPhone) && <p className="text-[14px]">For <strong>{o.gift.receiverName || '—'}</strong>{o.gift.receiverPhone ? ` · ${formatPhone(o.gift.receiverPhone)}` : ''}</p>}
                  {o.gift.note && <blockquote className="mt-1 border-l-4 border-ink pl-3 text-[14px] italic">“{o.gift.note}”</blockquote>}
                  {o.gift.hidePrices && <p className="mt-1.5 font-mono text-[12px] font-bold uppercase tracking-[0.08em]">Hide prices on the slip</p>}
                </section>
              )}
              {o.voucherCode && (
                <section className="border-2 border-ink bg-volt p-4 text-ink">
                  <p className="label mb-1.5 flex items-center gap-1.5"><TicketPercent aria-hidden className="size-3.5" /> Voucher</p>
                  <p className="font-mono text-[16px] font-bold tracking-[0.08em]">{o.voucherCode}</p>
                  <p className="text-[14px]">−{formatINR(o.discount)} off this order</p>
                </section>
              )}
            </div>
          )}

          {o.note && (
            <section>
              <p className="label mb-2 text-paper/55">Customer note</p>
              <blockquote className="border-l-4 border-volt pl-4 text-[15px] leading-relaxed text-paper/85">{o.note}</blockquote>
            </section>
          )}

          <section>
            <p className="label mb-2 text-paper/55">Items · {pieces(o)} pcs</p>
            {o.items.length ? <Lines items={o.items as OrderLine[]} /> : <p className="text-paper/55">No line items stored with this order.</p>}
            <Totals o={o} />
          </section>

          {o.timeline.length > 0 && (
            <section>
              <p className="label mb-2 text-paper/55">Timeline</p>
              <ol className="relative space-y-2 border-l-2 border-paper/20 pl-4">
                {o.timeline.map((t, i) => (
                  <li key={`${t.status}-${t.at}-${i}`} className="relative text-[13.5px]">
                    <span aria-hidden className={cn('absolute -left-[23px] top-1 size-3 border-2 border-ink', meta(t.status).tone)} />
                    <span className="font-semibold">{meta(t.status).label}</span>
                    <span className="font-mono text-[12px] text-paper/50"> · {fmtDate(t.at)}{t.by ? ` · ${t.by}` : ''}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </Drawer>
  )
}

function Lines({ items }: { items: OrderLine[] }) {
  return (
    <ul className="divide-y-2 divide-paper/10 border-2 border-paper/15">
      {items.map((it, i) => {
        const gross = it.unitPrice != null ? it.unitPrice * it.qty : null
        const line = typeof it.lineTotal === 'number' ? it.lineTotal : gross
        return (
          <li key={(it.key ?? '') + i} className="flex items-center gap-3 p-3">
            <span className="grid size-10 shrink-0 place-items-center border-2 border-ink bg-volt font-mono text-[13px] font-bold text-ink">×{it.qty}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">{it.name}</span>
              <span className="block truncate font-mono text-[11px] uppercase tracking-[0.08em] text-paper/50">{[it.variantLabel, it.size && `Size ${it.size}`, it.slug].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="shrink-0 text-right font-mono text-[13px] tabular-nums">
              {line != null ? (
                <>
                  {(it.saving ?? 0) > 0 && gross != null && <s className="block text-[11px] text-paper/45">{formatINR(gross)}</s>}
                  {formatINR(line)}
                </>
              ) : (
                'On request'
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function Totals({ o }: { o: PipelineOrder }) {
  const t = o.checkout
  if (!t) {
    if (o.totals) {
      return (
        <dl className="space-y-1 border-2 border-t-4 border-ink bg-paper p-3 font-mono text-[13px] text-ink">
          <Line2 label="Subtotal" value={formatINR(o.totals.subtotal)} />
          {o.totals.savings > 0 && <Line2 label="Bundle savings" value={`−${formatINR(o.totals.savings)}`} accent />}
          <Line2 label={`Total${o.totals.hasPriceOnRequest ? ' (+ on request)' : ''}`} value={formatINR(o.total ?? o.totals.total)} strong />
        </dl>
      )
    }
    return o.total != null ? <p className="mt-2 text-right font-mono text-[15px] font-bold">Total {formatINR(o.total)}</p> : null
  }
  return (
    <dl className="space-y-1 border-2 border-t-4 border-ink bg-paper p-3 font-mono text-[13px] text-ink">
      <Line2 label="Subtotal" value={formatINR(t.subtotal)} />
      {t.applied.map((a) => <Line2 key={a.ruleId} label={a.label} value={`−${formatINR(a.saving)}`} accent />)}
      {t.discount > 0 && <Line2 label={`Voucher ${t.voucher?.code ?? o.voucherCode ?? ''}`} value={`−${formatINR(t.discount)}`} accent />}
      {t.giftFee > 0 && <Line2 label="Gift wrap" value={formatINR(t.giftFee)} />}
      <Line2 label={`Total to pay${t.hasPriceOnRequest ? ' (+ quoted items)' : ''}`} value={formatINR(o.total ?? t.payable)} strong />
    </dl>
  )
}

function Line2({ label, value, accent, strong }: { label: string; value: string; accent?: boolean; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3', strong && 'border-t-2 border-ink pt-1.5 text-[15px] font-bold', accent && 'text-door')}>
      <dt className="min-w-0 truncate">{label}</dt>
      <dd className="shrink-0 tabular-nums">{value}</dd>
    </div>
  )
}

/** "Guest" (no login) / "Guest · linked" (claimed by an account later) */
function GuestPill({ o }: { o: Pick<PipelineOrder, 'guest' | 'userId'> }) {
  if (!o.guest) return null
  return (
    <span className={adminPill('lav', 'shrink-0 px-1.5 py-0 text-[9.5px]')} title={o.userId ? 'Placed as a guest, now linked to their account' : 'Placed without an account'}>
      {o.userId ? 'Guest·linked' : 'Guest'}
    </span>
  )
}
