import { hash } from './rng'
import { DOOR, LAV, PINK, VOLT, HYPE, PAPER, INK } from './svg'
import type { ArtCollection, ArtMotif, ArtProduct, ArtSpec } from './types'

/** Fallback arc table (DESIGN §2). Seed/Supabase collections override it when passed in. */
export const ARCS: Record<string, ArtCollection> = {
  'jujutsu-kaisen': { slug: 'jujutsu-kaisen', name: 'Jujutsu Kaisen', jp: '呪術廻戦', motif: 'smoke', accentA: '#4B2BFF', accentB: '#A78BFF' },
  'attack-on-titan': { slug: 'attack-on-titan', name: 'Attack on Titan', jp: '進撃の巨人', motif: 'walls', accentA: '#A39780', accentB: '#C8102E' },
  'demon-slayer': { slug: 'demon-slayer', name: 'Demon Slayer', jp: '鬼滅の刃', motif: 'flames', accentA: '#FF6A13', accentB: '#12A5A0' },
  'one-piece': { slug: 'one-piece', name: 'One Piece', jp: 'ワンピース', motif: 'waves', accentA: '#1C6FE0', accentB: '#F2C230' },
  naruto: { slug: 'naruto', name: 'Naruto', jp: 'ナルト', motif: 'spiral', accentA: '#FF7A00', accentB: '#1B2A4A' },
  'beyond-anime': { slug: 'beyond-anime', name: 'Beyond Anime', jp: 'その先へ', motif: 'ribbons', accentA: '#FFB8DE', accentB: '#F4EFE6' },
}

export const DEFAULT_ARC: ArtCollection = { slug: 'escape-door', name: 'The Escape Door', jp: '逃げ扉', motif: 'speedlines', accentA: DOOR, accentB: VOLT }

const BLOCKS: Record<string, string> = { lav: LAV, lavender: LAV, pink: PINK, volt: VOLT, yellow: VOLT, hype: HYPE, red: HYPE, door: DOOR, purple: DOOR, paper: PAPER, ink: INK }

export function resolveBlock(block: string | undefined, arc: ArtCollection, slug: string): string {
  if (block?.startsWith('#')) return block
  const key = (block ?? '').toLowerCase().replace(/^(bg-|--)/, '')
  if (key === 'arc' || key === 'arc-a' || key === 'accent') return arc.accentA
  if (key === 'arc-b') return arc.accentB
  if (BLOCKS[key]) return BLOCKS[key]
  return [LAV, PINK, VOLT, LAV][hash(slug) % 4]
}

const MOTIFS: ArtMotif[] = ['smoke', 'walls', 'flames', 'waves', 'spiral', 'ribbons', 'speedlines']

export function resolveArc(collection: string, override?: Partial<ArtCollection> | null): ArtCollection {
  const base = ARCS[collection] ?? { ...DEFAULT_ARC, slug: collection }
  if (!override) return base
  return {
    ...base,
    ...Object.fromEntries(Object.entries(override).filter(([, v]) => v != null && v !== '')),
    motif: override.motif && MOTIFS.includes(override.motif) ? override.motif : base.motif,
  } as ArtCollection
}

function variantHint(p: ArtProduct): string {
  const name = `${p.slug} ${p.name ?? ''}`.toLowerCase()
  const tags = (p.tags ?? []).map((t) => t.toLowerCase())
  const kinds = new Set((p.variants ?? []).map((v) => (v.attrs?.kind ?? v.label).toLowerCase()))
  if (p.type === 'katana') return /led/.test(name) || tags.includes('led') ? 'led' : 'basic'
  if (p.type === 'bookmark') {
    if (kinds.has('plain') && kinds.has('magnetic')) return 'both'
    return /magnetic/.test(name) ? 'magnetic' : 'plain'
  }
  if (p.type === 'tshirt') {
    if (tags.includes('half-n-half') || /half-n-half/.test(name)) return 'half'
    return /baby/.test(name) ? 'baby' : /regular/.test(name) ? 'regular' : 'oversized'
  }
  if (p.type === 'accessory' && /hoop/.test(name)) return 'hoop'
  if (/set-of|pack-of/.test(name)) return 'pack'
  return ''
}

/** Sub-fandom tags can pick a better-fitting original motif (Beyond Anime). */
function motifFromTags(p: ArtProduct, base: ArtMotif): ArtMotif {
  const tags = new Set((p.tags ?? []).map((t) => t.toLowerCase()))
  if (tags.has('f1')) return 'speedlines'
  return base
}

/** Resolve a product (+ optional collection record) into a fully specified ArtSpec. */
export function artSpec(p: ArtProduct, collection?: Partial<ArtCollection> | null, uidSalt = ''): ArtSpec {
  const arc = resolveArc(p.collection, collection)
  const h = hash(p.slug)
  return {
    slug: p.slug,
    type: p.type,
    title: (p.designTitle || p.name || p.slug).trim(),
    jp: p.jpTitle?.trim() || arc.jp || '',
    collectionName: arc.name ?? p.collection,
    motif: motifFromTags(p, arc.motif),
    colorA: arc.accentA,
    colorB: arc.accentB,
    block: resolveBlock(p.colorBlock, arc, p.slug),
    template: (['A', 'B', 'C'] as const)[h % 3],
    variant: variantHint(p),
    uid: `a${(h % 1e6).toString(36)}${uidSalt ? '-' + uidSalt.replace(/[^a-z0-9]/gi, '') : ''}`,
  }
}
