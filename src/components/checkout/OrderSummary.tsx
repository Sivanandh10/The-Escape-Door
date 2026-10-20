'use client'
// The order slip at checkout: lines, bundle deals, voucher, gift wrap, total to pay (animated rupees).
// Shows what the cart looks like now; the server re-prices it when the order is placed. Owner: CHECKOUT.
import type { ReactNode } from 'react'
import { formatINR, formatINRRange, parseRange } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import type { CartTotals } from '@/lib/types'
import { Rupees, Thumb } from '@/components/shop/cart/bits'
import { detailBits } from '@/components/shop/cart/order'
import type { AppliedVoucher } from './VoucherBox'

export function payableOf(totals: CartTotals, voucher: AppliedVoucher | null, giftFee: number): number {
  return Math.max(0, totals.total - (voucher?.discount ?? 0)) + giftFee
}

export interface OrderSummaryProps {
  totals: CartTotals
  voucher: AppliedVoucher | null
  giftFee: number
  /** collapse the item list (mobile sticky bar / small screens) */
  compactItems?: boolean
  className?: string
}

export function OrderSummary({ totals, voucher, giftFee, compactItems, className }: OrderSummaryProps) {
  const priced = totals.lines.some((l) => l.unitPrice != null)
  const pieces = totals.lines.reduce((n, l) => n + l.qty, 0)
  const payable = payableOf(totals, voucher, giftFee)

  return (
    <div className={cn('text-ink', className)}>
      {!compactItems && (
        <ul className="flex flex-col gap-3" aria-label={`${pieces} ${pieces === 1 ? 'piece' : 'pieces'} in this order`}>
          {totals.lines.map((l) => {
            const bits = detailBits(l)
            const r = l.unitPrice == null ? parseRange(l.variantAttrs?.range) : null
            return (
              <li key={l.key} className="flex items-center gap-3">
                <span className="relative">
                  <Thumb src={l.image} className="w-12 border-2" sizes="48px" />
                  <span className="absolute -right-2 -top-2 grid min-w-6 place-items-center border-2 border-ink bg-volt px-1 font-mono text-[11px] font-bold leading-5">{l.qty}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold leading-tight">{l.name}</span>
                  {bits.length > 0 && <span className="block truncate font-mono text-[11px] text-tone-3">{bits.join(' · ')}</span>}
                </span>
                <span className="shrink-0 text-right font-mono text-[13px]">
                  {l.unitPrice != null ? (
                    <>
                      {l.saving > 0 && <s className="block text-[11px] text-tone-3">{formatINR(l.unitPrice * l.qty)}</s>}
                      {formatINR(l.lineTotal ?? l.unitPrice * l.qty)}
                    </>
                  ) : (
                    <span className="text-tone-2">{r ? formatINRRange(r[0], r[1]) : 'Quote'}</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <dl className={cn('font-mono text-[13.5px]', !compactItems && 'mt-4 border-t-2 border-dashed border-ink/40 pt-3')}>
        {priced && (
          <Row label="Subtotal">
            <Rupees value={totals.subtotal} />
          </Row>
        )}
        {totals.applied.map((a) => (
          <Row key={a.ruleId} label={a.label} accent>
            −{formatINR(a.saving)}
          </Row>
        ))}
        {voucher && voucher.discount > 0 && (
          <Row label={`Voucher ${voucher.code}`} accent>
            −<Rupees value={voucher.discount} />
          </Row>
        )}
        {giftFee > 0 && (
          <Row label="Gift wrap">
            <Rupees value={giftFee} />
          </Row>
        )}
        <div className="mt-1 flex items-end justify-between gap-3 border-t-[3px] border-ink pt-2">
          <dt className="label text-[11px]">Total to pay</dt>
          <dd className="text-right">
            {priced || giftFee > 0 ? (
              <Rupees value={payable} className="font-display text-[38px] leading-none tracking-wide" />
            ) : (
              <span className="font-display text-[24px] uppercase leading-none">Quoted on WhatsApp</span>
            )}
            {priced && totals.hasPriceOnRequest && <span className="mt-1 block text-[11px] text-tone-2">+ price-on-request items, quoted in chat</span>}
          </dd>
        </div>
      </dl>
      {(totals.savings > 0 || (voucher?.discount ?? 0) > 0) && (
        <p className="mt-3 inline-block -rotate-1 border-2 border-ink bg-volt px-2 py-1 font-mono text-[12px] font-bold">
          You save {formatINR(totals.savings + (voucher?.discount ?? 0))} on this order
        </p>
      )}
    </div>
  )
}

function Row({ label, accent, children }: { label: string; accent?: boolean; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className="min-w-0 truncate text-tone-2">{label}</dt>
      <dd className={cn('shrink-0 tabular-nums', accent && 'font-bold text-door')}>{children}</dd>
    </div>
  )
}
