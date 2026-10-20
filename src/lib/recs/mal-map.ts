// MyAnimeList title → our collection slug (pure). Owner: AUTH.
// Matching is word-boundary "contains" on a normalised title, so sequels, seasons, films and spin-offs map too:
//   "Jujutsu Kaisen 2nd Season" → jujutsu-kaisen · "Shingeki no Kyojin: The Final Season" → attack-on-titan
//   "Boruto: Naruto Next Generations" → naruto · "One Piece Film: Red" → one-piece
// Collections added in the admin later map automatically by their own name (e.g. a "Chainsaw Man" collection), and the
// EXTRA aliases below cover their Japanese romaji titles once such a collection exists.
import type { Collection } from '@/lib/types'
import type { MalAnimeBase } from './types'

/** alias (any case/punctuation) → collection slug */
export const MAL_ALIASES: Record<string, string> = {
  'jujutsu kaisen': 'jujutsu-kaisen',
  'shingeki no kyojin': 'attack-on-titan',
  'attack on titan': 'attack-on-titan',
  'kimetsu no yaiba': 'demon-slayer',
  'demon slayer': 'demon-slayer',
  'one piece': 'one-piece',
  naruto: 'naruto',
  boruto: 'naruto',
  // only used when the admin has added these collections
  'chainsaw man': 'chainsaw-man',
  'ore dake level up na ken': 'solo-leveling',
  'solo leveling': 'solo-leveling',
  haikyuu: 'haikyuu',
  'spy x family': 'spy-x-family',
  'spy family': 'spy-x-family',
  'boku no hero academia': 'my-hero-academia',
  'my hero academia': 'my-hero-academia',
  'kaijuu 8 gou': 'kaiju-no-8',
  'kaiju no 8': 'kaiju-no-8',
  'sousou no frieren': 'frieren',
  frieren: 'frieren',
  bleach: 'bleach',
  'hunter x hunter': 'hunter-x-hunter',
  'tokyo ghoul': 'tokyo-ghoul',
  'death note': 'death-note',
  'blue lock': 'blue-lock',
  'dandadan': 'dandadan',
}

export function normTitle(s: string): string {
  return ` ${s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/×/g, 'x')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `
}

export interface TitleMapper {
  /** collection slug for an anime, or null when we don't make merch for it yet */
  map: (a: Pick<MalAnimeBase, 'title' | 'en' | 'synonyms'>) => string | null
}

/** Build a mapper for the collections that exist right now (only anime-group collections are targets). */
export function makeMapper(collections: Pick<Collection, 'slug' | 'name' | 'group'>[]): TitleMapper {
  const live = new Set(collections.filter((c) => c.group === 'anime').map((c) => c.slug))
  const rules: Array<[string, string]> = []
  for (const [alias, slug] of Object.entries(MAL_ALIASES)) if (live.has(slug)) rules.push([normTitle(alias), slug])
  for (const c of collections) {
    if (c.group !== 'anime') continue
    rules.push([normTitle(c.name), c.slug])
    rules.push([normTitle(c.slug.replace(/-/g, ' ')), c.slug])
  }
  // longest alias first so "spy x family" wins over shorter overlaps
  rules.sort((a, b) => b[0].length - a[0].length)
  return {
    map(a) {
      const titles = [a.title, a.en ?? '', ...(a.synonyms ?? [])].filter(Boolean).map(normTitle)
      for (const [alias, slug] of rules) {
        if (alias.trim().length < 3) continue
        if (titles.some((t) => t.includes(alias))) return slug
      }
      return null
    },
  }
}

/** MAL page for an anime. */
export const malAnimeUrl = (id: number) => `https://myanimelist.net/anime/${id}`
