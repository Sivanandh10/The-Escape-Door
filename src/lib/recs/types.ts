// Recommendation + MyAnimeList snapshot types (pure, client + server). Owner: AUTH.
import type { Product } from '@/lib/types'

export type MalStatus = 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch'

export interface MalAnimeBase {
  id: number
  title: string
  en: string | null
  synonyms: string[]
  genres: string[]
  mean: number | null
  picture: string | null
}
/** One row of the stored anime_snapshot (compact MAL list entry). */
export interface MalAnime extends MalAnimeBase {
  status: MalStatus | null
  /** 0 = not scored */
  score: number
  episodes: number
  updatedAt: string | null
  /** richer import (src/lib/auth/mal-import.ts) — optional: older snapshots don't carry them */
  rewatching?: boolean
  /** times rewatched (MAL num_times_rewatched) */
  rewatches?: number
  /** the show's total episode count (0 / null = unknown or airing) */
  total?: number | null
  /** MAL media type: tv · movie · ova · ona · special · music */
  media?: string | null
}
export type MalSuggestion = MalAnimeBase

export interface MalSnapshotStats {
  total: number
  watching: number
  completed: number
  planToWatch: number
  onHold: number
  dropped: number
  meanScore: number | null
}

export interface RecentView {
  slug: string
  viewedAt: string
  count: number
}

export interface AnimeRef {
  id: number
  title: string
  picture: string | null
  /** episodes watched across the franchise (affinity model) */
  episodes?: number
}

/** One franchise from the shopper's MyAnimeList, ranked by the affinity model (src/lib/recs/affinity.ts). */
export interface TopAnime extends AnimeRef {
  /** franchise key (normalised title) */
  key: string
  /** best MyAnimeList score the shopper gave any entry (0 = not scored) */
  score: number
  /** strongest list status across the franchise */
  status: MalStatus | null
  /** list entries grouped into this franchise (seasons, films …) */
  entries: number
  /** 0..1 relative to the shopper's top franchise */
  affinity: number
  /** our collection slug when we make an arc for it */
  collection: string | null
  /** we stock at least one in-stock piece for it (arc or tagged product) */
  stocked: boolean
}

/** The franchise that leads "Picked for you". */
export interface MalLead {
  key: string
  title: string
  episodes: number
  collection: string | null
  /** how many of the first picks belong to it */
  count: number
}

export interface WatchedRow {
  anime: AnimeRef
  collection: { slug: string; name: string; jp: string }
  products: Product[]
}

export interface SuggestionRef extends AnimeRef {
  mean: number | null
  genres: string[]
  /** our collection slug when we already make merch for it */
  collection: string | null
}

export interface RecsPayload {
  signedIn: boolean
  /** recently viewed products, newest first */
  recent: Product[]
  /** related to views / cart / wishlist / MAL */
  picks: Product[]
  pickReason: string | null
  /** product id → explainable reason chip for each pick (hybrid ranker; optional for older payloads) */
  pickReasons?: Record<string, { kind: string; label: string }>
  /** "Because you watched X" rows */
  watched: WatchedRow[]
  /** anime the shopper rates that we don't make merch for yet → "Request merch" */
  unmapped: AnimeRef[]
  /** Beyond Anime products shown next to the request CTA */
  beyond: Product[]
  /** MAL "anime you might watch next" */
  suggestions: SuggestionRef[]
  mal: { username: string; syncedAt: string | null; stats: MalSnapshotStats | null } | null
  /** "Your most-watched anime" (top 5 franchises by affinity; MAL users only) */
  topAnime?: TopAnime[]
  /** the franchise whose pieces lead `picks` ("Because you watched X (N eps)") */
  malLead?: MalLead | null
}

export const EMPTY_RECS: RecsPayload = {
  signedIn: false,
  recent: [],
  picks: [],
  pickReason: null,
  watched: [],
  unmapped: [],
  beyond: [],
  suggestions: [],
  mal: null,
}
