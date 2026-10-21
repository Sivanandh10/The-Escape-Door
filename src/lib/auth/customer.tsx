'use client'
// Customer auth — CLIENT side (owner: AUTH). Implements the CONTRACT:
//   <CustomerProvider initial?>  (mounted once in src/components/Providers.tsx)
//   useCustomer() → { customer, loading, openLogin(reason?, then?, replay?), signOut(), refresh() }
//   useRequireLogin() → gate(reason, action, replay?) — runs `action` now when signed in, otherwise opens the login
//   modal with `reason` and runs `action` right after a successful in-page login. Google / MyAnimeList / magic-link
//   logins leave the page: pass a serialisable `replay` ({type:'cart-add', item} | {type:'wishlist', productId}) and it is
//   performed when the shopper comes back signed in.
// Supabase not configured, or no login method switched on yet (GET /api/auth/providers) → nobody can log in, so gates
// run the action directly (the shop keeps working).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'
import { supabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client'
import { useCart, useWishlist } from '@/lib/cart'
import { clearLocalViews, readLocalViews } from '@/lib/recs/local'
import type { Customer, CustomerContextValue, CustomerProviderProps, LoginReplay, RequireLogin } from './contract'
import { firstName, toCustomer } from './shared'
import { loadAuthProviders, peekAuthProviders } from './providers'

export type { Customer, LoginReplay } from './contract'

const LoginModal = dynamic(() => import('@/components/auth/LoginModal'), { ssr: false, loading: () => null })

const REPLAY_KEY = 'ted-login-replay'
const SYNC_KEY = 'ted-auth-synced'
const REPLAY_TTL = 20 * 60_000

interface Internal {
  ref: { current: Customer | null }
  ready: () => Promise<Customer | null>
  configured: boolean
}

const fallback: CustomerContextValue = {
  customer: null,
  loading: false,
  openLogin: () => {
    if (typeof window !== 'undefined') window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
  },
  signOut: () => {},
  refresh: async () => {},
}
const CustomerContext = createContext<CustomerContextValue>(fallback)
const InternalContext = createContext<Internal | null>(null)

export function useCustomer(): CustomerContextValue {
  return useContext(CustomerContext)
}

export function useRequireLogin(): RequireLogin {
  const { openLogin } = useContext(CustomerContext)
  const internal = useContext(InternalContext)
  return useCallback<RequireLogin>(
    (reason, action, replay) => {
      if (!internal || !internal.configured) return action()
      if (internal.ref.current) return action()
      // no login method works yet (Google off, MAL not configured, no email delivery) → no gate, the shop keeps working
      if (peekAuthProviders()?.any === false) return action()
      // session / provider check still running (first ~100 ms of a page): decide once both land
      void Promise.all([internal.ready(), loadAuthProviders()]).then(([c, p]) => (c || !p.any ? action() : openLogin(reason, action, replay)))
    },
    [internal, openLogin],
  )
}

// ---------------------------------------------------------------- flash + replay helpers
function readFlash(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)ted_flash=([^;]+)/)
    if (!m) return null
    document.cookie = 'ted_flash=; Max-Age=0; path=/; SameSite=Lax'
    return decodeURIComponent(m[1])
  } catch {
    return null
  }
}

export function stashReplay(reason: string | undefined, replay: LoginReplay | undefined): void {
  try {
    window.localStorage.setItem(
      REPLAY_KEY,
      JSON.stringify({ reason: reason ?? null, replay: replay ?? { type: 'none' }, path: window.location.pathname, at: Date.now() }),
    )
  } catch {
    /* storage blocked: the shopper just taps again after logging in */
  }
}
function takeReplay(): { replay: LoginReplay; path: string } | null {
  try {
    // localStorage (not session): magic links open in a new tab
    const raw = window.localStorage.getItem(REPLAY_KEY)
    if (!raw) return null
    window.localStorage.removeItem(REPLAY_KEY)
    const v = JSON.parse(raw) as { replay?: LoginReplay; path?: string; at?: number }
    if (!v?.replay || !v.at || Date.now() - v.at > REPLAY_TTL) return null
    return { replay: v.replay, path: v.path ?? '/' }
  } catch {
    return null
  }
}

