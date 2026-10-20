'use client'
// Checkout — browser side. Owner: CHECKOUT.
// - cartLines(): the only cart data that travels (slug, variant, size, qty) — prices are re-done on the server
// - checkoutNonce(): idempotency key per checkout attempt (sessionStorage; survives a reload / double click)
// - validateVoucher() / placeOrder(): POST /api/vouchers/validate · POST /api/orders
// - openPendingTab(): opens a tab inside the click, points it at WhatsApp once the order is saved
// - useAddresses(): the customer's saved addresses under RLS (own rows only)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { CartItem } from '@/lib/types'
import { addressFromRow, addressInputSchema, addressToRow, type Address, type AddressInput, type CheckoutLine, type GiftOptions } from './schema'
import type { OrderSnapshot } from './types'

// ---------------------------------------------------------------- cart → request
export function cartLines(items: CartItem[]): CheckoutLine[] {
  return items.map((i) => ({
    slug: i.slug,
    variantId: i.variantId,
    ...(i.size ? { size: i.size } : {}),
    qty: Math.max(1, Math.min(99, Math.floor(i.qty))),
    ...(i.custom ? { custom: true } : {}),
  }))
}

/** Stable signature of what's being bought (a different cart = a new order = a new nonce). */
export function cartSignature(items: CartItem[]): string {
  return items
    .map((i) => `${i.slug}|${i.variantId}|${i.size ?? ''}|${i.qty}`)
    .sort()
    .join(',')
}

const NONCE_KEY = 'ted-checkout-nonce-v1'

function randomId(): string {
  const c: Crypto = globalThis.crypto
  if (typeof c.randomUUID === 'function') return c.randomUUID().replace(/-/g, '')
  const b = new Uint8Array(16)
  c.getRandomValues(b)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

/** Same cart (+ same address / gift / voucher choice) → same nonce, so a retry can't create a 2nd order. */
export function checkoutNonce(signature: string): string {
  try {
    const raw = sessionStorage.getItem(NONCE_KEY)
    const saved = raw ? (JSON.parse(raw) as { sig: string; nonce: string }) : null
    if (saved?.sig === signature && saved.nonce) return saved.nonce
    const nonce = randomId()
    sessionStorage.setItem(NONCE_KEY, JSON.stringify({ sig: signature, nonce }))
    return nonce
  } catch {
    return randomId()
  }
}

export function resetCheckoutNonce(): void {
  try {
    sessionStorage.removeItem(NONCE_KEY)
  } catch {
    /* private mode */
  }
}

// ---------------------------------------------------------------- API
export type ApiFail = { ok: false; error: string; message: string; problem?: string; slug?: string; fieldErrors?: Record<string, string[]> }

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T | ApiFail> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    })
    const data = (await res.json().catch(() => null)) as (T & { ok?: boolean }) | ApiFail | null
    if (!data) return { ok: false, error: 'server', message: 'Something went wrong — try again.' }
    return data as T | ApiFail
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') return { ok: false, error: 'aborted', message: '' }
    return { ok: false, error: 'network', message: 'You seem to be offline. Check your connection and try again.' }
  }
}

export interface VoucherOk {
  ok: true
  code: string
  discount: number
  headline: string
  description: string
  appliesToType: string | null
}

export function validateVoucher(code: string, items: CartItem[], signal?: AbortSignal) {
  return post<VoucherOk>('/api/vouchers/validate', { code, items: cartLines(items) }, signal)
}

export interface PlaceOrderOk {
  ok: true
  replay: boolean
  order: OrderSnapshot
  message: string
}

export interface PlaceOrderInput {
  nonce: string
  items: CartItem[]
  addressId: string
  gift: GiftOptions
  voucherCode?: string | null
  note?: string
  source?: Record<string, string | undefined>
}

export function placeOrder(input: PlaceOrderInput) {
  return post<PlaceOrderOk>('/api/orders', {
    nonce: input.nonce,
    items: cartLines(input.items),
    addressId: input.addressId,
    gift: input.gift,
    ...(input.voucherCode ? { voucherCode: input.voucherCode } : {}),
    note: input.note ?? '',
    ...(input.source ? { source: input.source } : {}),
  })
}

// ---------------------------------------------------------------- WhatsApp tab
const PENDING_HTML =
  '<!doctype html><title>Opening WhatsApp…</title><body style="margin:0;display:grid;place-items:center;height:100vh;background:#0b0b0f;color:#f4efe6;font:600 16px system-ui,sans-serif"><p>Saving your order… opening WhatsApp</p></body>'

/** Open a tab NOW (inside the click), send it to WhatsApp after the order is saved, or close it on failure. */
export function openPendingTab() {
  let win: Window | null = null
  try {
    win = window.open('', '_blank')
    if (win) {
      win.opener = null
      win.document.write(PENDING_HTML)
      win.document.close()
    }
  } catch {
    win = null
  }
  return {
    /** true when a tab is open and waiting */
    get open() {
      return !!win && !win.closed
    },
    go(link: string): boolean {
      if (win && !win.closed) {
        try {
          win.location.href = link
          return true
        } catch {
          /* fall through */
        }
      }
      return false
    },
    close() {
      try {
        win?.close()
      } catch {
        /* ignore */
      }
    },
  }
}

// ---------------------------------------------------------------- addresses (RLS: own rows)
export type AddressStatus = 'loading' | 'ready' | 'error' | 'offline'

