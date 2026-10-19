// Motion tokens + client hooks. Owner: F1.
// Tokens (EASE/SPRING/DUR/CSS_EASE) are plain values and safe to import anywhere.
// Hooks and registerGsap() are client-only: call them from 'use client' components.
import { useSyncExternalStore } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { Flip } from 'gsap/Flip'
import { CustomEase } from 'gsap/CustomEase'
import { useGSAP } from '@gsap/react'

/** GSAP ease names (DESIGN §7, CONTRACTS §2). */
export const EASE = {
  out: 'expo.out',
  punch: 'power4.out',
  slam: 'back.out(1.7)',
  inOut: 'power3.inOut',
  in: 'expo.in',
  hover: 'power2.out',
} as const

/** Same curves as CSS cubic-beziers (also exposed as --ease-* vars in globals.css). */
export const CSS_EASE = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  punch: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
  slam: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  in: 'cubic-bezier(0.7, 0, 0.84, 0)',
  hover: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const

/** motion/react spring for UI micro-interactions. */
export const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const

/** Durations in seconds. */
export const DUR = { ui: 0.2, enter: 0.9, slam: 0.45 } as const

let registered = false
/** Register GSAP plugins once (client only). Safe to call from every component. */
export function registerGsap(): typeof gsap {
  if (registered || typeof window === 'undefined') return gsap
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin, Flip, CustomEase)
  CustomEase.create('ted-slam', 'M0,0 C0.12,0 0.18,1.22 0.42,1.08 0.6,0.98 0.7,1 1,1')
  CustomEase.create('ted-ink', 'M0,0 C0.65,0 0.35,1 1,1')
  registered = true
  return gsap
}

// ---------------------------------------------------------------------------
// media-query hooks (SSR-safe: server snapshot is the "safe" value)

function mqStore(query: string) {
  return {
    subscribe(cb: () => void) {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    get() {
      return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches
    },
  }
}
const reducedStore = mqStore('(prefers-reduced-motion: reduce)')
const touchStore = mqStore('(hover: none), (pointer: coarse)')
const fineStore = mqStore('(hover: hover) and (pointer: fine)')
const noopSubscribe = () => () => {}

/** true when the user prefers reduced motion. Server render returns false. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(reducedStore.subscribe, reducedStore.get, () => false)
}

/** true on touch-first devices (no hover or coarse pointer). Server render returns false. */
export function useIsTouch(): boolean {
  return useSyncExternalStore(touchStore.subscribe, touchStore.get, () => false)
}

/** true for a hover-capable fine pointer (mouse/trackpad). Server render returns false. */
export function useFinePointer(): boolean {
  return useSyncExternalStore(fineStore.subscribe, fineStore.get, () => false)
}

/** false during SSR + hydration, true once mounted on the client (portals, browser-only UI). */
export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

type NavigatorHints = Navigator & {
  deviceMemory?: number
  connection?: { saveData?: boolean }
}

/** Snapshot (non-hook) of the low-power heuristic. */
export function isLowPower(): boolean {
  if (typeof navigator === 'undefined') return false
  const n = navigator as NavigatorHints
  const mem = n.deviceMemory
  const cores = n.hardwareConcurrency
  return (typeof mem === 'number' && mem < 4) || (typeof cores === 'number' && cores <= 4) || !!n.connection?.saveData
}

/** true for deviceMemory < 4 GB, ≤ 4 CPU cores or Save-Data. Server render (and first client render) returns false. */
export function useLowPower(): boolean {
  return useSyncExternalStore(noopSubscribe, isLowPower, () => false)
}

/** Synchronous read of prefers-reduced-motion for event handlers / effects. */
export function prefersReducedMotion(): boolean {
  return reducedStore.get()
}