function performReplay(replay: LoginReplay, go: (href: string) => void) {
  if (replay.type === 'cart-add') {
    const item = replay.item
    useCart.getState().add(item)
    if (replay.then === 'checkout') {
      // "Buy now" before a Google / MAL login → continue straight to checkout
      go('/checkout')
      return
    }
    toast.success(`Added ${item.name} to your cart`, { description: 'Picked up right where you left off.', duration: 3000 })
    window.setTimeout(() => useCart.getState().setOpen(true), 300)
  } else if (replay.type === 'wishlist') {
    const w = useWishlist.getState()
    if (!w.ids.includes(replay.productId)) w.toggle(replay.productId)
    toast.success(`Saved${replay.name ? ` “${replay.name}”` : ''} to your wishlist`, { duration: 3000 })
  }
}

const FLASH: Record<string, (c: Customer | null) => string> = {
  'signed-in': (c) => `You’re in, ${firstName(c)}. The door is open.`,
  'email-confirmed': (c) => `Email confirmed — welcome, ${firstName(c)}!`,
  'mal-linked': () => 'MyAnimeList connected — your picks just levelled up.',
  'mal-welcome': (c) => `Signed in with MyAnimeList. Welcome, ${firstName(c)}!`,
  'mal-welcome-back': (c) => `Welcome back, ${firstName(c)}.`,
}

// ---------------------------------------------------------------- provider
interface ModalState {
  reason?: string
  success: boolean
}

