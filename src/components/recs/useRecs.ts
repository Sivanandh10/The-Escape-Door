'use client'
// useRecs — fetches GET /api/recs for one surface with the visitor's own signals (owner: RECS).
//   const r = useRecs('shop', { limit: 8, enabled })   → { status, items, personal, retry }
// Signals: localStorage views + searches (src/lib/recs/signals.ts), cart + wishlist (zustand), and — server side —
// the signed-in shopper's DB rows. Refetches when the cart/wishlist changes or a new view/search is recorded.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useCart, useHydrated, useWishlist } from '@/lib/cart'
import { recsQuery, SIGNALS_EVENT, hasLocalSignals } from '@/lib/recs/signals'
import type { RecReason, RecsContext } from '@/lib/recs/engine'
import type { Product } from '@/lib/types'

export interface RecItem {
  product: Product
  reason: RecReason
  score: number
}

export type RecsState =
  | { status: 'idle' | 'loading' | 'error'; items: RecItem[]; personal: boolean }
  | { status: 'ready'; items: RecItem[]; personal: boolean }

function subscribeSignals(cb: () => void) {
  window.addEventListener(SIGNALS_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(SIGNALS_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** Bumps whenever a view/search is recorded (this tab or another). Server snapshot = 0. */
let version = 0
const bumpVersion = () => { version++ }
if (typeof window !== 'undefined') {
  window.addEventListener(SIGNALS_EVENT, bumpVersion)
  window.addEventListener('storage', bumpVersion)
}
export function useSignalsVersion(): number {
  return useSyncExternalStore(subscribeSignals, () => version, () => 0)
}

/** true once hydrated and the visitor has any local signal (views, searches, cart, wishlist). */
export function useHasSignals(): boolean {
  const hydrated = useHydrated()
  const cartN = useCart((s) => s.items.length)
  const wishN = useWishlist((s) => s.ids.length)
  const v = useSignalsVersion()
  return useMemo(() => {
    void v
    return hydrated && (cartN > 0 || wishN > 0 || (typeof window !== 'undefined' && hasLocalSignals()))
  }, [hydrated, cartN, wishN, v])
}

export function useRecs(context: RecsContext, opts: { slug?: string | null; limit?: number; enabled?: boolean; exclude?: string[] } = {}) {
  const { slug = null, limit = 8, enabled = true } = opts
  const hydrated = useHydrated()
  const cart = useCart((s) => s.items.map((i) => i.slug || i.productId).join(','))
  const wish = useWishlist((s) => s.ids.join(','))
  const v = useSignalsVersion()
  const exclude = (opts.exclude ?? []).join(',')
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState<RecsState>({ status: 'idle', items: [], personal: false })

  // the product page records its own view on mount — don't refetch for that, only for real changes
  const query = useMemo(() => {
    void v
    if (!hydrated || typeof window === 'undefined') return null
    return recsQuery({
      context,
      slug,
      limit,
      cart: cart ? cart.split(',') : [],
      wish: wish ? wish.split(',') : [],
      exclude: exclude ? exclude.split(',') : [],
    })
  }, [hydrated, context, slug, limit, cart, wish, exclude, v])

  useEffect(() => {
    if (!enabled || !query) return
    const ctrl = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state for the fetch this effect starts
    setState((s) => (s.status === 'ready' ? s : { ...s, status: 'loading' }))
    fetch(`/api/recs?${query}`, { signal: ctrl.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { items?: RecItem[]; personal?: boolean }) =>
        setState({ status: 'ready', items: Array.isArray(j.items) ? j.items : [], personal: !!j.personal }),
      )
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name !== 'AbortError') setState((s) => ({ ...s, status: s.items.length ? 'ready' : 'error' }) as RecsState)
      })
    return () => ctrl.abort()
  }, [enabled, query, nonce])

  const retry = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, retry }
}
