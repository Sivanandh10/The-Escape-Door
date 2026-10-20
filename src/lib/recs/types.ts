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