export function CustomerProvider({ initial, children }: CustomerProviderProps) {
  const router = useRouter()
  const configured = isSupabaseConfigured()
  const [customer, setCustomer] = useState<Customer | null>(initial ?? null)
  const [loading, setLoading] = useState<boolean>(configured && initial === undefined)
  const ref = useRef<Customer | null>(initial ?? null)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [modalMounted, setModalMounted] = useState(false)
  const modalRef = useRef<ModalState | null>(null)
  const pending = useRef<{ then?: () => void; replay?: LoginReplay } | null>(null)
  const readyWaiters = useRef<Array<(c: Customer | null) => void>>([])
  const resolved = useRef(!configured || initial !== undefined)
  const lastId = useRef<string | null>(initial?.id ?? null)
  const closeTimer = useRef<number | undefined>(undefined)
  const flash = useRef<string | null>(null)

  const setModalState = (m: ModalState | null) => {
    modalRef.current = m
    setModal(m)
  }

  const syncOnce = useCallback((user: User) => {
    try {
      if (window.sessionStorage.getItem(SYNC_KEY) === user.id) return
      window.sessionStorage.setItem(SYNC_KEY, user.id)
    } catch {
      /* no storage → sync every load (cheap, rate limited) */
    }
    const views = readLocalViews()
    void fetch('/api/auth/me/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ views }),
    })
      .then((r) => (r.ok ? clearLocalViews() : undefined))
      .catch(() => {})
  }, [])

  const commit = useCallback(
    (c: Customer | null, user?: User | null) => {
      const prevId = lastId.current
      ref.current = c
      lastId.current = c?.id ?? null
      setCustomer(c)
      setLoading(false)
      resolved.current = true
      readyWaiters.current.splice(0).forEach((fn) => fn(c))

      if (c && user) syncOnce(user)

      // one-shot flash from a server redirect (OAuth / MAL / email link)
      if (flash.current && c) {
        const msg = FLASH[flash.current]?.(c)
        flash.current = null
        if (msg) toast.success(msg, { duration: 3500 })
      }

      if (c && modalRef.current) {
        // in-page login finished: brief "you're in" moment, then close and run the pending action
        setModalState({ ...modalRef.current, success: true })
        const job = pending.current
        pending.current = null
        window.clearTimeout(closeTimer.current)
        closeTimer.current = window.setTimeout(() => {
          setModalState(null)
          try {
            job?.then?.()
          } catch {
            /* the caller's action failed — nothing for auth to do */
          }
        }, 650)
      } else if (c && !prevId) {
        // came back from a redirect login → replay the stashed intent on the same page
        const r = takeReplay()
        if (r && r.path === window.location.pathname) performReplay(r.replay, (href) => router.push(href))
      }
      if (prevId !== (c?.id ?? null) && prevId !== null) router.refresh()
    },
    [router, syncOnce],
  )

  const load = useCallback(async () => {
    const sb = supabaseBrowser()
    if (!sb) return commit(null)
    try {
      const { data } = await sb.auth.getSession()
      const user = data.session?.user ?? null
      if (!user) return commit(null)
      const [p, m] = await Promise.all([
        sb.from('profiles').select('name, phone, avatar_url').eq('id', user.id).maybeSingle(),
        sb.from('mal_accounts').select('mal_username').eq('user_id', user.id).maybeSingle(),
      ])
      commit(toCustomer(user, p.error ? null : p.data, m.error ? null : (m.data as { mal_username?: string } | null)?.mal_username), user)
    } catch {
      commit(null)
    }
  }, [commit])

  useEffect(() => {
    flash.current = readFlash()
    void loadAuthProviders() // warm: gates decide synchronously once this is known
    const sb = supabaseBrowser()
    if (!sb) {
      // no Supabase in this build → settle as signed out (deferred: no synchronous setState inside the effect)
      const t = window.setTimeout(() => commit(null), 0)
      return () => window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async: state is set after the session read resolves
    void load()
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      // never await Supabase inside this callback (it holds the auth lock) — defer
      window.setTimeout(() => {
        if (event === 'SIGNED_OUT') {
          if (ref.current) commit(null)
          return
        }
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          // SIGNED_IN also fires on tab refocus / initial restore — only a real "was signed out → now in" refreshes RSC
          if (event === 'SIGNED_IN' && session?.user?.id && session.user.id === ref.current?.id) return
          const freshLogin = event === 'SIGNED_IN' && resolved.current && !ref.current
          void load().then(() => {
            if (freshLogin) router.refresh()
          })
        }
      }, 0)
    })
    return () => {
      data.subscription.unsubscribe()
      window.clearTimeout(closeTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once
  }, [])

  const openLogin = useCallback<CustomerContextValue['openLogin']>(
    (reason, then, replay) => {
      if (!configured) {
        then?.()
        return
      }
      if (ref.current) {
        then?.()
        return
      }
      pending.current = { then, replay }
      setModalMounted(true)
      setModalState({ reason, success: false })
    },
    [configured],
  )

  // Owner rule: every shopping action except Share needs a login. Product / cart / wishlist / checkout / Design Your Own
  // links are intercepted while signed out (and a login method is live): the login pop-up opens and, once logged in,
  // the shopper continues to where they clicked. Ctrl/⌘/middle-click (new tab) and anything inside [data-share] or
  // [data-no-login] are left alone.
  useEffect(() => {
    if (!configured) return
    const GATED = /^\/(product\/|cart(\/|$)|wishlist(\/|$)|checkout(\/|$)|custom(\/|$))/
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      if (ref.current) return
      const el = e.target as Element | null
      const a = el?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      if (a.closest('[data-share],[data-no-login],[role="dialog"]')) return
      // buttons inside a card link (quick add, wishlist, share) run their own login gate / no gate
      if (el?.closest?.('button') && a.contains(el.closest('button'))) return
      let url: URL
      try {
        url = new URL(a.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin || !GATED.test(url.pathname)) return
      const p = peekAuthProviders()
      if (!p || !p.any) return // unknown yet / no login method live → don't block browsing
      e.preventDefault()
      e.stopPropagation()
      const href = url.pathname + url.search + url.hash
      const what = url.pathname.startsWith('/product/') ? 'see this product' : url.pathname.startsWith('/custom') ? 'design your own' : 'continue'
      openLogin(`Log in to ${what}`, () => router.push(href))
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [configured, openLogin, router])

  const signOut = useCallback(async () => {
    const sb = supabaseBrowser()
    try {
      window.sessionStorage.removeItem(SYNC_KEY)
    } catch {
      /* ignore */
    }
    if (sb) await sb.auth.signOut().catch(() => {})
    commit(null) // → router.refresh() (signed-in → signed-out)
    toast('Signed out. The door’s always open — come back soon.', { duration: 3000 })
  }, [commit])

  const internal = useMemo<Internal>(
    () => ({
      ref,
      configured,
      ready: () => (resolved.current ? Promise.resolve(ref.current) : new Promise((res) => readyWaiters.current.push(res))),
    }),
    [configured],
  )

  const value = useMemo<CustomerContextValue>(
    () => ({ customer, loading, openLogin, signOut, refresh: load }),
    [customer, loading, openLogin, signOut, load],
  )

  const onClose = useCallback(() => {
    pending.current = null
    setModalState(null)
  }, [])

  return (
    <CustomerContext.Provider value={value}>
      <InternalContext.Provider value={internal}>
        {children}
        {modalMounted && (
          <LoginModal
            open={!!modal}
            reason={modal?.reason}
            success={!!modal?.success}
            onClose={onClose}
            onBeforeRedirect={() => stashReplay(modal?.reason, pending.current?.replay)}
          />
        )}
      </InternalContext.Provider>
    </CustomerContext.Provider>
  )
}

export default CustomerProvider
