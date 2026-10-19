'use client'
// P4b — Orders: WhatsApp-order leads promoted to orders. Status stepper (new → confirmed → paid → shipped →
// delivered / cancelled), quick "Mark paid" / "Mark shipped", items + totals drawer, promote-from-lead strip.
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Banknote, MessageCircle, PackagePlus, Truck } from 'lucide-react'
import { formatINR } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { AdminPage, AdminPanel } from '../AdminPage'
import { ConfirmShred } from '../ConfirmShred'
import { DataTable, type DataTableColumn } from '../DataTable'
import { EmptyState } from '../EmptyState'
import { StatCard } from '../StatCard'
import { adminBtn, adminPill } from '../ui'
import { useCrud, type Crud } from './data'
import { ORDER_STATUSES, leadCfg, orderCfg, orderFromLead, type AdminLead, type AdminOrder, type OrderStatus } from './entities'
import { Chips, Drawer, SandboxSwitch, StateSwitch } from './kit'
import { OrderLines } from './LeadsManager'
import { fmtDate, waFor } from './util'

const meta = (s: OrderStatus) => ORDER_STATUSES.find((x) => x.id === s) ?? ORDER_STATUSES[0]
const ref = (o: AdminOrder) => `#${o.id.replace(/^demo-order-/, 'D').replace(/-/g, '').slice(0, 6).toUpperCase()}`
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string; icon: typeof Banknote }>> = {
  new: { to: 'confirmed', label: 'Confirm', icon: ArrowRight },
  confirmed: { to: 'paid', label: 'Mark paid', icon: Banknote },
  paid: { to: 'shipped', label: 'Mark shipped', icon: Truck },
  shipped: { to: 'delivered', label: 'Delivered', icon: ArrowRight },
}

