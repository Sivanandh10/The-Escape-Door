// Shared scroll progress for the hero door (S01). Owner: S01.
// The GSAP ScrollTrigger timeline writes `p` (0..1, scrub-smoothed); the R3F scene reads it every frame,
// so the CSS door and the WebGL door tell the exact same story from one source of truth.
export const heroProgress = { p: 0 }

/** Phases of the door story, in timeline progress (0..1). Both doors read these.
 *  creak → open (the product showcase appears behind the leaf) → the portal grows to full screen while the
 *  camera walks up to the threshold → hold on the showcase → volt burst hands over to S02. */
export const PHASE = {
  creak: [0, 0.1],
  open: [0.1, 0.36],
  expand: [0.3, 0.64],
  dolly: [0.32, 0.68],
  show: [0.4, 0.9],
  burst: [0.9, 1],
} as const

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
