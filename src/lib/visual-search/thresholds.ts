// Visual search — model + calibrated thresholds. Owner: SEARCH.
// Re-measure with `node scripts/calibrate-image-search.mts` after changing the model, the preprocessing or the
// catalogue art style, then update the numbers below (and the comments) from its report.

/** Hugging Face model id (transformers.js). MobileCLIP S0 image tower, 512-d, Apple sample-code licence. */
export const MODEL_ID = 'Xenova/mobileclip_s0'
/**
 * Weights: fp16 (22.9 MB). MEASURED: the q8 / int8 / uint8 exports of this model are broken — cos(q8, fp32) of the
 * same image is 0.06–0.22 (front vs back of one tee: −0.02). fp16 = fp32 to 3 decimals; q4 / bnb4 are 0.98 but bigger
 * (36 MB). So every side (browser, admin, Node scripts) uses fp16, and the index stores one embedding per image.
 */
export const MODEL_DTYPE = 'fp16' as const
export const EMBED_DIM = 512
/** stored in product_image_embeddings.model — bump the suffix when the preprocessing changes (old rows are ignored) */
export const MODEL_KEY = 'mobileclip_s0@fp16-v1'
/** short side every image is shrunk to before the CLIP processor (= its 256 px input; see vec.ts preShrinkSize) */
export const PRE_SHRINK = 256
/** approximate first-use download, shown before the progress events arrive */
export const MODEL_MB = 23

/** File limits for the picker */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/**
 * Thresholds on cosine similarity (product score = max over its images).
 *
 * MEASURED 2026-10-21 · `node scripts/calibrate-image-search.mts --web` · 65 published products, 85 images (live
 * Supabase catalogue), fp16 model, pre-shrink to 256 px (vec.ts preShrinkSize), int8-stored index vectors
 * (round-trip min cos 0.9999). 680 positive queries + 33 negatives.
 *   Negatives (14 generated: plain colours, gradients, text, noise, checkerboard, stripes, chart, drawing; 7 brand
 *   drawings / textures from public/; 12 real photos from picsum.photos): best product score max 0.448 (our own
 *   wordmark SVG), real photos max 0.331, solid colours ≤ 0.372.
 *   Our own designs: nearest OTHER product of an original image: median 0.641; back prints / flat art max 0.714;
 *   tee & hoodie FRONTS up to 0.902 (every front is the same black garment + "TED" chest mark).
 *   Correct product top-1 / top-3 (%): original 100/100 · JPEG q60 100/100 · 480 px 100/100 · crop 80 % 90.6/97.6 ·
 *   rotate 8° 100/100 · photographed (brightness, blur, sensor noise, JPEG q75) 100/100 · all at once 92.9/98.8 ·
 *   garment cut out on a table 82.4/94.1.
 *   Browser parity (Chromium, Playwright): the same back mockup scored 0.9893 (WebGPU) / 0.9895 (WASM) against its
 *   Node-built vector; before the shared pre-shrink it was 0.92 (canvas resize aliasing the screentone art).
 *   Grid search exact 0.72–0.78 × margin 0.04–0.07: margin 0.04 → 3 WRONG "exact" answers (a tee front named as
 *   another tee); margin ≥ 0.05 → none.
 *
 * Chosen:
 *   similar 0.50 → all 33 negatives are NO RESULT (worst 0.448, +0.05 headroom); no positive query fell below it.
 *   exact   0.76 (above the 0.714 two different designs of ours reach, so another shop's look-alike is less likely to
 *           be called ours) with margin 0.06 (one step safer than the 0.05 that already had 0 errors)
 *           → 0 WRONG "exact" in 680 queries. Outcome (EXACT ✓ / SIMILAR, ours in top 3 / SIMILAR, ours lower / NONE):
 *             original 100/0/0/0 · JPEG q60 100/0/0/0 · 480 px 100/0/0/0 · crop 80 % 69.4/28.2/2.4/0 ·
 *             rotate 8° 97.6/2.4/0/0 · photographed 98.8/1.2/0/0 · all at once 76.5/22.4/1.2/0 ·
 *             on a table 61.2/32.9/5.9/0.
 *           Without apparel fronts (65 of 85 images): crop 89.2 % EXACT, rotate 98.5, photographed 100, all at once 96.9,
 *           on a table 78.5, every miss SIMILAR with ours in the top 3. Fronts under crop / table are SIMILAR (the
 *           honest answer: a plain front can't tell our tees apart; the back print can, and the UI says so).
 */
export const MATCH = {
  exact: 0.76,
  margin: 0.06,
  similar: 0.5,
  maxSimilar: 12,
} as const
