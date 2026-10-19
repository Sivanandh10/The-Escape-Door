// Shared helpers. Owner: F1. Pure — safe in server and client code.
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge class names (clsx + tailwind-merge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Map v from [inMin,inMax] to [outMin,outMax] (clamped). */
export const mapRange = (v: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
  outMin + (outMax - outMin) * clamp((v - inMin) / (inMax - inMin))

/**
 * Seeded PRNG (mulberry32). Deterministic on server and client, so it is safe during
 * render under Cache Components and never causes hydration mismatches.
 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable numeric hash of a string (for seeding per-item randomness). */
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** True for http(s)/mailto/tel links or anything that leaves the site. */
export const isExternalHref = (href: string) => /^(https?:)?\/\//.test(href) || /^(mailto|tel|sms):/.test(href)
