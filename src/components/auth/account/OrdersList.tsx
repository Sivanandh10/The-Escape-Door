// /account → Orders (owner: AUTH). Real rows only (CHECKOUT's getMyOrders, RLS own rows). Server component:
// each order is a <details> ticket with a status pipeline, lines, totals, address and gift note.
import Link from 'next/link'
import { formatINR } from '@/lib/pricing'
import { ORDER_PIPELINE, pipelineIndex, statusMeta, type OrderSnapshot } from '@/lib/checkout/types'
import { addressLines } from '@/lib/checkout/schema'
import { cn } from '@/lib/utils'

const date = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export function OrdersList({ orders }: { orders: OrderSnapshot[] }) {
  if (!orders.length) {
    return (
      <div className="mt-6 border-[3px] border-paper/25 p-6">
        <p className="font-display text-[28px] uppercase leading-none text-paper">No orders yet</p>
        <p className="mt-2 max-w-xl text-paper/80">When you check out, every order shows up here with its status — placed, confirmed, packed, shipped, delivered.</p>
        <Link href="/shop" className="press focus-ring mt-4 inline-flex min-h-11 items-center border-[3px] border-ink bg-volt px-4 font-display text-[18px] uppercase text-ink shadow-hard-paper">
          Find your first drop
        </Link>
      </div>
    )
  }
  return (
    <ul role="list" className="mt-6 grid gap-4">
      {orders.map((o) => {
        const meta = statusMeta(o.status)
        const step = pipelineIndex(o.status)
        const count = o.items.reduce((n, l) => n + (l.qty ?? 1), 0)
        return (
          <li key={o.id}>
            <details className="group border-4 border-ink bg-paper text-ink shadow-hard-sm open:shadow-hard-volt">
              <summary className="focus-ring flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                <span className="font-mono text-[15px] font-bold">{o.ref}</span>
                <span className={cn('label border-2 border-ink px-2 py-1 text-[10px]', meta.tone)}>{meta.label}</span>
                <span className="text-[14px] text-tone-2">
                  {date(o.createdAt)} · {count} {count === 1 ? 'item' : 'items'}
                </span>
                <span className="ml-auto font-mono text-[18px] font-bold">{o.totals.payable ? formatINR(o.totals.payable) : 'Quote pending'}</span>
                <span aria-hidden="true" className="font-display text-[22px] leading-none transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="border-t-4 border-ink p-4 sm:p-5">
                {o.status !== 'cancelled' ? (
                  <ol className="grid grid-cols-3 gap-1 sm:grid-cols-6" aria-label="Order progress">
                    {ORDER_PIPELINE.map((s, i) => (
                      <li key={s.id} aria-current={i === step ? 'step' : undefined} className={cn('border-2 border-ink px-2 py-1.5 text-center text-[11px] font-bold uppercase', i <= step ? s.tone : 'bg-paper text-tone-3')}>
                        {s.label}
                      </li>
                    ))}
                  </ol>
                ) : null}
                <p className="mt-3 text-[14px] text-tone-2">{meta.customer}</p>
                <ul className="mt-4 divide-y-2 divide-ink/10">
                  {o.items.map((l, i) => (
                    <li key={`${l.key ?? l.slug}-${i}`} className="flex items-baseline justify-between gap-3 py-2 text-[14.5px]">
                      <span className="min-w-0">
                        <Link href={`/product/${l.slug}`} className="font-bold underline decoration-2 underline-offset-2 hover:text-door">
                          {l.name}
                        </Link>
                        <span className="text-tone-3">
                          {' '}
                          · {[l.variantLabel, l.size ? `Size ${l.size}` : null, `× ${l.qty}`].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono">{l.lineTotal != null ? formatINR(l.lineTotal) : 'On request'}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 grid gap-1 border-t-[3px] border-ink pt-3 font-mono text-[14px]">
                  {o.totals.savings > 0 && <Line k="Bundle savings" v={`− ${formatINR(o.totals.savings)}`} />}
                  {o.totals.discount > 0 && <Line k={`Voucher${o.voucherCode ? ` ${o.voucherCode}` : ''}`} v={`− ${formatINR(o.totals.discount)}`} />}
                  {o.totals.giftFee > 0 && <Line k="Gift wrap" v={formatINR(o.totals.giftFee)} />}
                  <Line k="Total" v={o.totals.payable ? formatINR(o.totals.payable) : 'Quote pending'} strong />
                </dl>
                {(o.address || o.gift?.enabled) && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {o.address && (
                      <div className="border-[3px] border-ink p-3 text-[14px]">
                        <p className="label text-[10px] text-tone-3">Delivering to</p>
                        <p className="mt-1 font-bold">{o.address.name}</p>
                        {addressLines(o.address).map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </div>
                    )}
                    {o.gift?.enabled && (
                      <div className="border-[3px] border-ink bg-pink p-3 text-[14px]">
                        <p className="label text-[10px]">Gift</p>
                        {o.gift.receiverName && <p className="mt-1 font-bold">For {o.gift.receiverName}</p>}
                        {o.gift.note && <p className="mt-1 italic">“{o.gift.note}”</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </details>
          </li>
        )
      })}
    </ul>
  )
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3', strong && 'text-[16px] font-bold')}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

export default OrdersList
