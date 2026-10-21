// Visual search — model + calibrated thresholds. Owner: SEARCH.
// Re-measure with `node scripts/calibrate-image-search.mts` after changing the model, the preprocessing or the
// catalogue art style, then update the numbers below (and the comments) from its report.

/** Hugging Face model id (transformers.js). MobileCLIP S0 image tower, 512-d, Apple sample-code licence. */
export const MODEL_ID = 'Xenova/mobileclip_s0'
/**
 * Weights: fp16 (22.9 MB). MEASURED: the q8 / int8 / uint8 exports of this model are broken — cos(q8, fp32) of the
 * same image is 0.06–0.22 (front vs back of one tee: −0.02). fp16 = fp32 to 3 decimals; q4 / bnb4 are 0.98 but bigger
 * (36 MB). So every side (browser, admin, Node scripts) uses fp16.
 */
export const MODEL_DTYPE = 'fp16' as const
export const EMBED_DIM = 512
/** stored in product_image_embeddings.model — bump the suffix when the preprocessing changes (old rows are ignored).
 *  v2: index views (vec.ts INDEX_VIEWS / viewsFor), transparency flattened onto white in both pipelines. */
export const MODEL_KEY = 'mobileclip_s0@fp16-v2'
/** short side every image is shrunk to before the CLIP processor (= its 256 px input; see vec.ts preShrinkSize) */
export const PRE_SHRINK = 256
/** approximate first-use download, shown before the progress events arrive */
export const MODEL_MB = 23

/** File limits for the picker */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
/**
 * Pixel limits (read from the file header before decoding, dims.ts). Above MAX_PIXELS the photo is refused ('size'
 * error): a full decode would be >= 400 MB of RGBA (a 16 000 x 16 000 PNG of 770 kB took 6.4 s on desktop and is
 * likely to kill a phone tab). Above BIG_PIXELS (e.g. a 48 MP phone photo) the worker decodes straight to ~1024 px
 * instead of decoding at full size first.
 */
export const MAX_PIXELS = 100_000_000
export const BIG_PIXELS = 16_000_000

/**
 * Thresholds on cosine similarity. Product score = max over its index vectors of (cosine − VIEW_PENALTY[view]);
 * every product image is indexed as the whole image + centre crop + print crop (tee / hoodie fronts: no print crop,
 * see vec.ts viewsFor). A shopper's photo is one vector of the whole photo.
 *
 * MEASURED 2026-10-22 · `node scripts/calibrate-image-search.mts --web` (+ 19 CC photos of other shops' tees /
 * hoodies / badges in the local qa/visual-search/neg-photos) · 65 published products, 85 images, 235 vectors (live
 * Supabase catalogue), fp16, pre-shrink 256 px, int8 index (round-trip min cos 0.9998). 890 positive queries, 157
 * negatives. Photo-like cases = scripts/lib/photo-sim.mts (perspective + keystone, ±7°, shadow, brightness /
 * saturation / white balance, blur, JPEG q72 on wood / bedsheet / floor / blurred rooms).
 *   Why views: with the old 1-view index a close-up of the back print was 0 % EXACT / 40 % NO RESULT, the garment
 *   back on a surface 80 % EXACT. Why the print-crop penalty and no print crop on fronts: un-penalised, the front
 *   print crop (plain black fabric) scored 0.64 against a solid black image and the earrings' card crop 0.74 against
 *   our wordmark, which would have forced SIMILAR up to 0.76.
 *   Negatives, best product score: off-topic (colours, gradients, text, noise, patterns, textures, picsum photos)
 *   max 0.534 (solid black → a black cape) · our own wordmark / badge 0.686 (printed on the earrings' card) · our
 *   garment silhouette with foreign prints 0.713 · our poster frame with a foreign print 0.711 · real photos of other
 *   tees 0.684 · text only 0.660. Own designs: nearest OTHER product of an original image median 0.643, max 0.899
 *   (tee / hoodie fronts: every front is the same black garment + "TED" chest mark).
 *
 * Chosen:
 *   exact  0.76 + lead 0.06 (tier 1, near-copies)  OR  0.67 + lead 0.15 (tier 2, photos). Tier 2 from a grid search
 *          (exact2 0.55–0.76 × lead 0.08–0.24): the best rule with 0 wrong EXACT on all 890 positives and 0 EXACT on
 *          all 157 negatives, ALSO one step looser on both axes (0.65 / 0.13). The lead is what keeps look-alike
 *          fronts and "our frame + a foreign print" (0.70 / lead 0.12) out; never retune without it.
 *   similar 0.56: every off-topic image is NO RESULT (worst 0.534); no positive falls below it. In-domain
 *          look-alikes (another shop's black tee, our logo) can show as "Similar style": 34 / 127 at 0.56 (65 at 0.50).
 *          13 / 890 positives don't show ours, all plain tee / hoodie fronts.
 *   Outcome (EXACT ✓ / SIMILAR, ours in top 3 / SIMILAR, ours lower / NO RESULT, %), 0 WRONG EXACT anywhere:
 *     original 100/0/0/0 · JPEG q60 100/0/0/0 · 480 px 100/0/0/0 · crop 80 % 76.5/23.5/0/0 · rotate 8° 97.6/2.4/0/0 ·
 *     photographed 98.8/1.2/0/0 · all at once 78.8/20.0/1.2/0 · on a table 70.6/25.9/3.5/0 ·
 *     whole mockup photographed on a surface 58.8/40.0/1.2/0 · garment back cut out on a surface 95/5/0/0 ·
 *     back-print close-up 80/20/0/0 · non-apparel product centre on a surface 84.4/15.6/0/0 ·
 *     garment FRONT on a surface 0/80/20/0 · front-print close-up 0/25/75/0.
 *     Without tee / hoodie fronts every (b) case (crop, rotate, photographed, all at once) is 100 % EXACT.
 *   KNOWN EXCEPTION to "(b) at least top 3": 1 of 510 (b) queries, a tee FRONT under "all at once" (rank 4: 0.810
 *     vs 0.834 for another front). A plain front can't tell our tees apart; the UI asks for the back print.
 *   Browser parity (Chromium, WebGPU and WASM) against the Node vectors, whole image: 0.989 / 0.977 / 0.992 / 0.995
 *     (screentone back, badge, tee front, transparent PNG); crop views computed in the browser (admin auto-index):
 *     0.953–0.996.
 */
/** subtracted from the cosine of each index view (vec.ts INDEX_VIEWS): whole image, centre crop, print crop */
export const VIEW_PENALTY: readonly number[] = [0, 0, 0.05]

export interface MatchThresholds {
  exact: number
  margin: number
  exact2: number
  margin2: number
  similar: number
  maxSimilar: number
}
export const MATCH: MatchThresholds = {
  exact: 0.76,
  margin: 0.06,
  exact2: 0.67,
  margin2: 0.15,
  similar: 0.56,
  maxSimilar: 12,
}
