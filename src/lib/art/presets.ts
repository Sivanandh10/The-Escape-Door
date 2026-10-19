// Motif presets per call site — ONE source for the props a section passes to <ArcMotif> and for
// scripts/export-art.mts, which pre-renders every preset × catalogue entry into public/art/.
// Change a number here and re-run the export (otherwise that motif silently falls back to inline SVG).
import type { MotifSpec } from './static'

type Arc = { slug: string; motif: string; accentA: string; accentB: string }
type Pick = { slug: string; motif: string; a: string; b: string }

export const MOTIF_PRESETS = {
  /** S02 corridor door leaf */
  door: (c: Arc): MotifSpec => ({ motif: c.motif, colorA: c.accentA, colorB: c.accentB, animated: true, width: 360, height: 640, density: 0.55, seed: `${c.slug}-door` }),
  /** /arc/[collection] full-bleed hero */
  arcHero: (c: Arc): MotifSpec => ({ motif: c.motif, colorA: c.accentA, colorB: c.accentB, animated: true, width: 1600, height: 900, density: 0.7, seed: `${c.slug}-hero` }),
  /** shop door strip (/shop, /arc, category pages) */
  strip: (c: Arc): MotifSpec => ({ motif: c.motif, colorA: c.accentA, colorB: c.accentB, width: 300, height: 440, density: 0.5 }),
  /** /about arc tiles */
  about: (c: Arc): MotifSpec => ({ motif: c.motif, colorA: c.accentA, colorB: c.accentB }),
  /** ShopHero (dark band, paper lines) */
  shopHero: (motif: string, colorA: string, colorB: string): MotifSpec => ({ motif, colorA, colorB, line: '#F4EFE6', light: '#0B0B0F', animated: true, width: 900, height: 700, density: 0.55 }),
  /** S06 wall pieces */
  wallPolaroid: (p: Pick): MotifSpec => ({ motif: p.motif, colorA: p.a, colorB: p.b, width: 400, height: 400, density: 0.7, seed: `${p.slug}-wall` }),
  wallPoster: (p: Pick): MotifSpec => ({ motif: p.motif, colorA: p.a, colorB: p.b, width: 360, height: 300, density: 0.75, seed: `${p.slug}-wall` }),
  wallBadge: (p: Pick): MotifSpec => ({ motif: p.motif, colorA: p.a, colorB: p.b, width: 240, height: 240, density: 0.8, seed: `${p.slug}-pin` }),
  wallBookmark: (p: Pick): MotifSpec => ({ motif: p.motif, colorA: p.a, colorB: p.b, width: 120, height: 440, density: 0.8, seed: `${p.slug}-wall` }),
  /** S09 forge card */
  forgeCard: (): MotifSpec => ({ motif: 'spiral', colorA: '#6D3BFF', colorB: '#FFE14D', width: 480, height: 600, density: 0.75, seed: 'forge-card' }),
} as const

/** ShopHero defaults (/shop) — kept here so the export script renders the same file. */
export const SHOP_HERO_DEFAULT = { motif: 'speedlines', accentA: 'var(--color-volt)', accentB: 'var(--color-lav)' } as const
