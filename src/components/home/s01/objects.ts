// S01 — the STATIC product object that floats inside the opened door (owner request: hard-coded, not from
// Admin → Products). Owner: S01. Pure + client/server safe.
// Transparent cut-outs rendered by scripts/render-hero-objects.mts into /public/hero. The scroll position picks
// which one shows (tee → hoodie → back-print tee → polaroids); the CSS door, the WebGL door and the chip all
// read ONE index from `heroObjectStore`. Reduced motion: index never moves (the tee stays).
import { HERO_OBJECT_SIZES } from './hero-objects.generated'

export interface HeroObject {
  id: string
  /** chip badge */
  kind: string
  /** chip link text + target (category page — prices/names live in the catalogue, not here) */
  cta: string
  href: string
  alt: string
  /** ≈900px long edge (WebGL + desktop) and 600px (phones) */
  src: string
  src600: string
  w: number
  h: number
}

const def = (id: string, o: Omit<HeroObject, 'id' | 'src' | 'src600' | 'w' | 'h'>): HeroObject => {
  const s = HERO_OBJECT_SIZES[id] ?? { w: 880, h: 900 }
  return { id, ...o, src: `/hero/${id}.webp`, src600: `/hero/${id}-600.webp`, w: s.w, h: s.h }
}

export const HERO_OBJECTS: HeroObject[] = [
  def('tee-cursed-static', {
    kind: 'Oversized tee',
    cta: 'Shop oversized tees',
    href: '/shop/oversized-t-shirts',
    alt: 'Black oversized tee with a big back print',
  }),
  def('hoodie-ember-night', {
    kind: 'Hoodie',
    cta: 'Shop hoodies',
    href: '/shop/hoodies',
    alt: 'Black hoodie with a back print',
  }),
  def('tee-flame-ribbon', {
    kind: 'Back print',
    cta: 'Shop back-print tees',
    href: '/shop/oversized-t-shirts',
    alt: 'Black oversized tee with a manga-panel back print',
  }),
  def('polaroids-talisman', {
    kind: 'Polaroids',
    cta: 'Shop polaroid sets',
    href: '/shop/polaroids',
    alt: 'A set of four polaroid-style prints',
  }),
]

/** Scroll thresholds in TIMELINE TIME (pass `tl.time()`, not `tl.progress()`) where the next object takes over.
 *  Desktop = the pinned door timeline: PHASE values are positions on it (door open 0.36, chip up 0.46 → fades at
 *  0.88, burst 0.9), but the burst text runs past 1, so progress ≠ time there — time keeps all four objects inside
 *  the chip's window with ≈0.12 of scroll each. Phones = the sticky-door scrub (duration exactly 1: door open ≈0.54,
 *  chip up from 0.38, unsticks at 1). */
const STEPS = {
  desk: [0.52, 0.64, 0.76],
  mob: [0.5, 0.68, 0.84],
} as const

export function objectIndexFor(t: number, mode: 'desk' | 'mob'): number {
  const steps = STEPS[mode]
  let i = 0
  while (i < steps.length && t >= steps[i]) i++
  return Math.min(i, HERO_OBJECTS.length - 1)
}

// ---------------------------------------------------------------- shared index (client)
type Listener = () => void
const listeners = new Set<Listener>()

/** `i` is read every frame by the WebGL door; DOM readers subscribe. */
export const heroObjectStore = {
  i: 0,
  set(i: number) {
    if (i === this.i) return
    this.i = i
    listeners.forEach((l) => l())
  },
  subscribe(l: Listener) {
    listeners.add(l)
    return () => void listeners.delete(l)
  },
}