function errText(e: unknown): string {
  const m = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : ''
  if (/up to 20 addresses/i.test(m)) return 'You can save up to 20 addresses — delete an old one first.'
  if (/JWT|auth|permission|row-level/i.test(m)) return 'Your login expired — log in again to save addresses.'
  return 'We couldn’t save that. Check your connection and try again.'
}

export interface AddressBookApi {
  status: AddressStatus
  addresses: Address[]
  error: string | null
  reload: () => void
  /** returns the saved address, or null (toast explains) */
  add: (input: AddressInput) => Promise<Address | null>
  update: (id: string, input: AddressInput) => Promise<Address | null>
  /** optimistic remove with a 6 s Undo toast; the delete is sent after the window */
  remove: (id: string) => void
  setDefault: (id: string) => Promise<boolean>
}

const sortAddresses = (xs: Address[]) =>
  [...xs].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || (b.createdAt || '').localeCompare(a.createdAt || ''))

export function useAddresses(initial?: Address[] | null): AddressBookApi {
  const [addresses, setAddresses] = useState<Address[]>(initial ?? [])
  const [status, setStatus] = useState<AddressStatus>(initial ? 'ready' : 'loading')
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(initial ? 0 : 1)
  const listRef = useRef(addresses)
  // eslint-disable-next-line react-hooks/refs -- latest list for optimistic rollback, read only in callbacks
  listRef.current = addresses
  const pendingDeletes = useRef(new Map<string, { timer: number; commit: () => Promise<void> }>())

  useEffect(() => {
    if (!nonce) return
    const sb = supabaseBrowser()
    if (!sb) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no backend configured
      setStatus('offline')
      return
    }
    let alive = true
    setStatus('loading')
    ;(async () => {
      const { data: u } = await sb.auth.getUser()
      if (!u.user) {
        if (alive) {
          setAddresses([])
          setStatus('ready')
        }
        return
      }
      const { data, error: e } = await sb
        .from('addresses')
        .select('*')
        .eq('user_id', u.user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
      if (!alive) return
      if (e) {
        setError(errText(e))
        setStatus('error')
        return
      }
      setAddresses(sortAddresses((data as Record<string, unknown>[]).map(addressFromRow)))
      setError(null)
      setStatus('ready')
    })()
    return () => {
      alive = false
    }
  }, [nonce])

  // leaving the page inside the undo window still deletes (the customer asked for it)
  useEffect(() => {
    const pending = pendingDeletes.current
    const flush = () => {
      for (const p of [...pending.values()]) {
        window.clearTimeout(p.timer)
        void p.commit()
      }
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const write = useCallback(async (id: string | null, input: AddressInput): Promise<Address | null> => {
    const sb = supabaseBrowser()
    if (!sb) {
      toast.error('Addresses can’t be saved right now', { description: 'The shop backend is offline.' })
      return null
    }
    const parsed = addressInputSchema.safeParse(input)
    if (!parsed.success) return null
    const row = addressToRow(parsed.data)
    // the very first address becomes the default
    if (!id && !listRef.current.length) row.is_default = true
    const q = id ? sb.from('addresses').update(row).eq('id', id).select().single() : sb.from('addresses').insert(row).select().single()
    const { data, error: e } = await q
    if (e || !data) {
      toast.error('Address not saved', { description: errText(e) })
      return null
    }
    const saved = addressFromRow(data as Record<string, unknown>)
    setAddresses((xs) => {
      const rest = xs.filter((x) => x.id !== saved.id).map((x) => (saved.isDefault ? { ...x, isDefault: false } : x))
      return sortAddresses([saved, ...rest])
    })
    return saved
  }, [])

  const add = useCallback((input: AddressInput) => write(null, input), [write])
  const update = useCallback((id: string, input: AddressInput) => write(id, input), [write])

  const setDefault = useCallback(async (id: string): Promise<boolean> => {
    const sb = supabaseBrowser()
    if (!sb) return false
    const before = listRef.current
    setAddresses((xs) => sortAddresses(xs.map((x) => ({ ...x, isDefault: x.id === id }))))
    const { error: e } = await sb.from('addresses').update({ is_default: true }).eq('id', id)
    if (e) {
      setAddresses(before)
      toast.error('Default not changed', { description: errText(e) })
      return false
    }
    return true
  }, [])

  const remove = useCallback((id: string) => {
    const item = listRef.current.find((x) => x.id === id)
    if (!item) return
    const index = listRef.current.findIndex((x) => x.id === id)
    setAddresses((xs) => xs.filter((x) => x.id !== id))
    const commit = async () => {
      pendingDeletes.current.delete(id)
      const sb = supabaseBrowser()
      if (!sb) return
      const { error: e } = await sb.from('addresses').delete().eq('id', id)
      if (e) {
        setAddresses((xs) => {
          const next = xs.slice()
          next.splice(Math.min(index, next.length), 0, item)
          return next
        })
        toast.error('Address not deleted', { description: errText(e) })
      }
    }
    const timer = window.setTimeout(() => void commit(), 6000)
    pendingDeletes.current.set(id, { timer, commit })
    toast(`Removed: ${item.name}, ${item.city}`, {
      description: 'Address deleted.',
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: () => {
          window.clearTimeout(pendingDeletes.current.get(id)?.timer)
          pendingDeletes.current.delete(id)
          setAddresses((xs) => {
            if (xs.some((x) => x.id === id)) return xs
            const next = xs.slice()
            next.splice(Math.min(index, next.length), 0, item)
            return next
          })
        },
      },
    })
  }, [])

  return useMemo(
    () => ({ status, addresses, error, reload, add, update, remove, setDefault }),
    [status, addresses, error, reload, add, update, remove, setDefault],
  )
}
