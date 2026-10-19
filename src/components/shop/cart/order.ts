'use client'
// Cart/checkout helpers private to P2: last-order hand-off to /checkout-success, slim lead payload,
// remove-with-undo (#69) and the drawer "jump to checkout" event.
import { toast } from 'sonner'
import { useCart } from '@/lib/cart'
import { track } from '@/lib/analytics'
import type { CartItem, CartTotals } from '@/lib/types'

export const LAST_ORDER_KEY = 'ted-last-order-v1'
/** window event other areas may dispatch to open the drawer straight on the details step. */
export const CHECKOUT_EVENT = 'ted:cart-checkout'

export interface LastOrder {
  ref?: string
  items: CartItem[]
  totals: Pick<CartTotals, 'subtotal' | 'savings' | 'total' | 'hasPriceOnRequest' | 'applied'> & {
    lines: Array<{ key: string; lineTotal: number | null; saving: number }>
  }
  name: string
  city: string
  link: string
  at: number
  /** confetti fired already for this order (once per flow) */
  celebrated?: boolean
  /** the cart was emptied after the hand-off */
  cleared?: boolean
  /** the WhatsApp tab opened (false = popup blocked → fallback link is the main action) */
  opened: boolean
}

export function saveLastOrder(o: LastOrder): void {
  try {
    sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(o))
  } catch {
    /* private mode — success page falls back to its empty state */
  }
}

export function readLastOrder(): LastOrder | null {
  try {
    const raw = sessionStorage.getItem(LAST_ORDER_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as LastOrder
    return Array.isArray(o?.items) && typeof o.link === 'string' ? o : null
  } catch {
    return null
  }
}

export function patchLastOrder(patch: Partial<LastOrder>): void {
  const o = readLastOrder()
  if (o) saveLastOrder({ ...o, ...patch })
}

/** Lead payload kept well under the 16 KB API limit (no image paths, no custom spec blobs). */
export function slimOrderPayload(items: CartItem[], totals: CartTotals) {
  return {
    items: totals.lines.map((l) => ({
      slug: l.slug,
      name: l.name,
      type: l.type,
      variant: l.variantLabel,
      ...(l.size ? { size: l.size } : {}),
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      ...(l.saving ? { saving: l.saving } : {}),
      ...(l.variantAttrs?.range ? { range: l.variantAttrs.range } : {}),
      ...(l.custom ? { custom: true } : {}),
    })),
    totals: {
      subtotal: totals.subtotal,
      savings: totals.savings,
      total: totals.total,
      hasPriceOnRequest: totals.hasPriceOnRequest,
      applied: totals.applied,
    },
    pieces: items.reduce((n, i) => n + i.qty, 0),
  }
}

/** Put a removed line back where it was (keeps the order the shopper built). */
export function restoreLine(item: CartItem, index: number): void {
  useCart.setState((s) => {
    if (s.items.some((i) => i.key === item.key)) return s
    const items = s.items.slice()
    items.splice(Math.min(index, items.length), 0, item)
    return { items }
  })
}

/** #69 — remove now, offer Undo for 5 s in a manga toast. */
export function removeWithUndo(item: CartItem): void {
  const state = useCart.getState()
  const index = state.items.findIndex((i) => i.key === item.key)
  state.remove(item.key)
  track('remove_from_cart', { slug: item.slug, qty: item.qty })
  toast(`Shredded: ${item.name}`, {
    description: 'Removed from your cart.',
    duration: 5000,
    action: { label: 'Undo', onClick: () => restoreLine(item, index) },
  })
}

/** Restore a whole order back into the cart (success page "put it back"). */
export function restoreOrder(items: CartItem[]): void {
  useCart.setState((s) => {
    const have = new Set(s.items.map((i) => i.key))
    return { items: [...s.items, ...items.filter((i) => !have.has(i.key))] }
  })
}

export function detailBits(i: Pick<CartItem, 'variantLabel' | 'size' | 'custom'>): string[] {
  const v = i.variantLabel && !/^(standard|single|single print|poster|badge|keychain|pair|cape)$/i.test(i.variantLabel) ? i.variantLabel : ''
  return [v, i.size ? `Size ${i.size}` : '', i.custom ? 'Custom' : ''].filter(Boolean)
}
