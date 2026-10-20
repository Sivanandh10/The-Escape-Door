'use client'
// /checkout-success — #71 success moment: the order slip prints (#70), the stamp slams, confetti
// once (palette colours, never under reduced motion), Kado cheers. Reads the hand-off from
// sessionStorage; with ?order=<id> (checkout orders) and no hand-off in this tab, it loads that order from the
// database under RLS (customers read only their own orders) — nothing personal is rendered on the server.
// Owner: CHECKOUT (was P2).
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ExternalLink, Gift, MapPin, Package, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Mascot } from '@/components/brand/Mascot'
import { useCart } from '@/lib/cart'
import { formatINR, formatINRRange, parseRange } from '@/lib/pricing'
import { prefersReducedMotion } from '@/lib/motion'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase/client'
import { waLink } from '@/lib/whatsapp'
import { useWhatsappNumber } from '@/components/SiteSettingsProvider'
import { buildCheckoutMessage } from '@/lib/checkout/message'
import { addressLines, formatPhone } from '@/lib/checkout/schema'
import { orderSnapshotFromRow, statusMeta } from '@/lib/checkout/types'
import { detailBits, patchLastOrder, readLastOrder, restoreOrder, type LastOrder } from './order'
import s from './receipt.module.css'

const PALETTE = ['#FFE14D', '#C9B8FF', '#FFB8DE', '#6D3BFF', '#F4EFE6']