export function OrdersManager({ initialOrders, initialLeads }: { initialOrders: AdminOrder[]; initialLeads: AdminLead[] }) {
  const crud = useCrud(orderCfg, initialOrders)
  const leads = useCrud(leadCfg, initialLeads)
  const [filter, setFilter] = useState<'all' | OrderStatus>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const open = crud.rows.find((o) => o.id === openId) ?? null
  const rows = useMemo(() => (filter === 'all' ? crud.rows : crud.rows.filter((o) => o.status === filter)), [crud.rows, filter])
  const promotedLeadIds = useMemo(() => new Set(crud.rows.map((o) => o.leadId).filter(Boolean)), [crud.rows])
  const waiting = useMemo(
    () => leads.rows.filter((l) => l.kind === 'whatsapp_order' && l.status !== 'spam' && l.status !== 'closed' && !promotedLeadIds.has(l.id)),
    [leads.rows, promotedLeadIds],
  )

  const stats = useMemo(() => {
    const live = crud.rows.filter((o) => o.status !== 'cancelled')
    const sum = (xs: AdminOrder[]) => xs.reduce((a, o) => a + (o.total ?? 0), 0)
    return {
      open: crud.rows.filter((o) => o.status === 'new' || o.status === 'confirmed').length,
      toShip: crud.rows.filter((o) => o.status === 'paid').length,
      paid: sum(live.filter((o) => ['paid', 'shipped', 'delivered'].includes(o.status))),
      pipeline: sum(live.filter((o) => o.status === 'new' || o.status === 'confirmed')),
    }
  }, [crud.rows])

  const setStatus = (o: AdminOrder, status: OrderStatus) =>
    crud.update(o.id, (x) => ({ ...x, status }), { success: `${ref(o)} → ${meta(status).label}` })

  const promote = async (l: AdminLead) => {
    const order = orderFromLead(l, typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `o-${Date.now()}`)
    const ok = await crud.save(order, { quiet: true })
    if (!ok) return
    toast.success(`Order ${ref(order)} created`, { description: `${l.name || 'Customer'} · ${order.total != null ? formatINR(order.total) : 'price on request'}` })
    void leads.update(l.id, (x) => ({ ...x, status: 'converted' }), { quiet: true })
  }

  const columns: DataTableColumn<AdminOrder>[] = [
    {
      id: 'ref', header: 'Order', sortValue: (o) => o.createdAt,
      cell: (o) => (
        <span className="block leading-tight">
          <span className="font-mono text-[13px] font-bold text-volt">{ref(o)}</span>
          <span className="block font-mono text-[11px] text-paper/45">{fmtDate(o.createdAt)}</span>
        </span>
      ),
    },
    {
      id: 'who', header: 'Customer', sortValue: (o) => o.name,
      cell: (o) => (
        <span className="block min-w-0 leading-tight">
          <span className="block truncate font-semibold">{o.name || '—'}</span>
          <span className="block truncate text-[12.5px] text-paper/55">{[o.city, o.src && `src: ${o.src}`].filter(Boolean).join(' · ')}</span>
        </span>
      ),
    },
    { id: 'items', header: 'Items', hideOnMobile: true, sortValue: (o) => o.items.reduce((a, i) => a + i.qty, 0), cell: (o) => <span className="font-mono text-[13px]">{o.items.reduce((a, i) => a + i.qty, 0)} pcs</span> },
    { id: 'total', header: 'Total', align: 'right', sortValue: (o) => o.total ?? -1, cell: (o) => <span className="font-mono text-[14px] font-bold tabular-nums">{o.total != null ? formatINR(o.total) : '—'}</span> },
    { id: 'status', header: 'Status', sortValue: (o) => ORDER_STATUSES.findIndex((s) => s.id === o.status), cell: (o) => <span className={adminPill('muted', cn(meta(o.status).tone, 'border-ink'))}>{meta(o.status).label}</span> },
  ]

  return (
    <AdminPage
      no="05"
      kicker={`Orders · ${stats.open} open`}
      title={<>Order <em>desk</em></>}
      jp="注文 · 入金 · 発送"
      description="WhatsApp orders you've promoted from leads. Confirm on chat, mark paid when the UPI lands, mark shipped when it leaves."
      actions={<SandboxSwitch mode={crud.mode} />}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard index={0} label="Open orders" jp="未処理" value={stats.open} tone="volt" />
        <StatCard index={1} label="Paid, to ship" jp="発送待ち" value={stats.toShip} tone="lav" />
        <StatCard index={2} label="Paid revenue" jp="売上" value={stats.paid} format="inr" tone="door" hint="paid + shipped + delivered" />
        <StatCard index={3} label="In pipeline" jp="見込み" value={stats.pipeline} format="inr" tone="ink" hint="new + confirmed totals" />
      </div>

      {waiting.length > 0 && (
        <AdminPanel index={1} title={<>Waiting to be <em className="accent">promoted</em></>} jp="WhatsApp注文 → 注文" shadow="volt" bodyClassName="p-0">
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
                  <button type="button" onClick={() => promote(l)} className={adminBtn({ size: 'sm', className: 'min-h-10' })}>
                    <PackagePlus aria-hidden className="size-4" /> Promote
                  </button>
                </li>
              )
            })}
          </ul>
          {waiting.length > 6 && <p className="border-t-2 border-paper/10 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-paper/45">+{waiting.length - 6} more in Leads</p>}
        </AdminPanel>
      )}

      <StateSwitch status={crud.status} error={crud.error} onRetry={crud.reload}>
        <DataTable
          caption="Orders"
          rows={rows}
          columns={columns}
          rowKey={(o) => o.id}
          onRowClick={(o) => setOpenId(o.id)}
          selectedKey={openId}
          initialSort={{ id: 'ref', dir: 'desc' }}
          search={{ placeholder: 'Search name, city, product…', text: (o) => `${o.name} ${o.city} ${o.contact} ${o.src} ${o.items.map((i) => i.name).join(' ')}` }}
          toolbar={
            <Chips
              label="Status"
              value={filter}
              onChange={setFilter}
              options={[{ id: 'all' as const, label: 'All', count: crud.rows.length }, ...ORDER_STATUSES.map((s) => ({ id: s.id, label: s.label, count: crud.rows.filter((o) => o.status === s.id).length }))]}
            />
          }
          rowActions={(o) => {
            const n = NEXT[o.status]
            return (
              <span className="flex items-center gap-1">
                {n && (
                  <button type="button" onClick={() => setStatus(o, n.to)} className={adminBtn({ variant: 'ghost', size: 'sm', className: 'min-h-10' })}>
                    <n.icon aria-hidden className="size-3.5" /> {n.label}
                  </button>
                )}
                <ConfirmShred {...crud.shredProps(o.id)} />
              </span>
            )
          }}
          empty={
            <EmptyState
              title={crud.rows.length ? 'No orders in this state' : 'No orders yet'}
              body={crud.rows.length ? 'Try another status filter.' : 'Promote a WhatsApp-order lead once the customer confirms on chat — it becomes an order here.'}
            />
          }
        />
      </StateSwitch>

      <OrderDrawer order={open} crud={crud} onClose={() => setOpenId(null)} onStatus={setStatus} />
    </AdminPage>
  )
}

