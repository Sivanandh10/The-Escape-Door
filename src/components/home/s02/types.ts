export interface ArcDoorData {
  slug: string
  name: string
  jp: string
  group: 'anime' | 'beyond'
  accentA: string
  accentB: string
  motif: string
  tagline: string
  count: number
  /** "from ₹30" — null when every item is price-on-request */
  fromLabel: string | null
  peek: { src: string; alt: string; name: string } | null
  index: number
  /** readable text colour on accentA */
  fgA: 'ink' | 'paper'
}
