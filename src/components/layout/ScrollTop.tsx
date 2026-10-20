'use client'
// "Back to top" — a little door-shaped button fixed bottom-LEFT (the right corner belongs to the Netlify badge /
// toasts). Owner: DOOR. Mounted once in <Providers>. Shows after 600px of scroll, smooth-scrolls via Lenis
// (native fallback; instant under reduced motion). Hidden on /admin. Lifted above the sticky bottom bars that
// checkout and the designer show on phones. Steps aside (fades out) while an element marked
// [data-scrolltop-avoid] — e.g. S02's left-aligned "Scroll to walk the corridor" cue — sits in its corner.
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const SHOW_AT = 600
/** the corner the button occupies (+ a little air): left 96px × bottom 88px of the viewport */
const CORNER_W = 96
const CORNER_H = 88
/** routes with a full-width sticky bar at the bottom on phones (CheckoutFlow, ForgeStudio) */
const BAR_ROUTES = ['/checkout', '/custom', '/lab/forge']

export function ScrollTop() {
  const pathname = usePathname() || '/'
  const [scrolled, setScrolled] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const admin = pathname === '/admin' || pathname.startsWith('/admin/')
  const shown = scrolled && !blocked

  useEffect(() => {
    if (admin) return
    let raf = 0
    const check = () => {
      raf = 0
      setScrolled(window.scrollY > SHOW_AT)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check)
    }
    check()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [admin, pathname])

  // hide while marked text is under the button's corner (IntersectionObserver also sees transforms, so S02's
  // horizontally pinned corridor is tracked as it slides); rebuilt on resize so the corner band stays exact
  useEffect(() => {
    if (admin || typeof IntersectionObserver === 'undefined') return
    let io: IntersectionObserver | null = null
    const hits = new Set<Element>()
    const build = () => {
      io?.disconnect()
      hits.clear()
      setBlocked(false)
      const els = document.querySelectorAll('[data-scrolltop-avoid]')
      if (!els.length) return
      const top = Math.max(0, window.innerHeight - CORNER_H)
      const right = Math.max(0, window.innerWidth - CORNER_W)
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) hits.add(e.target)
            else hits.delete(e.target)
          }
          setBlocked(hits.size > 0)
        },
        { rootMargin: `-${top}px -${right}px 0px 0px` },
      )
      els.forEach((el) => io!.observe(el))
    }
    build()
    let t = 0
    const onResize = () => {
      window.clearTimeout(t)
      t = window.setTimeout(build, 200)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.clearTimeout(t)
      io?.disconnect()
    }
  }, [admin, pathname])

  if (admin) return null
  const lifted = BAR_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))

  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lenis = window.__lenis
    if (lenis && !reduce) lenis.scrollTo(0, { duration: 1.1 })
    else if (lenis) lenis.scrollTo(0, { immediate: true })
    else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    // the button hides at the top — restart keyboard focus from the top of the page instead of losing it
    const body = document.body
    body.setAttribute('tabindex', '-1')
    body.focus({ preventScroll: true })
    body.removeAttribute('tabindex')
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={shown ? 0 : -1}
      aria-hidden={shown ? undefined : true}
      data-cursor="TOP"
      className={cn(
        'group/top focus-ring fixed left-[max(16px,env(safe-area-inset-left))] z-[65] flex size-12 items-center justify-center',
        'rounded-t-[22px] border-[3px] border-ink bg-volt text-ink shadow-[3px_3px_0_0_var(--color-ink)]',
        'transition-[opacity,translate,visibility,box-shadow] duration-200 ease-out motion-reduce:transition-none',
        'hover:-translate-y-0.5 hover:shadow-[4px_5px_0_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)]',
        lifted
          ? 'bottom-[calc(96px+env(safe-area-inset-bottom))] lg:bottom-[max(16px,env(safe-area-inset-bottom))]'
          : 'bottom-[max(16px,env(safe-area-inset-bottom))]',
        shown ? 'visible opacity-100' : 'invisible translate-y-3 opacity-0',
      )}
    >
      {/* the door's inner frame */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-[7px] bottom-0 top-[6px] rounded-t-[14px] border-2 border-b-0 border-ink/70" />
      <ArrowUp
        aria-hidden="true"
        strokeWidth={2.75}
        className="relative size-5 transition-transform duration-200 ease-out group-hover/top:-translate-y-0.5 motion-reduce:transition-none"
      />
    </button>
  )
}

export default ScrollTop