export function SuccessView() {
  const params = useSearchParams()
  const orderId = params.get('order')
  const waNumber = useWhatsappNumber()
  const [order, setOrder] = useState<LastOrder | null | undefined>(undefined)
  const [sent, setSent] = useState(false)
  const [restored, setRestored] = useState(false)
  const [quick, setQuick] = useState(false)
  const stampRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const o = readLastOrder()
    const mine = o && (!orderId || o.order?.id === orderId) ? o : null
    if (mine || !orderId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is client-only
      setOrder(mine)
      if (!mine) return
      setSent(mine.opened)
      if (!mine.cleared) {
        useCart.getState().clear()
        patchLastOrder({ cleared: true })
      }
      return
    }
    // reopened later / another tab: load the order (RLS: own orders only)
    let alive = true
    ;(async () => {
      const sb = supabaseBrowser()
      const { data } = sb && /^[0-9a-f-]{36}$/i.test(orderId) ? await sb.from('orders').select('*').eq('id', orderId).maybeSingle() : { data: null }
      if (!alive) return
      if (!data) return setOrder(null)
      const snap = orderSnapshotFromRow(data as Record<string, unknown>)
      setSent(true)
      setOrder({
        ref: snap.ref,
        items: snap.items,
        totals: {
          subtotal: snap.totals.subtotal,
          savings: snap.totals.savings,
          total: snap.totals.payable,
          hasPriceOnRequest: snap.totals.hasPriceOnRequest,
          applied: snap.totals.applied,
          lines: snap.items.map((l) => ({ key: l.key, lineTotal: l.lineTotal ?? null, saving: l.saving ?? 0 })),
        },
        name: snap.address?.name ?? '',
        city: snap.address?.city ?? '',
        link: waLink(buildCheckoutMessage(snap), waNumber),
        at: Date.parse(snap.createdAt) || 0,
        opened: true,
        celebrated: true,
        cleared: true,
        order: snap,
      })
    })()
    return () => {
      alive = false
    }
  }, [orderId, waNumber])

  const celebrate = (delay: number) => {
    if (prefersReducedMotion()) return
    const t = window.setTimeout(async () => {
      const { default: confetti } = await import('canvas-confetti')
      const r = stampRef.current?.getBoundingClientRect()
      const origin = r
        ? { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }
        : { x: 0.7, y: 0.4 }
      confetti({ particleCount: 90, spread: 75, startVelocity: 42, origin, colors: PALETTE, shapes: ['square'], scalar: 1.1, disableForReducedMotion: true, zIndex: 150 })
      confetti({ particleCount: 40, spread: 120, startVelocity: 28, origin, colors: PALETTE, shapes: ['circle'], scalar: 0.8, disableForReducedMotion: true, zIndex: 150 })
    }, delay)
    return () => window.clearTimeout(t)
  }

  // once per order, only when WhatsApp actually opened
  useEffect(() => {
    if (!order || !order.opened || order.celebrated) return
    patchLastOrder({ celebrated: true })
    return celebrate(2300)
  }, [order])

  if (order === undefined) {
    return (
      <div className="container-x section-y" aria-busy="true">
        <span className="sr-only">Loading your order…</span>
        <div className="skeleton-tone h-[60vh] w-full max-w-md" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container-x section-y grid items-center gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="label text-[11px] text-volt">Order desk · 注文</p>
          <h1 className="h-display mt-4 text-[clamp(56px,10vw,140px)]">
            Nothing to <em>print</em>
          </h1>
          <p className="mt-5 max-w-[46ch] text-tone-4">
            Your order slip shows up here right after you send an order on WhatsApp. Fill your cart first — the door&rsquo;s open.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/shop" className="press inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-volt px-5 font-mono text-[13px] font-bold uppercase tracking-[0.14em] text-ink shadow-hard-paper">
              Shop the drop <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href="/cart" className="press inline-flex min-h-12 items-center border-[3px] border-paper px-5 font-mono text-[12px] font-bold uppercase tracking-[0.14em]">
              View cart
            </Link>
          </div>
        </div>
        <div className="flex justify-center lg:col-span-5">
          <Mascot mood="peek" size={220} animate title="" />
        </div>
      </div>
    )
  }

  const sendNow = () => {
    track('whatsapp_click', { where: 'success-fallback', opened: sent })
    if (!sent) {
      setQuick(true)
      setSent(true)
      patchLastOrder({ opened: true, celebrated: true })
      celebrate(250)
    }
  }

  const putBack = () => {
    restoreOrder(order.items)
    setRestored(true)
    toast.success('Back in your cart', {
      description: 'Edit it and send the order again whenever you like.',
      action: { label: 'Open cart', onClick: () => useCart.getState().setOpen(true) },
    })
  }

  const when = new Date(order.at)
  const stamp = when.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const byKey = new Map(order.totals.lines.map((l) => [l.key, l]))
  const priced = order.items.filter((i) => i.unitPrice != null)
  const quoted = order.items.filter((i) => i.unitPrice == null)
  const pieces = order.items.reduce((n, i) => n + i.qty, 0)
  const snap = order.order ?? null
  const status = snap ? statusMeta(snap.status) : null

  return (
    <div className="container-x relative pb-24 pt-10 md:pt-16">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        {/* ── message ───────────────────────────────── */}
        <div className="lg:col-span-6 lg:pt-6">
          <p className="label text-[11px] text-volt">
            Order desk · {sent ? '送信完了' : 'あと一歩'}
          </p>
          <h1 className="h-display mt-4 text-[clamp(64px,11vw,156px)]">
            {sent ? (
              <>
                Order <em>sent</em>!
              </>
            ) : (
              <>
                Almost <em>there</em>
              </>
            )}
          </h1>
          <p className="mt-5 max-w-[48ch] text-[17px] text-tone-4">
            {sent ? (
              <>
                WhatsApp opened in a new tab with your order typed out{order.name ? `, ${order.name.split(' ')[0]}` : ''}. Hit <strong className="text-paper">send</strong> there and we&rsquo;ll pick it up in the chat.
              </>
            ) : (
              <>Your browser blocked the WhatsApp tab. Your order is saved — tap the button below to open WhatsApp with it typed out.</>
            )}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href={order.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={sendNow}
              className={cn(
                'press inline-flex min-h-14 items-center justify-center gap-2 border-[3px] px-5 font-mono font-bold uppercase tracking-[0.12em]',
                sent ? 'border-paper text-[12px] text-paper' : 'border-ink bg-volt text-[13px] text-ink shadow-hard-paper',
              )}
            >
              {sent ? "Didn't open WhatsApp? Tap here" : 'Open WhatsApp with my order'}
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
            <Link
              href="/shop"
              className={cn(
                'press inline-flex min-h-14 items-center justify-center gap-2 border-[3px] px-5 font-mono text-[13px] font-bold uppercase tracking-[0.12em]',
                sent ? 'border-ink bg-volt text-ink shadow-hard-paper' : 'border-paper text-paper',
              )}
            >
              Continue shopping <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>

          {snap && (
            <div className="mt-8 flex flex-wrap items-center gap-3 border-[3px] border-paper/80 p-3">
              <Package aria-hidden="true" className="size-6 shrink-0 text-volt" />
              <p className="min-w-0 flex-1 text-[14px] leading-snug">
                <span className="font-mono font-bold text-volt">{snap.ref}</span> is saved
                {status ? <> · <span className="font-semibold">{status.label}</span></> : null}. {status?.customer}
              </p>
              <Link href="/account" className="press inline-flex min-h-11 items-center gap-1.5 border-2 border-paper px-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
                Track in my account <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            </div>
          )}

          <ol className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ['01', 'Send the message', 'Your order is already typed in WhatsApp.'],
              ['02', 'We confirm in chat', 'Stock, sizes, the final price — and quotes for any price-on-request pieces.'],
              ['03', 'Pay & receive', 'Payment and delivery are agreed with you in the same chat.'],
            ].map(([n, t, d]) => (
              <li key={n} className="border-[3px] border-paper/80 p-3">
                <span className="font-mono text-[11px] text-volt">{n}</span>
                <p className="mt-1 font-bold leading-tight">{t}</p>
                <p className="mt-1 text-[13px] leading-snug text-tone-4">{d}</p>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={putBack}
            disabled={restored}
            className="label mt-8 inline-flex min-h-11 items-center gap-2 text-[11px] text-tone-4 underline decoration-2 underline-offset-4 disabled:no-underline disabled:opacity-60 can-hover:enabled:hover:text-paper"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            {restored ? 'Items are back in your cart' : 'Need to change something? Put these back in my cart'}
          </button>
        </div>

        {/* ── the order slip ────────────────────────── */}
        <div className="relative lg:col-span-6">
          <div className="relative mx-auto max-w-[460px]">
            <Mascot mood="cheer" size={120} animate title="" className="absolute -left-6 -top-16 z-20 hidden sm:block lg:-left-24 lg:top-20" />
            {/* printer */}
            <div className={cn('relative z-10 border-[3px] border-paper bg-tone-1 px-4 pb-4 pt-3 shadow-hard-door', s.slot)}>
              <div className="flex items-center justify-between">
                <span className="label text-[10px] text-tone-4">The Escape Door · order desk</span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-tone-4">
                  <span className={cn('block size-2 rounded-full', sent ? 'bg-volt' : 'bg-lav')} /> {sent ? 'PRINTED' : 'READY'}
                </span>
              </div>
              <div className="mt-3 h-2.5 border-2 border-paper bg-ink" />
            </div>
            {/* receipt */}
            <div className="relative mx-4 -mt-1.5">
              <div className={cn(!order.celebrated && s.print)}>
                <div className={cn('relative bg-paper px-5 pt-6 text-ink grain', s.paper)} role="region" aria-label="Order summary">
                  <p className="text-center font-display text-[30px] uppercase leading-none">Order slip</p>
                  <p lang="ja" className="jp-sub mt-1 text-center text-[11px]">注文票</p>
                  <div className="mt-4 flex justify-between border-y-2 border-dashed border-ink/50 py-2 font-mono text-[11.5px]">
                    <span>REF {order.ref ?? '—'}</span>
                    <span>{stamp}</span>
                  </div>
                  <p className="mt-2 font-mono text-[11.5px] text-tone-2">
                    {[order.name, order.city, `${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`].filter(Boolean).join(' · ')}
                  </p>

                  <ul className="mt-3 flex flex-col gap-2 font-mono text-[12.5px]">
                    {priced.map((i) => {
                      const l = byKey.get(i.key)
                      const bits = detailBits(i)
                      return (
                        <li key={i.key} className="flex gap-2">
                          <span className="w-7 shrink-0">{i.qty}×</span>
                          <span className="min-w-0 flex-1">
                            <span className="block leading-snug">{i.name}</span>
                            {bits.length > 0 && <span className="block text-[11px] text-tone-3">{bits.join(' · ')}</span>}
                          </span>
                          <span className="shrink-0 text-right">
                            {l && l.saving > 0 && <s className="block text-[11px] text-tone-3">{formatINR((i.unitPrice as number) * i.qty)}</s>}
                            {formatINR(l?.lineTotal ?? (i.unitPrice as number) * i.qty)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                  {quoted.length > 0 && (
                    <>
                      <p className="label mt-4 text-[10px] text-tone-3">Price on request</p>
                      <ul className="mt-1.5 flex flex-col gap-1.5 font-mono text-[12.5px]">
                        {quoted.map((i) => {
                          const r = parseRange(i.variantAttrs?.range)
                          return (
                            <li key={i.key} className="flex gap-2">
                              <span className="w-7 shrink-0">{i.qty}×</span>
                              <span className="min-w-0 flex-1 leading-snug">{i.name}</span>
                              <span className="shrink-0 text-right text-tone-2">{r ? formatINRRange(r[0], r[1]) : 'quote'}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  )}

                  <dl className="mt-4 border-t-2 border-dashed border-ink/50 pt-2 font-mono text-[12.5px]">
                    {order.totals.applied.map((a) => (
                      <div key={a.ruleId} className="flex justify-between">
                        <dt>{a.label}</dt>
                        <dd>−{formatINR(a.saving)}</dd>
                      </div>
                    ))}
                    {snap && snap.totals.discount > 0 && (
                      <div className="flex justify-between">
                        <dt>Voucher {snap.totals.voucher?.code ?? snap.voucherCode ?? ''}</dt>
                        <dd>−{formatINR(snap.totals.discount)}</dd>
                      </div>
                    )}
                    {snap && snap.totals.giftFee > 0 && (
                      <div className="flex justify-between">
                        <dt>Gift wrap</dt>
                        <dd>{formatINR(snap.totals.giftFee)}</dd>
                      </div>
                    )}
                    {(priced.length > 0 || (snap?.totals.giftFee ?? 0) > 0) && (
                      <div className="mt-2 flex items-end justify-between border-t-[3px] border-ink pt-2">
                        <dt className="label text-[11px]">{snap ? 'Total to pay' : 'Total'}</dt>
                        <dd className="font-display text-[34px] leading-none">{formatINR(order.totals.total)}</dd>
                      </div>
                    )}
                    {order.totals.hasPriceOnRequest && <p className="mt-1 text-right text-[11px] text-tone-2">+ quoted items</p>}
                  </dl>
                  {snap?.address && (
                    <div className="mt-4 border-t-2 border-dashed border-ink/50 pt-2 text-[12.5px] leading-snug">
                      <p className="label flex items-center gap-1.5 text-[10px] text-tone-3">
                        <MapPin aria-hidden="true" className="size-3" /> Deliver to
                      </p>
                      <p className="mt-1 font-semibold">{snap.address.name} · <span className="font-mono">{formatPhone(snap.address.phone)}</span></p>
                      {addressLines(snap.address).map((l) => (
                        <p key={l}>{l}</p>
                      ))}
                    </div>
                  )}
                  {snap?.gift?.enabled && (
                    <div className="mt-3 border-2 border-ink bg-pink/60 p-2 text-[12.5px] leading-snug">
                      <p className="label flex items-center gap-1.5 text-[10px]">
                        <Gift aria-hidden="true" className="size-3" /> Packed as a gift
                      </p>
                      {snap.gift.receiverName && <p className="mt-1">For {snap.gift.receiverName}</p>}
                      {snap.gift.note && <p className="italic">“{snap.gift.note}”</p>}
                      {snap.gift.hidePrices && <p>Prices hidden on the slip</p>}
                    </div>
                  )}
                  {/* decorative barcode from the ref */}
                  <div aria-hidden="true" className="mt-5 flex h-10 items-stretch justify-center gap-[2px]">
                    {Array.from((order.ref ?? 'TED').repeat(4)).map((ch, i) => (
                      <span key={i} className="bg-ink" style={{ width: (ch.charCodeAt(0) % 3) + 1 }} />
                    ))}
                  </div>
                  <p className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-[0.2em] text-tone-3">No payment taken on site</p>
                </div>
              </div>
              {/* stamp */}
              <div
                ref={stampRef}
                key={sent ? 'sent' : 'ready'}
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute right-2 top-[38%] border-[5px] px-3 py-1 text-center font-sfx text-[44px] uppercase leading-none tracking-wider mix-blend-multiply',
                  sent ? 'border-door text-door' : 'border-tone-3 text-tone-3',
                  quick || order.celebrated ? s.stampIdle : s.stamp,
                )}
              >
                {sent ? 'Sent!' : 'Ready'}
                <span lang="ja" className="block font-sfx-jp text-[13px] tracking-[0.3em]">{sent ? '送信' : '待機'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
