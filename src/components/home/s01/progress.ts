// Shared scroll progress for the hero door (S01). Owner: S01.
// The GSAP ScrollTrigger timeline writes `p` (0..1, scrub-smoothed); the R3F scene reads it every frame,
// so the CSS door and the WebGL door tell the exact same story from one source of truth.
export const heroProgress = { p: 0 }

/** Phases of the door story, in timeline progress (0..1). Both doors read these. */
export const PHASE = {
  creak: [0, 0.12],
  open: [0.12, 0.45],
  expand: [0.38, 0.8],
  dolly: [0.45, 0.95],
  burst: [0.72, 0.95],
} as const

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
