# DESIGN — "Manga Page Come Alive"

> One idea: **the site is a living manga volume.** Every scroll is a page turn. Every anime collection is a door into its arc. Ink, screentone and paper are the materials; electric yellow is the hype; the purple door-bracket wordmark is the signature.

## 1. Style (Part 02)
**Style:** Manga Neo-Brutalist Pop — thick ink panel borders, hard offsets (no soft drop shadows), flat colour blocks, halftone instead of gradients, type as image. One style only; nothing glassy, nothing soft-gradient, no generic glow.

Rules:
- Every content block lives in a **panel**: 3–6 px ink border, 10–16 px gutter, occasional diagonal gutter (clip-path) — panels never have rounded corners > 4 px.
- Depth comes from **hard offset shadows** (`6px 6px 0 ink`) and screentone, never blur.
- **Colour blocks** are flat: yellow, lavender, pink, purple, red — one dominant block per screen.
- **Halftone (#58)** replaces gradients: dot screens for shading, image overlays, hover states and section transitions.
- **Type is the image**: tall condensed caps stacked, rotated 90° down the edges, outlined and repeated behind products (#47).
- **Japanese subtitle** (Noto Sans JP) under every collection title and most H2s, small, tracked, 60% opacity.

## 2. Palette
Core five (90% of every screen):

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0B0B0F` | base background, borders, text on light |
| `--paper` | `#F4EFE6` | manga-paper panels, text on dark |
| `--volt` (electric yellow) | `#FFE14D` → hype `#FFE600` | primary CTA, highlights, accent words, price stickers |
| `--lav` (lavender) | `#C9B8FF` | colour blocks, product stages |
| `--door` (brand purple) | `#6D3BFF` | wordmark, links, focus ring, admin accent |

Support: `--pink #FFB8DE` (colour blocks, Beyond Anime) · `--hype #FF2D3D` (red — "ドン!", sale, LIVE dot; max one per screen) · screentones `--tone-1 #1A1A20` `--tone-2 #2B2B33` `--tone-3 #6E6E78` `--tone-4 #B9B5AC`.

Contrast: paper on ink 17.9:1 · ink on volt 15.6:1 · ink on lav 11.9:1 · paper on door 6.1:1 (AA body) · never volt text on paper.

### Per-arc accents (each collection door recolours the page, #18/#41)
| Arc | JP subtitle | Accent A | Accent B | Original motif |
|---|---|---|---|---|
| Jujutsu Kaisen | 呪術廻戦 | cursed indigo `#4B2BFF` | violet smoke `#A78BFF` | drifting cursed-energy smoke + talisman strips |
| Attack on Titan | 進撃の巨人 | wall stone `#A39780` | blood red `#C8102E` | concentric wall silhouettes + wind-torn cloth |
| Demon Slayer | 鬼滅の刃 | flame orange `#FF6A13` | water teal `#12A5A0` | flame ribbons vs water brush-waves |
| One Piece | ワンピース | sea blue `#1C6FE0` | straw yellow `#F2C230` | rolling waves + compass rose |
| Naruto | ナルト | shinobi orange `#FF7A00` | night navy `#1B2A4A` | spiral wind + leaf scatter |
| Beyond Anime | その先へ | pink `#FFB8DE` | paper `#F4EFE6` | bookish ribbons, stars, record grooves |
| (admin-added) Chainsaw Man / Solo Leveling / Haikyuu / Spy x Family | from admin | admin picks A/B | | default speed-lines |

Motifs are **original drawings** (SVG/canvas) — never character silhouettes, crests, symbols or logos from any franchise.

## 3. Type (Google Fonts via next/font — free)
| Role | Face | Notes |
|---|---|---|
| Display (tall condensed caps) | **Anton** | H1/H2, stacked vertical wordmarks, outline repeats; tracking −0.01em, line-height 0.86 |
| Manga impact / SFX | **Bangers** (Latin) + **Dela Gothic One** (JP SFX: ドン ゴゴゴ バン) | skewX(−8°), ink stroke + hard offset; decorative only (aria-hidden) |
| Body / UI | **DM Sans** | 16–18 px body, 1.55 line-height |
| Prices / labels | **JetBrains Mono** | prices, SKUs, counters, GSM numbers |
| Japanese subtitles | **Noto Sans JP** 500/900 | under every collection title |

Scale (fluid, clamp): display-xl 18vw (hero/footer), h1 clamp(56px, 11vw, 168px), h2 clamp(40px, 7vw, 112px), h3 28–40px, body 16–18px, label 11–12px mono uppercase tracked +0.14em. **Accent word per H2**: wrapped in `<em>` → volt highlighter block (or arc accent) behind the word, slight rotation.

## 4. Textures & SFX
- **Screentone** dot patterns (SVG pattern, 3 densities) on borders and shading; **paper grain** (tiny tiled noise WebP, 4% opacity) on paper panels.
- **Speed lines** (canvas) radiating from the focus point; intensity follows scroll velocity (Lenis velocity).
- **Ink splatter** SVGs (6 original shapes) for impact moments.
- **Onomatopoeia**: ドン! ゴゴゴ バン! BAM! SNAP! — big, skewed, ink-stroked, at most one per viewport, decorative.
- **Ticker bands (#37)**: yellow on ink and ink on lavender, ±3° rotation, e.g. "YOU ARE MY SPECIAL ✦ PICK YOUR ARC ✦ ドン ✦ CUSTOM MADE ✦".

## 5. Brand marks (recreations — replace with original files)
1. **Door-bracket wordmark (leads on this site):** a purple "[" bracket shaped like a door frame; inside it, mini manga panels (screentone, speed lines, a tiny door); "THE ESCAPE DOOR" in tall condensed caps beside it. `public/brand/wordmark.svg` + React component.
2. **Circle badge:** cream circle, chunky retro rust letters "THE ESCAPE DOOR" around/inside, small door glyph. `public/brand/badge.svg`.
Both marked `<!-- RECREATION — replace with original vector files -->`.

## 6. Mascot — "Kado" the door-spirit (original)
Chibi spirit whose head is a little wooden door (purple frame, yellow knob-eye glint), round ink body, stubby arms, a wisp tail like ink smoke. Moods (one SVG rig, swappable faces/arms): **idle** (bob), **peek** (door-head opens a crack, eyes glow — loader), **wave**, **shock** (ゴゴゴ — 404), **sleepy** (empty cart, "zzz" in katakana), **cheer** (success, confetti), **work** (admin, tiny headband + clipboard). Appears in: preloader, empty cart/wishlist, 404, success screens, admin empty states. Never on product pages.

## 7. Motion personality (Part 03)
**Punchy manga timing:** fast anticipation → hard impact → hold. Eases: `expo.out`/`power4.out` for entrances (0.6–1.1 s), `back.out(1.7)` for slams, springs (stiffness 400, damping 28) for UI; UI feedback 150–250 ms; nothing floaty. Impact frames: scale 1.06→1 + 2-frame shake + speed-line burst.
Every section: **entrance** (panel slam / split-text / ink wipe), **idle** (screentone drift, tickers, mascot bob), **exit** (panel slides away like a page turn).
`prefers-reduced-motion`: Lenis off, no pinning/scrubbing (sections stack normally), no shake, fades ≤ 200 ms, 3D replaced by poster, tickers static.

## 8. Section list (home) — technique numbers
| # | Section | Techniques |
|---|---|---|
| 0 | Preloader — ink brush draws the door-bracket, counter 0→100 in manga numerals, panel slam "ドン!", door opens | #01 #24 #06 #03 |
| 1 | Hero — panels assemble on diagonal gutters; R3F door portal opens on scroll and pulls camera through; vertical stacked "THE ESCAPE DOOR"; split-text headline; magnetic CTA | #22 #15 #04 #30 #47 #58 |
| 2 | Choose Your Arc — pinned horizontal scroll of collection doors; each door recolours the page with JP subtitle + original motif | #10 #11 #18 #41 #31("OPEN") |
| 3 | Drop of the Week — product theatre: tee on colour block, title repeated behind, price + Add | #51 #47 #66 #31("ADD") |
| 4 | Back-Print Reveal — scroll rotates the tee front→back | #63 #10 #64 |
| 5 | Squad Grid — 4 colour-blocked panels reshuffle on hover | #27 #29 #26 |
| 6 | Polaroid & Sticker Wall — draggable, "3 for ₹100" tilted sticker | #45 #52 #29 |
| 7 | Hoodie GSM Power Levels — GSM tiers as power levels, exploded fabric layers | #23 #17 #10 |
| 8 | Cosplay & Props — dark stage, katana LED glow sweep, Basic vs LED | #32 #40 #15 |
| 9 | Custom Forge teaser — a design slams onto a tee | #05 #66 |
| 10 | Fandom Partner Arc — fest timeline + "As seen at" ticker | #16 #37 #13 |
| 11 | Catch Us Live — upcoming stalls + "Remind me" form | #08 #71 |
| 12 | Beyond Anime — one door for bookish / Swiftie / HP / Pixar | #02 #18 |
| 13 | Instagram strip + Footer with giant outline "ESCAPE DOOR" | #37 #47 #28 |

Global: #20 Lenis · #31 cursor ("OPEN" on doors, "ADD" on products) · #53 page transition = manga page-turn / ink wipe · #58 halftone · speed lines tied to scroll velocity · #37 tickers · #29 tilt · reduced-motion path.
Catalogue: #08 stagger, #28 hover → back print, skeletons. Product page: #40 front/back, #66 add-to-cart → flies into door-shaped cart + "ADDED!" SFX. Success: #71 with mascot.

## 9. Layout
Mobile-first at 390 px. 12-col grid desktop (max 1440, 24 px gutters), 4-col mobile, 16 px side gutter, no horizontal page scroll. Section padding 120–180 px desktop, 72–96 px mobile. Asymmetric, editorial panel compositions; vertical wordmark rails on ≥ 1024 px.

## 10. States (Part 12)
Every async UI has designed **loading** (screentone skeleton shimmer), **empty** (mascot + one action), **error** (ink-splat panel + retry), **success** (SFX pop / #71). Feedback on every action < 100 ms. One signature interaction per flow; celebrations only for real milestones (order sent, custom request sent). Undo for destructive admin actions (#69 shred + toast undo).
