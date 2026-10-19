'use client'
// #20 Lenis smooth scroll synced to the GSAP ticker + ScrollTrigger. Owner: F1.
// - Mounted once in <Providers>. Exposes window.__lenis (QA script + other agents).
// - Reduced motion: respectReducedMotion (lerp 1, instant) = native feel. Touch stays native (Lenis syncTouch off).
// - useScrollVelocity() works with or without Lenis (falls back to native scroll deltas).
import { useEffect, useRef, type ReactNode } from 'react'
import { ReactLenis, useLenis as useLenisBase, type LenisRef } from 'lenis/react'
import type Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { registerGsap } from '@/lib/motion'

declare global {
  interface Window {
    __lenis?: Lenis
  }
}

// ── scroll velocity store (px per frame-ish, signed; + = scrolling down) ──
const velocity = { current: 0 }
let nativeBound = 0
function bindNativeVelocity() {
  if (typeof window === 'undefined') return () => {}
  nativeBound++
  if (nativeBound > 1) return () => void nativeBound--
  let lastY = window.scrollY
  let lastT = performance.now()
  let raf = 0
  const decay = () => {
    // ease back to 0 when scrolling stops
    velocity.current *= 0.86
    if (Math.abs(velocity.current) < 0.01) velocity.current = 0
    else raf = requestAnimationFrame(decay)
  }
  const onScroll = () => {
    if (window.__lenis) return // Lenis feeds the store itself
    const now = performance.now()
    const dy = window.scrollY - lastY
    const dt = Math.max(1, now - lastT)
    velocity.current = (dy / dt) * 16.67
    lastY = window.scrollY
    lastT = now
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(decay)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  return () => {
    nativeBound--
    window.removeEventListener('scroll', onScroll)
    cancelAnimationFrame(raf)
  }
}

/**
 * Ref-like getter for the current scroll velocity. Read `.current` inside rAF/ticker loops —
 * it never triggers React renders. Positive = scrolling down. Roughly px per 60fps frame.
 */
export function useScrollVelocity(): { readonly current: number } {
  useEffect(() => bindNativeVelocity(), [])
  return velocity
}

/** Access the Lenis instance (undefined under reduced motion). Optional scroll callback. */
export function useLenis(callback?: (lenis: Lenis) => void, deps: unknown[] = []): Lenis | undefined {
  return useLenisBase(callback, deps)
}

function LenisBridge() {
  // keep ScrollTrigger and the velocity store in sync with Lenis
  const lenis = useLenisBase((l) => {
    velocity.current = l.velocity
    ScrollTrigger.update()
  })
  useEffect(() => {
    if (!lenis) return
    window.__lenis = lenis
    ScrollTrigger.refresh()
    return () => {
      if (window.__lenis === lenis) delete window.__lenis
    }
  }, [lenis])
  return null
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  const ref = useRef<LenisRef>(null)

  useEffect(() => {
    registerGsap()
    const update = (time: number) => ref.current?.lenis?.raf(time * 1000)
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    const refresh = () => ScrollTrigger.refresh()
    document.fonts?.ready.then(refresh).catch(() => {})
    return () => {
      gsap.ticker.remove(update)
      gsap.ticker.lagSmoothing(500, 33)
    }
  }, [])

  // Reduced motion: Lenis' built-in respectReducedMotion forces lerp 1 + instant scrollTo,
  // i.e. native-feeling scroll with no inertia (DESIGN §7 "Lenis off").
  return (
    <ReactLenis
      root
      ref={ref}
      options={{ autoRaf: false, lerp: 0.1, anchors: { offset: -88 }, stopInertiaOnNavigate: true, respectReducedMotion: true }}
    >
      <LenisBridge />
      {children}
    </ReactLenis>
  )
}

export default SmoothScroll
