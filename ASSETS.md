# ASSETS — The Escape Door

Every visual asset in the repo, where it came from and its licence. **Nothing here is copied from a franchise, studio or third-party site.** Collection names (Jujutsu Kaisen, One Piece, …) appear as text only; all drawings are original geometry made for this project.

## Brand marks — RECREATIONS (replace with the owner's original vector files)

| Path | What | How it was made | Licence / note |
|---|---|---|---|
| `src/components/brand/Wordmark.tsx` | Door-bracket wordmark, variants `full` · `bracket` · `stacked` · `inline` | Hand-built SVG recreation of the Instagram mark (`docs/references/instagram-post-01.png`): lavender panel + original screentone/speed-line collage, white "[" door bracket, lettering converted to paths | **RECREATION — replace with original vector files.** Collage art original. Lettering: Bangers / Spicy Rice glyph outlines (SIL OFL 1.1) |
| `public/brand/wordmark.svg` | `full` wordmark, static file | `npx -y tsx scripts/brand/export-brand.mts` | as above (file carries a RECREATION comment) |
| `public/brand/wordmark-stacked.svg`, `wordmark-inline.svg`, `wordmark-bracket.svg` | other variants | same script | as above |
| `src/components/brand/Badge.tsx`, `public/brand/badge.svg`, `badge-512.png` | Cream circle badge, 70s rounded letters with rust→orange grain fill | Recreation of the IG profile picture (`docs/references/instagram-profile-390.png`); Spicy Rice outlines + feTurbulence grain | **RECREATION — replace with original vector files.** Spicy Rice: SIL OFL 1.1 |
| `src/app/icon.svg`, `public/brand/favicon.svg` | Favicon (bracket mark) | export-brand script | recreation (bracket) |
| `src/app/favicon.ico` | 16/32/48 px PNG-in-ICO (replaces the create-next-app icon) | export-brand script | recreation (bracket) |
| `src/app/apple-icon.png`, `public/brand/apple-touch-icon.png` (180), `public/brand/icon-192.png`, `icon-512.png` | App icons | export-brand script (sharp) | recreation (bracket) |
| `src/components/brand/glyphs.generated.ts` | Lettering path data (THE / ESCAPE / DOOR, スヤ) | `scripts/brand/build-glyphs.mjs` (opentype.js, run outside the repo) | Glyph outlines from OFL fonts — see Fonts |

## Original brand art (created for this project)

| Path | What | How it was made | Licence |
|---|---|---|---|
| `src/components/brand/Mascot.tsx` | **Kado** the door-spirit — moods `idle` `peek` `wave` `shock` `sleepy` `cheer` `work`, `open` 0..1 door param, CSS idle loop | Hand-drawn SVG rig (door-head, ink body with keyhole belly, smoke-wisp tail); 2 visual review rounds (`/lab/brand/mascot`) | Original — created for this project |
| `src/components/brand/DoorIcon.tsx` | Cart door glyph, `open` 0..1 | Hand-drawn SVG | Original |
| `src/components/brand/collage.tsx` | Manga-panel collage inside the wordmark | Hand-built SVG (screentone, speed lines, open door with light) — no characters | Original |
| `public/textures/screentone-{light,mid,dense}.svg` | Tileable dot screens | `node scripts/brand/build-textures.mjs` | Original |
| `public/textures/paper-grain.webp` | Tileable paper grain (12 KB) | same script (seeded noise → sharp) | Original |
| `public/textures/speedlines.svg`, `speedlines-horizontal.svg` | Manga focus / speed lines | same script | Original |
| `public/textures/splat-1..6.svg` (+ `src/components/brand/splats.generated.ts`) | Six ink splats | same script (seeded) | Original |
| `src/components/fx/ArcMotif.tsx` + `src/lib/art/motifs.ts` | Per-arc motifs: smoke & talisman strips, wall rings & torn cloth, flame ribbons vs water brush-waves, waves & compass rose, spiral wind & leaves, ribbons/stars/record grooves, speed-lines | Deterministic SVG builders (seeded, no Math.random) | Original — no franchise symbols, crests or character silhouettes |

## Product sample imagery (SAMPLE — replace with real photos via /admin)

| Path | What | How it was made | Licence |
|---|---|---|---|
| `public/mockups/<slug>-front.webp`, `<slug>-back.webp` (1200×1500, ≈105 KB avg) + `-600.webp` (600×750, ≈47 KB) | 85 compositions for the 65 seed products: black oversized tees/hoodies on a colour block with original back prints, flat-lays for polaroids, posters, bookmarks, badges, stickers, keychains, katanas (LED variant lit), capes, an original beanie chibi figurine, earrings, hat, tote, stationery. Every image carries a "SAMPLE — replace with real photo" tag | `src/lib/art/**` builders → `npx -y tsx scripts/generate-mockups.mjs --standalone` (Playwright screenshot → sharp WebP). Deterministic + idempotent (`public/mockups/manifest.json` hashes) | Original — created for this project. Fan-inspired designs, not affiliated with any rights holder |
| `src/components/shop/TeeArt.tsx`, `ProductArt.tsx` | Same art as inline SVG for animated sections | same builders | Original |

Regenerate everything: `npx -y tsx scripts/generate-mockups.mjs --standalone --force` (no dev server needed). Server mode (`node scripts/generate-mockups.mjs`) renders through `/lab/mockup/<slug>/<side>` on the running dev server instead.

## Fonts

| Font | Used for | Source | Licence |
|---|---|---|---|
| Bangers (`scripts/fonts/Bangers-Regular.ttf`) | Wordmark `full`/`inline` lettering → paths | github.com/google/fonts | SIL OFL 1.1 |
| Spicy Rice (`scripts/fonts/SpicyRice-Regular.ttf`) | Badge + `stacked` wordmark lettering → paths (closest OFL match to the IG badge; compared against Rammetto One, Titan One, Chango, Bagel Fat One, Shrikhand and others) | github.com/google/fonts | SIL OFL 1.1 |
| Dela Gothic One (`scripts/fonts/DelaGothicOne-Regular.ttf`) | Mascot "スヤ" SFX → paths | github.com/google/fonts | SIL OFL 1.1 |
| Anton, Dela Gothic One, Noto Sans JP, JetBrains Mono, Caveat | Text inside the product art (site: next/font; generator: Google Fonts CSS) | Google Fonts | SIL OFL 1.1 |

Only fonts actually used by the build scripts are kept in `scripts/fonts/`.
