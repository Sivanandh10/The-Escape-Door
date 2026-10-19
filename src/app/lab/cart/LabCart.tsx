'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useCart, useHydrated, useWishlist } from '@/lib/cart'
import { computeTotals } from '@/lib/pricing'
import { buildOrderMessage, waLink } from '@/lib/whatsapp'
import type { CartItem } from '@/lib/types'
import { CHECKOUT_EVENT, saveLastOrder } from '@/components/shop/cart/order'

export function LabCart({ sets, wish }: { sets: Record<string, CartItem[]>; wish: string[] }) {
  const hydrated = useHydrated()
  const router = useRouter()
  const [msg, setMsg] = useState('')

  const seed = (name: string) => useCart.setState({ items: sets[name] ?? [] })
  const seedWish = () => useWishlist.setState({ ids: wish })
  const fakeOrder = (opened: boolean) => {
    const items = sets.mix
    const totals = computeTotals(items)
    const link = waLink(buildOrderMessage({ items, totals, name: 'Lab Tester', city: 'Surat', orderRef: 'TED-LAB01' }))
    saveLastOrder({
      ref: 'TED-LAB01',
      items,
      totals: { ...totals, lines: totals.lines.map((l) => ({ key: l.key, lineTotal: l.lineTotal, saving: l.saving })) },
      name: 'Lab Tester',
      city: 'Surat',
      link,
      at: Date.now(),
      opened,
      cleared: true,
    })
    router.push('/checkout-success')
  }

  useEffect(() => {
    if (!hydrated) return
    const q = new URLSearchParams(window.location.search)
    const s = q.get('seed')
    if (s) seed(s)
    if (q.get('wish')) seedWish()
    const o = q.get('order')
    if (o) return fakeOrder(o !== 'blocked')
    const open = q.get('open')
    if (open === 'details') window.dispatchEvent(new Event(CHECKOUT_EVENT))
    else if (open) useCart.getState().setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  return (
    <div className="container-x section-y">
      <h1 className="h-display text-h2">Lab · <em>Cart</em></h1>
      <div className="mt-8 flex flex-wrap gap-3">
        {Object.keys(sets).map((k) => (
          <button key={k} type="button" className="press border-[3px] border-paper px-4 py-3 font-mono text-[12px] uppercase" onClick={() => { seed(k); setMsg(`seeded ${k}`) }}>
            Seed: {k}
          </button>
        ))}
        <button type="button" className="press border-[3px] border-ink bg-volt px-4 py-3 font-mono text-[12px] uppercase text-ink" onClick={() => useCart.getState().setOpen(true)}>Open drawer</button>
        <button type="button" className="press border-[3px] border-ink bg-lav px-4 py-3 font-mono text-[12px] uppercase text-ink" onClick={() => window.dispatchEvent(new Event(CHECKOUT_EVENT))}>Open on details</button>
        <button type="button" className="press border-[3px] border-paper px-4 py-3 font-mono text-[12px] uppercase" onClick={() => { seedWish(); setMsg('wishlist seeded') }}>Seed wishlist</button>
        <button type="button" className="press border-[3px] border-paper px-4 py-3 font-mono text-[12px] uppercase" onClick={() => fakeOrder(true)}>Success (sent)</button>
        <button type="button" className="press border-[3px] border-paper px-4 py-3 font-mono text-[12px] uppercase" onClick={() => fakeOrder(false)}>Success (blocked)</button>
      </div>
      <p className="mt-4 font-mono text-[12px] text-tone-4" aria-live="polite">{msg}</p>
      <p className="mt-6 flex gap-4 font-mono text-[12px] underline"><Link href="/cart">/cart</Link><Link href="/wishlist">/wishlist</Link><Link href="/checkout-success">/checkout-success</Link></p>
    </div>
  )
}
