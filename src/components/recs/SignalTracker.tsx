'use client'
// <SignalTracker/> — records the session trail for recommendations (owner: RECS). Mounted once in Providers inside
// <Suspense> (it reads usePathname/useSearchParams). Renders nothing.
//   /arc/[collection]            → 'collection'         /shop/[category]       → 'type'
//   /shop?q=…  (header search + shop search box, read from the URL — debounced so typing is one event)
//   /shop?collection=… / ?cat=…  → 'collection' / 'type'
//   cart adds (useCart lastAdded) → 'cart' (product slug)  ·  wishlist ♥ added → 'wishlist' (product id)
// Signed in: new events are flushed to the account (POST /api/auth/me/sync {flush:true}) a few seconds later, so
// "Picked for you" learns during the visit too. Signed out: they wait in localStorage until the login sync.
import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCart, useWishlist } from '@/lib/cart'
import { useCustomer } from '@/lib/auth/customer'
import { pushSignalSearch, pushTrail, readTrail, SIGNALS_EVENT, syncTrail } from '@/lib/recs/signals'

const SEG = /^[a-z0-9-]{1,120}$/
const FLUSH_MS = 4000

export function SignalTracker() {
  const pathname = usePathname()
  const sp = useSearchParams()
  const q = pathname === '/shop' ? (sp.get('q') ?? '').trim() : ''
  const arcParam = pathname === '/shop' ? sp.get('collection') ?? sp.get('arc') ?? '' : ''
  const catParam = pathname === '/shop' ? sp.get('cat') ?? sp.get('category') ?? '' : ''
  const { customer } = useCustomer()
  const signedIn = !!customer

  // page visits: arcs + shop categories
  useEffect(() => {
    const m = /^\/(arc|shop)\/([^/?#]+)\/?$/.exec(pathname)
    if (!m) return
    const seg = decodeURIComponent(m[2]).toLowerCase()
    if (!SEG.test(seg)) return
    pushTrail(m[1] === 'arc' ? 'collection' : 'type', seg)
  }, [pathname])

  // shop filters picked through the URL
  useEffect(() => {
    for (const a of arcParam.split(',')) if (SEG.test(a)) pushTrail('collection', a)
    for (const c of catParam.split(',')) if (SEG.test(c)) pushTrail('type', c)
  }, [arcParam, catParam])

  // searches: settle for a moment so "n" → "na" → "naruto" is one event
  useEffect(() => {
    if (q.length < 2) return
    const t = window.setTimeout(() => pushSignalSearch(q), 900)
    return () => window.clearTimeout(t)
  }, [q])

  // cart adds + wishlist saves (subscriptions — no re-renders)
  useEffect(() => {
    const unCart = useCart.subscribe((s, prev) => {
      const la = s.lastAdded
      if (!la || la.nonce === prev.lastAdded?.nonce) return
      const item = s.items.find((i) => i.key === la.key)
      if (item?.slug) pushTrail('cart', item.slug)
    })
    let ready = useWishlist.persist.hasHydrated()
    const unHyd = useWishlist.persist.onFinishHydration(() => {
      ready = true
    })
    const unWish = useWishlist.subscribe((s, prev) => {
      // the first rehydration from localStorage is not a new save
      if (!ready || !useWishlist.persist.hasHydrated()) return
      for (const id of s.ids) if (!prev.ids.includes(id)) pushTrail('wishlist', id)
    })
    return () => {
      unCart()
      unWish()
      unHyd()
    }
  }, [])

  // signed in → flush new events to the account shortly after they happen
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!signedIn) return
    const schedule = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        if (readTrail().length) void syncTrail({ flush: true })
      }, FLUSH_MS)
    }
    // leftovers from an earlier visit (e.g. the tab closed before a flush)
    schedule()
    window.addEventListener(SIGNALS_EVENT, schedule)
    const onHide = () => {
      if (document.visibilityState === 'hidden' && readTrail().length) void syncTrail({ flush: true })
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.clearTimeout(timer.current)
      window.removeEventListener(SIGNALS_EVENT, schedule)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [signedIn])

  return null
}

export default SignalTracker
