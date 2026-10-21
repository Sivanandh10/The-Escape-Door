// Hands the shopper's photo from the photo-search modal to Design Your Own (/custom) in memory (owner: SEARCH).
// Nothing is stored or uploaded here: the File lives in this JS module until ForgeStudio takes it on mount (client
// navigation keeps module state). The forge then treats it like any artwork the shopper attached themselves.
let stashed: { file: File; at: number } | null = null
const TTL = 10 * 60_000

export function stashPhotoForCustom(file: File): void {
  stashed = { file, at: Date.now() }
}

/** The photo handed over from photo search, once (null when there is none or it is older than 10 minutes). */
export function takePhotoForCustom(): File | null {
  const s = stashed
  stashed = null
  return s && Date.now() - s.at < TTL ? s.file : null
}
