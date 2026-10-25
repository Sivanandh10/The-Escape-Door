// MyAnimeList title → our collection slug + product tags (pure). Owner: AUTH, extended by MAL-RECS.
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
  'jujutsu kaisen 0': 'jujutsu-kaisen',
  'shingeki no kyojin': 'attack-on-titan',
  'shingeki kyojin chuugakkou': 'attack-on-titan',
  'attack on titan': 'attack-on-titan',
  'kimetsu no yaiba': 'demon-slayer',
  'demon slayer': 'demon-slayer',
  'kimetsu gakuen': 'demon-slayer',
  kimetsu: 'demon-slayer',
  'one piece': 'one-piece',
  'wan pisu': 'one-piece',
  naruto: 'naruto',
  boruto: 'naruto',
  'road of naruto': 'naruto',
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

/** Every alias, longest first (franchise grouping — independent of which collections are live). */
const ALL_ALIASES: Array<[string, string]> = Object.entries(MAL_ALIASES)
  .map(([a, slug]) => [normTitle(a), slug] as [string, string])
  .filter(([a]) => a.trim().length >= 4)
  .sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0]))

/** The franchise an anime belongs to by our alias table ("Boruto" → naruto, "Shingeki no Kyojin" → attack-on-titan),
 *  whether or not we have that collection yet. null = not in the table. */
export function aliasOf(a: Pick<MalAnimeBase, 'title' | 'en' | 'synonyms'>): string | null {
  const titles = [a.title, a.en ?? '', ...(a.synonyms ?? [])].filter(Boolean).map(normTitle)
  for (const [alias, slug] of ALL_ALIASES) if (titles.some((t) => t.includes(alias))) return slug
  return null
}

// ---------------------------------------------------------------- anime → product tags (pieces not tied to an arc)
// Beyond Anime fandoms carry tags (seed.ts): bookish · jane-austen · swiftie · harry-potter · wizarding · k-pop · f1 ·
// pixar · animated-films. A MAL list can only hold anime, so these rules bridge "what they watch" → "what we stock":
// racing anime → F1 pieces, idol anime → K-pop pieces, Ghibli / Shinkai films → animated-film pieces …
/** title alias → product tags (weight 1) */
export const TAG_ALIASES: Record<string, string[]> = {
  'initial d': ['f1'], overtake: ['f1'], 'mf ghost': ['f1'], capeta: ['f1'], redline: ['f1'], 'future gpx cyber formula': ['f1'],
  'oshi no ko': ['k-pop'], 'love live': ['k-pop'], idolmaster: ['k-pop'], 'idolish7': ['k-pop'], 'uta no prince sama': ['k-pop'],
  'zombieland saga': ['k-pop'], 'bocchi the rock': ['swiftie'], 'kimi no uso': ['swiftie'], 'shigatsu wa kimi no uso': ['swiftie'],
  'k on': ['swiftie'], 'given': ['swiftie'], 'nana': ['swiftie'],
  'violet evergarden': ['bookish'], 'bungou stray dogs': ['bookish'], 'honzuki no gekokujou': ['bookish'], bookworm: ['bookish'],
  'emma a victorian romance': ['bookish', 'jane-austen'], 'eikoku koi monogatari emma': ['bookish', 'jane-austen'],
  'read or die': ['bookish'], 'kusuriya no hitorigoto': ['bookish'], 'apothecary diaries': ['bookish'],
  'little witch academia': ['wizarding', 'harry-potter'], 'mahoutsukai no yome': ['wizarding', 'harry-potter'],
  'ancient magus bride': ['wizarding', 'harry-potter'], mashle: ['wizarding', 'harry-potter'], 'tongari boushi no atelier': ['wizarding'],
  'witch hat atelier': ['wizarding'], 'majo no tabitabi': ['wizarding'], 'sousou no frieren': ['wizarding'], frieren: ['wizarding'],
  'sen to chihiro': ['animated-films', 'pixar'], 'spirited away': ['animated-films', 'pixar'], 'tonari no totoro': ['animated-films', 'pixar'],
  'hauru no ugoku shiro': ['animated-films', 'pixar'], 'howl s moving castle': ['animated-films', 'pixar'], 'mononoke hime': ['animated-films'],
  'kimi no na wa': ['animated-films'], 'your name': ['animated-films'], 'tenki no ko': ['animated-films'], 'suzume no tojimari': ['animated-films'],
  'koe no katachi': ['animated-films'], 'majo no takkyuubin': ['animated-films', 'wizarding'], 'kaze tachinu': ['animated-films'],
}
/** MAL genre → product tags (weight 0.5) */
export const GENRE_TAGS: Record<string, string[]> = {
  Racing: ['f1'],
  'Idols (Female)': ['k-pop'],
  'Idols (Male)': ['k-pop'],
  Music: ['k-pop', 'swiftie'],
}
/** MAL media type → product tags (weight 0.35) */
export const MEDIA_TAGS: Record<string, string[]> = { movie: ['animated-films'] }

const TAG_RULES: Array<[string, string[]]> = Object.entries(TAG_ALIASES)
  .map(([a, t]) => [normTitle(a), t] as [string, string[]])
  .sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0]))

/** Product tags an anime points to, with a rule weight (title 1 · genre 0.5 · media 0.35). */
export function tagsOf(a: Pick<MalAnimeBase, 'title' | 'en' | 'synonyms' | 'genres'> & { media?: string | null }): Map<string, number> {
  const out = new Map<string, number>()
  const put = (tags: string[], w: number) => {
    for (const t of tags) if ((out.get(t) ?? 0) < w) out.set(t, w)
  }
  const titles = [a.title, a.en ?? '', ...(a.synonyms ?? [])].filter(Boolean).map(normTitle)
  for (const [alias, tags] of TAG_RULES) if (alias.trim().length >= 2 && titles.some((t) => t.includes(alias))) put(tags, 1)
  for (const g of a.genres ?? []) if (GENRE_TAGS[g]) put(GENRE_TAGS[g], 0.5)
  if (a.media && MEDIA_TAGS[a.media]) put(MEDIA_TAGS[a.media], 0.35)
  return out
}