function OrderDrawer({ order: o, crud, onClose, onStatus }: { order: AdminOrder | null; crud: Crud<AdminOrder>; onClose: () => void; onStatus: (o: AdminOrder, s: OrderStatus) => void }) {
  const wa = o ? waFor(o.contact) : null
  const n = o ? NEXT[o.status] : undefined
  return (
    <Drawer
      open={!!o}
      onClose={onClose}
      title={o ? `Order ${ref(o)}` : 'Order'}
      jp={o ? `${fmtDate(o.createdAt)} · ${meta(o.status).jp}` : undefined}
      footer={
        o && (
          <>
            {n && (
              <button type="button" onClick={() => onStatus(o, n.to)} className={adminBtn()}>
                <n.icon aria-hidden className="size-4" /> {n.label}
              </button>
            )}
            {o.status !== 'cancelled' && o.status !== 'delivered' && (
              <button type="button" onClick={() => onStatus(o, 'cancelled')} className={adminBtn({ variant: 'ghost' })}>Cancel order</button>
            )}
            <span className="ml-auto" />
            <ConfirmShred {...crud.shredProps(o.id, onClose)} variant="button" label="Delete" />
          </>
        )
      }
    >
      {o && (
        <div className="space-y-7">
          <section aria-label="Status">
            <p className="label mb-2 text-paper/55">Status</p>
            <ol className="flex flex-wrap gap-1.5">
              {ORDER_STATUSES.map((s) => {
                const on = o.status === s.id
                return (
                  <li key={s.id}>
                    <button type="button" aria-pressed={on} onClick={() => onStatus(o, s.id)} className={cn('min-h-11 border-2 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-[translate,box-shadow] duration-150 focus-ring active:translate-y-px', on ? cn(s.tone, 'border-ink shadow-[3px_3px_0_var(--color-paper)]') : 'border-paper/20 text-paper/65 can-hover:hover:border-paper/60')}>
                      {s.label}
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
          <section className="border-2 border-ink bg-paper p-4 text-ink shadow-[5px_5px_0_var(--color-door)]">
            <dl className="grid grid-cols-[90px_1fr] gap-y-1.5 text-[14px]">
              <dt className="label pt-0.5 text-ink/50">Name</dt><dd className="font-semibold">{o.name || '—'}</dd>
              <dt className="label pt-0.5 text-ink/50">City</dt><dd>{o.city || '—'}</dd>
              <dt className="label pt-0.5 text-ink/50">Contact</dt><dd className="break-all font-mono text-[13px]">{o.contact || '—'}</dd>
              <dt className="label pt-0.5 text-ink/50">Source</dt><dd className="font-mono text-[12.5px]">{o.src || '(direct)'}</dd>
            </dl>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(adminBtn({ variant: 'door', size: 'sm' }), 'mt-3 min-h-10')}><MessageCircle aria-hidden className="size-4" /> WhatsApp</a>}
          </section>
          {o.note && (
            <section>
              <p className="label mb-2 text-paper/55">Customer note</p>
              <blockquote className="border-l-4 border-volt pl-4 text-[15px] leading-relaxed text-paper/85">{o.note}</blockquote>
            </section>
          )}
          <section>
            <p className="label mb-2 text-paper/55">Items</p>
            {o.items.length ? <OrderLines items={o.items} totals={o.totals} /> : <p className="text-paper/55">No line items stored with this order.</p>}
            {!o.totals && o.total != null && <p className="mt-2 text-right font-mono text-[15px] font-bold">Total {formatINR(o.total)}</p>}
          </section>
        </div>
      )}
    </Drawer>
  )
}
