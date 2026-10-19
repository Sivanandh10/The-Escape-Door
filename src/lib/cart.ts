'use client'
// Cart + wishlist stores (zustand 5 + persist). Owner: F2.
// Hydration: both stores use skipHydration and rehydrate on first client mount (see
// useHydrated / ensureHydrated) so the server always renders an empty cart.
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { CartItem, CustomSpec } from './types'

// ---------------------------------------------------------------- storage (never throws)
const memory = new Map<string, string>()
const safeStorage: StateStorage = {
  getItem: (k) => { try { return window.localStorage.getItem(k) } catch { return memory.get(k) ?? null } },
  setItem: (k, v) => { try { window.localStorage.setItem(k, v) } catch { memory.set(k, v) } },
  removeItem: (k) => { try { window.localStorage.removeItem(k) } catch { memory.delete(k) } },
}

// ---------------------------------------------------------------- keys
/** Stable line key: same product + variant + size (+ custom spec) merges into one line. */
export function lineKey(i: Pick<CartItem, 'productId' | 'variantId' | 'size' | 'custom'>): string {
  const base = `${i.productId}|${i.variantId}|${i.size ?? ''}`
  return i.custom ? `${base}|custom:${hashSpec(i.custom)}` : base
}
function hashSpec(s: CustomSpec): string {
  const str = JSON.stringify(s)
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const MAX_QTY = 99
const clampQty = (q: number) => Math.max(1, Math.min(MAX_QTY, Math.floor(Number.isFinite(q) ? q : 1)))

// ---------------------------------------------------------------- cart
export type AddInput = Omit<CartItem, 'key' | 'qty'> & { key?: string; qty?: number }

export interface LastAdded {
  key: string
  name: string
  image: string
  qty: number
  /** increments on every add — use as a React key / effect dependency for the fly animation */
  nonce: number
  at: number
}

export interface CartState {
  items: CartItem[]
  open: boolean
  lastAdded: LastAdded | null
  add: (item: AddInput) => void
  remove: (key: string) => void
  setQty: (key: string, qty: number) => void
  clear: () => void
  setOpen: (open: boolean) => void
  /** clears lastAdded once the fly animation finished */
  clearLastAdded: () => void
}

type PersistedCart = Pick<CartState, 'items'>
const CART_VERSION = 1

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      open: false,
      lastAdded: null,
      add: (input) =>
        set((s) => {
          const qty = clampQty(input.qty ?? 1)
          const key = input.key ?? lineKey(input)
          const existing = s.items.find((i) => i.key === key)
          const items = existing
            ? s.items.map((i) => (i.key === key ? { ...i, qty: clampQty(i.qty + qty) } : i))
            : [...s.items, { ...input, key, qty } as CartItem]
          const nonce = (s.lastAdded?.nonce ?? 0) + 1
          return { items, lastAdded: { key, name: input.name, image: input.image, qty, nonce, at: Date.now() } }
        }),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      setQty: (key, qty) =>
        set((s) => ({
          items: qty <= 0 ? s.items.filter((i) => i.key !== key) : s.items.map((i) => (i.key === key ? { ...i, qty: clampQty(qty) } : i)),
        })),
      clear: () => set({ items: [], lastAdded: null }),
      setOpen: (open) => set({ open }),
      clearLastAdded: () => set({ lastAdded: null }),
    }),
    {
      name: 'ted-cart-v1',
      version: CART_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s): PersistedCart => ({ items: s.items }),
      skipHydration: true,
      migrate: (persisted, version): PersistedCart => {
        // v0 / unknown shapes: keep only well-formed lines, never crash on old data.
        const raw = (persisted as { items?: unknown })?.items
        const items = Array.isArray(raw) ? raw.filter(isCartItem) : []
        if (version > CART_VERSION) return { items: [] }
        return { items: items.map((i) => ({ ...i, qty: clampQty(i.qty) })) }
      },
      merge: (persisted, current) => {
        const raw = (persisted as { items?: unknown })?.items
        return { ...current, items: Array.isArray(raw) ? raw.filter(isCartItem) : current.items }
      },
    },
  ),
)

function isCartItem(x: unknown): x is CartItem {
  if (!x || typeof x !== 'object') return false
  const i = x as Record<string, unknown>
  return typeof i.key === 'string' && typeof i.productId === 'string' && typeof i.variantId === 'string' &&
    typeof i.name === 'string' && typeof i.qty === 'number' && (typeof i.unitPrice === 'number' || i.unitPrice === null)
}

// ---------------------------------------------------------------- wishlist
export interface WishlistState {
  ids: string[]
  toggle: (id: string) => void
  has: (id: string) => boolean
  clear: () => void
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => set((s) => ({ ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id] })),
      has: (id) => get().ids.includes(id),
      clear: () => set({ ids: [] }),
    }),
    {
      name: 'ted-wishlist-v1',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ ids: s.ids }),
      skipHydration: true,
      migrate: (persisted) => {
        const raw = (persisted as { ids?: unknown })?.ids
        return { ids: Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [] }
      },
    },
  ),
)

// ---------------------------------------------------------------- hydration
let hydrationStarted = false
/** Rehydrate both stores once (idempotent). Called by useHydrated; Providers may call it too. */
export function ensureHydrated(): void {
  if (hydrationStarted || typeof window === 'undefined') return
  hydrationStarted = true
  void useCart.persist.rehydrate()
  void useWishlist.persist.rehydrate()
}

/**
 * true once the persisted cart + wishlist have loaded on the client. Gate counts/badges on it:
 *   const hydrated = useHydrated(); const count = useCartCount(); {hydrated ? count : <Skeleton/>}
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    ensureHydrated()
    const done = () => useCart.persist.hasHydrated() && useWishlist.persist.hasHydrated()
    if (done()) { setHydrated(true); return }
    const check = () => { if (done()) setHydrated(true) }
    const unsubA = useCart.persist.onFinishHydration(check)
    const unsubB = useWishlist.persist.onFinishHydration(check)
    check()
    return () => { unsubA(); unsubB() }
  }, [])
  return hydrated
}

/** Total pieces in the cart (primitive selector — safe without useShallow). */
export const useCartCount = () => useCart((s) => s.items.reduce((n, i) => n + i.qty, 0))
