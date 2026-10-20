'use client'
// App-wide client providers. Owner: F1.
// SmoothScroll (Lenis) · Cursor (#31) · sonner Toaster (manga panels) · ArcTheme (--arc-a/--arc-b tween)
// · analytics init · cart/wishlist rehydration · lazy CartDrawer · route effects (aria-current, refresh).
// · CustomerProvider (customer login + login modal — owner: AUTH, see src/lib/auth/customer.tsx).
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { Toaster } from 'sonner'
import { MotionConfig } from 'motion/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SmoothScroll } from '@/components/motion/SmoothScroll'
import { Cursor } from '@/components/motion/Cursor'
import { prefersReducedMotion, registerGsap } from '@/lib/motion'
import { initAnalytics } from '@/lib/analytics'
import { ensureHydrated, useCart } from '@/lib/cart'
import { SiteSettingsProvider } from '@/components/SiteSettingsProvider'
import { CustomerProvider } from '@/lib/auth/customer'
import type { BundleRule } from '@/lib/types'

export { useBundleRules, useSiteSettings, useWhatsappNumber } from '@/components/SiteSettingsProvider'

const CartDrawer = dynamic(() => import('@/components/shop/CartDrawer'), { ssr: false, loading: () => null })

// ── ArcTheme ───────────────────────────────────────────────────────────────
export interface ArcSwatch {
  slug: string
  accentA: string
  accentB: string
}
interface ArcThemeValue {
  /** current arc slug (null = brand default door/volt) */
  current: string | null
  /** recolour the page: tweens --arc-a / --arc-b on <html> over 400ms. null resets. */
  set: (slug: string | null) => void
  arcs: ArcSwatch[]
}
const DEFAULT_A = '#6d3bff'
const DEFAULT_B = '#ffe14d'
const ArcThemeContext = createContext<ArcThemeValue>({ current: null, set: () => {}, arcs: [] })

/** useArcTheme().set('naruto') recolours bg-arc-a / text-arc-b / accent-arc everywhere. */
export function useArcTheme(): ArcThemeValue {
  return useContext(ArcThemeContext)
}

function useArcThemeState(arcs: ArcSwatch[]): ArcThemeValue {
  const [current, setCurrent] = useState<string | null>(null)
  const tween = useRef<gsap.core.Tween | null>(null)
  const set = useCallback(
    (slug: string | null) => {
      setCurrent(slug)
      const arc = slug ? arcs.find((a) => a.slug === slug) : undefined
      const a = arc?.accentA ?? DEFAULT_A
      const b = arc?.accentB ?? DEFAULT_B
      const root = document.documentElement
      root.dataset.arc = arc ? arc.slug : ''
      tween.current?.kill()
      if (prefersReducedMotion()) {
        root.style.setProperty('--arc-a', a)
        root.style.setProperty('--arc-b', b)
        return
      }
      registerGsap()
      tween.current = gsap.to(root, { '--arc-a': a, '--arc-b': b, duration: 0.4, ease: 'power2.out' })
    },
    [arcs],
  )
  return useMemo(() => ({ current, set, arcs }), [current, set, arcs])
}

// ── route effects (needs usePathname → isolated inside <Suspense>) ─────────
function RouteEffects({ onRoute }: { onRoute: () => void }) {
  const pathname = usePathname()
  const first = useRef(true)
  useEffect(() => {
    // aria-current on header/footer nav links that opt in with data-nav
    document.querySelectorAll<HTMLAnchorElement>('a[data-nav]').forEach((a) => {
      const href = a.getAttribute('href') || ''
      const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
      if (active) a.setAttribute('aria-current', 'page')
      else a.removeAttribute('aria-current')
    })
    if (first.current) {
      first.current = false
      return
    }
    onRoute()
    window.dispatchEvent(new CustomEvent('ted:navigate', { detail: { pathname } }))
    // new page content → recompute triggers once layout settles
    const id = window.setTimeout(() => {
      window.__lenis?.resize()
      ScrollTrigger.refresh()
    }, 120)
    return () => window.clearTimeout(id)
  }, [pathname, onRoute])
  return null
}

// ── lazy cart drawer: load on first open, or when the browser is idle ─────
function LazyCartDrawer() {
  const open = useCart((s) => s.open)
  const [mount, setMount] = useState(false)
  // first open mounts it for good (state adjusted during render, no effect round-trip)
  if (open && !mount) setMount(true)
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setMount(true), { timeout: 4000 })
      return () => (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(() => setMount(true), 2500)
    return () => window.clearTimeout(t)
  }, [])
  return mount ? <CartDrawer /> : null
}

export interface ProvidersProps {
  children: ReactNode
  /** accent pairs for useArcTheme (from repo getCollections) */
  arcs?: ArcSwatch[]
  /** settings.whatsapp from repo getSettings() (Admin → Settings) */
  whatsapp?: string
  /** active bundle deals from repo getBundleRules() (Admin → Deals) */
  bundleRules?: BundleRule[]
}

export function Providers({ children, arcs = [], whatsapp = '', bundleRules }: ProvidersProps) {
  const arcTheme = useArcThemeState(arcs)
  const resetArc = arcTheme.set
  const onRoute = useCallback(() => resetArc(null), [resetArc])

  useEffect(() => {
    registerGsap()
    ensureHydrated()
    return initAnalytics()
  }, [])

  return (
    <SiteSettingsProvider whatsapp={whatsapp} bundleRules={bundleRules}>
    <ArcThemeContext.Provider value={arcTheme}>
      <MotionConfig reducedMotion="user">
        <CustomerProvider>
        <SmoothScroll>
          <Suspense fallback={null}>
            <RouteEffects onRoute={onRoute} />
          </Suspense>
          {children}
          <Cursor />
          <LazyCartDrawer />
          <Toaster
            position="bottom-center"
            closeButton
            gap={10}
            offset={20}
            mobileOffset={16}
            toastOptions={{ className: 'ted-toast', duration: 4000 }}
          />
        </SmoothScroll>
        </CustomerProvider>
      </MotionConfig>
    </ArcThemeContext.Provider>
    </SiteSettingsProvider>
  )
}

export default Providers
