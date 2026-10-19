// Deterministic randomness for the art system. NEVER use Math.random in src/lib/art.
// Same slug -> same art, on the server, in the browser and in the mockup generator.

/** FNV-1a 32-bit hash of a string. */
export function hash(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export interface Rng {
  /** float in [0, 1) */
  (): number
  /** float in [min, max) */
  range(min: number, max: number): number
  /** integer in [min, max] */
  int(min: number, max: number): number
  pick<T>(arr: readonly T[]): T
  chance(p: number): boolean
  /** a child stream that does not disturb this one */
  fork(salt: string): Rng
}

/** mulberry32 seeded by a string. */
export function rng(seed: string): Rng {
  let a = hash(seed)
  const next = (() => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }) as Rng
  next.range = (min, max) => min + next() * (max - min)
  next.int = (min, max) => Math.floor(min + next() * (max - min + 1))
  next.pick = (arr) => arr[Math.floor(next() * arr.length) % arr.length]
  next.chance = (p) => next() < p
  next.fork = (salt) => rng(`${seed}::${salt}`)
  return next
}
