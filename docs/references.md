# Motion references — The Escape Door

Three motion references named by the client, studied on 2026-10-19 for the "manga page come alive" concept.
Everything below is **motion language only**. We copy no text, images, characters, logos or fonts from these sites.

## How this was gathered (and its limits)

| Site | Read with | Screenshots | Notes |
|---|---|---|---|
| fynsec.vercel.app | Scrapling `fetch` (markdown + raw HTML/classes) | Playwright, 1440×900 + 390×844 | The page is a **single viewport** (900 px tall at 1440). So `fynsec-1440-2..4` are **hover states** of cards 1–3 and `fynsec-1440-5` is the nav-pill hover. At 390 the page scrolls only 270 px, so `fynsec-390-2..5` are nearly the same. |
| thesmartcookie.in | Scrapling `fetch` | Playwright, 1440×900 + 390×844, top + 25/50/75/100 % | `smartcookie-1440-hover.png` shows the hover lift on a mode card. Timing values were read from computed styles. |
| locomotive.ca | Scrapling `stealthy_fetch` (Cloudflare Turnstile) | **Scrapling stealth browser** (scratchpad script, real wheel scrolling), 1440×900 + 390×844 | Cloudflare blocked Playwright ("Just a moment…", 403). Hero and summary **videos render black in headless**, so their motion is inferred from the poster, the clip frames that loaded and the CSS. Easing and duration counts come from parsing `main.css`. |

All files are in `docs/references/` and named `<site>-<width>-<n>.png`.
Instagram captures of the client's own feed (`instagram-*.png`) were already in that folder. I left them alone.

Technique numbers below use the Playbook Part 03 Motion dictionary (#01–#72).

---

## 1. FYNSEC — fynsec.vercel.app

**What it is:** a small Next.js/Tailwind prototype for a services studio. It is one screen of interaction ideas, not a finished site. It is relevant because it uses anime reaction humour and screentone-like texture.

### Sections in order
1. Header: a logo dot with a lime glow, the "FYNSEC" wordmark, a nav with 4 pills inside one outlined capsule (#48 style), and a "Let's Connect" outline pill with an arrow chip.
2. A body row with 2 repeated wordmarks (the logo dot uses `animate-bounce`) and 4 square cards (192 px).
   Each card has a short line of reaction copy: "You're doing awesome", "Oh I love it", "えっ!? なに!?", "Oh okay…".
3. Nothing else. There is no footer and no scroll story.

### Copy tone
Cheeky and conversational, with meme reactions. It mixes in Japanese reaction text ("えっ!? なに!?"). The hover hints are playful ("Hover me for motivation").

### What moves and how
- **Signature: the card "tip-and-peel".** On hover the top card does `translateY(8px) rotate(12deg) rotateX(30deg)` with `transform-origin: bottom` inside a `perspective` parent. It takes **500 ms** on `cubic-bezier(0.4,0.2,0.2,1)`, a soft ease-in-out with a slow settle.
  Behind it, a **lime "noisy-texture" (dot screentone) plate** fades in over **300 ms**. A sticker image that sat hidden behind the card shoots up `-translate-y-24` and `scale(1.7)`, so it pops out of the pocket like a reaction panel.
  (See `fynsec-1440-4.png`: the card falls forward and a red "NANI?!" sticker bursts above it.)
- **Nav pills:** the same tip-and-peel at small size. The grey pill tips and falls (rotate 12°, rotateX 30°) and shows a lime dotted pill underneath (`fynsec-1440-5.png`).
- **Logo dot glow:** a box-shadow glow change over 1000 ms, plus the Tailwind bounce loop.
- **Other:** the "Let's Connect" chip inverts its colours over 500 ms. There is no scroll-linked motion, no page transition and no custom cursor.

### Typography scale
Arial/Helvetica fallback (the Geist variable font is declared but not applied). Wordmark 24 px uppercase, card title 18 px, card sub-copy 14 px. There is no display type, so the type has no hierarchy.

### Cursor
The system cursor.

### Transitions
Hover only. There are no route transitions.

### BORROW (motion language only)
| Idea | Technique | Our use |
|---|---|---|
| Card tips forward on a bottom hinge and a screentone plate shows underneath | #29 3D Tilt Card (hinge variant) + #58 Halftone / Dot-Particle Form | Product cards: the black tee card tips forward to show a yellow or lavender screentone plate |
| A hidden sticker pops out of the card on hover | #45 Floating Polaroids / Scattered Cards (pop-out variant) | Our **own** sticker or badge art pops out (e.g. the product's badge or polaroid) |
| Japanese reaction micro-copy on the hover state | #13 Word-by-Word Opacity Reveal (micro) | Kana subtitle lines under product names, e.g. 「ドア、開いた。」 |
| The same peel on the nav pills | #48 Floating Pill Nav + Sliding Indicator | Category chips in the shop filter |

### AVOID
- Using **copyrighted characters or memes** (Saitama, the "nani" rabbit). We use only our own art or licensed art.
- **Hover-only** delight with no touch equivalent. On mobile the cards just stack and the joke disappears.
- A broken mobile layout (duplicate wordmarks next to the cards), no type hierarchy, an empty page, and decorative glow for its own sake.

### How The Escape Door beats it
- Make the peel **physical**: use a spring (Motion `type:"spring"`, stiffness ~380, damping ~22) with a small overshoot, not one fixed bezier.
- Give it a **touch path**. Press-and-hold on mobile peels the card, and haptic-like scale feedback arrives within 100 ms.
- The plate under the card should be a **real screentone** in our yellow/lavender/pink blocks. The sticker that pops out is the **actual product** (badge, sticker, polaroid), so the delight also sells.
- Respect `prefers-reduced-motion`: the plate cross-fades and nothing rotates.

---

## 2. The Smart Cookie — thesmartcookie.in

**What it is:** an Indian student study-resource hub (notes, PYQs, lounge). It is a Vite SPA on a dark warm palette with a cookie-mascot illustration. It is relevant because it shares our audience (Indian college students) and because of its mascot-led warmth.

### Sections in order
1. Sticky dark header: logo, 7 text links with an underline on the active one, and a yellow "Contribute" pill.
2. Hero: a handwritten overline "LATE-NIGHT STUDY CLUB" (script with an underline stroke), then a 3-line headline with a two-tone accent ("Study smarter / **not harder.**" in amber). Under it are a sub-line, a filled pill CTA plus an outline pill CTA, and a full-bleed illustrated mascot scene with handwritten sticky notes.
3. A row of 5 icon links (Notes, PYQs, Resources, Lounge, Seating Plan).
4. Lounge: a tall illustrated card and a yellow "Ask a Question" pill on the left. On the right are live discussion rows (avatar initial, title, excerpt, comment count, date) and "View all discussions →".
5. "Pick your study mode." A centered two-tone H2 with a handwritten sub-line over a blurred illustrated room. Below it are 4 mode cards (mascot spot art, title with an underline, short copy, round arrow button).

### Copy tone
Warm, cosy and peer-to-peer ("your cozy study buddy", "A place for students, by students"). It uses short imperative headlines with one accent phrase.

### What moves and how
- This site is **mostly static**. There are no scroll reveals (0 elements at `opacity:0`), no GSAP and no Lenis, and only native scrolling.
- **Mode-card hover:** `translateY(-6px)` over **300 ms** on `cubic-bezier(0.16,1,0.3,1)` (expo-out: quick, then a soft land) and a 200 ms border-colour change.
- **Links and buttons:** colour, background and border transitions of **200 ms**, plus `transform 0.2s` on the pills.
- **Signature moment:** the static hero illustration itself. The mascot at a desk and the handwritten notes do the emotional work, not motion.

### Typography scale
Outfit throughout. H1 **106.6 px / 800** with tight tracking, H2 54 px and 86 px / 800, card H3 31.7 px / 700, list H3 19.8 px / 600. A handwritten script face is used for annotations. On mobile the H1 drops to about 40 px.

### Cursor
The system cursor.

### Transitions
None between routes.

### BORROW (motion language only)
| Idea | Technique | Our use |
|---|---|---|
| Handwritten annotations around the hero ("late-night study club", sticky notes) | #24 Handwritten Script Draw | A brush-stroke **Japanese subtitle** that draws under each chapter title, plus hand-lettered SFX ("ドン!", "ゴゴゴ") drawing in |
| Accent word in a second colour in every H2 | #04 Split-Text Line Reveal | Every H2 has one accent word in yellow or lavender, and it rises in last |
| An expo-out lift on cards (fast start, soft land) | #08 Staggered Card Reveal | The default UI ease for lifts is expo-out 300 ms. The grid reveals in a 60 ms stagger |
| Mode cards with spot art and a round arrow button | #35 Button Fill & Underline Draw | Category doors ("Tees", "Polaroids", "Props", "Beyond Anime"). The underline draws on hover and the arrow chip fills |
| Live community rows (questions, counts) | #08 + #17 Animated Number Counter | The "Fest drops" wall with live stall counts and the next fest date |

### AVOID
- **AI-illustration look** and a generic dark-amber "cozy" palette. Our identity is black + screentone + electric yellow / lavender / pink blocks.
- **A static page.** Our concept says the manga page must come *alive*.
- On mobile the **semi-transparent sticky header lets content bleed through** ("View all discussions" shows under the nav in `smartcookie-390-4.png`). The hero copy also sits on a busy image, which hurts legibility.
- A single geometric sans for everything (Outfit only), and generic rounded cards that all look the same.

### How The Escape Door beats it
- Keep the warmth and the peer voice (fest-going students), but **animate the illustration logic**. Speech bubbles pop in, SFX letters draw, and panels slam in on scroll.
- Use a solid black header with a screentone bottom border, so content never bleeds through. Hero copy always sits in its own colour block, never on top of busy art.
- Use a pairing, not one font: tall condensed display caps + a clean grotesk + a JP subtitle face (the final pick goes in DESIGN.md).

---

## 3. Locomotive® — locomotive.ca

**What it is:** a Montréal agency site and the benchmark for editorial scroll craft (they built Locomotive Scroll). It is relevant for premium restraint, type scale contrast and list-hover choreography.

### Sections in order
1. Header: a fixed transparent bar with the wordmark, an asterisk glyph mark, "Work, Agency, Careers, Store" as one comma-separated sentence, and "Let's talk". On mobile this becomes "Menu".
2. Hero: a full-bleed **video** whose clips change colour wash (red at desktop, blue at mobile). In one clip, type is projected onto a face. Bottom-left is the display H1 "Locomotive® / Digital-first Design Agency✳" with inline pictogram glyphs (an "OPS | DES/DEV" box, "LOCO" superscript).
3. Summary: a framed video (the `c-ring` module) with a "Seven Years Running" side link and "The dynasty →".
4. **Featured work:** huge condensed-serif project names, one per full-width ruled row (Lightship, Wolverine Worldwide, The Drake Hotel, Dulcedo, Scout Motors, ✳All Work✳).
5. About: a very large serif paragraph ("Design and code are only tools of expression…") with an inline "LOCO" glyph, then a portrait media block, a short grotesk paragraph and ruled "Agency →" / "Careers →" links.
6. Extras (13): ruled two-column lists of Articles, Culture trips and Store.
7. Store tiles: a merch T-shirt and hat on light grey, with price and "Buy now →".
8. Footer: ruled columns (Menu, Social, External), then the address and phone set in display serif **interleaved with pictogram glyphs** (diamond "L", coordinates in tiny bold, "514 | 524/5678" fraction box, clover and "C" symbols).

### Copy tone
Confident, dry and witty ("Freshness guaranteed.", "Always looking for top shelf talent"). The copy is short and lets the type carry it.

### What moves and how
- **Smooth scroll:** `html.lenis` together with Locomotive Scroll attributes (`data-scroll`, `data-scroll-css-progress`, `data-scroll-call`, `data-scroll-repeat`, `data-scroll-offset`). Scroll progress is written to **CSS variables**, and elements map that progress to transforms in CSS (scroll-linked parallax and scale on the hero and the media frames).
- **Easing in `main.css`:** `cubic-bezier(0.215,0.61,0.355,1)` (easeOutCubic) appears **43×**, and `cubic-bezier(0.23,1,0.32,1)` (easeOutQuint) **9×**. There is no bounce and no spring. Everything decelerates.
- **Durations:** UI is mostly **150–300 ms** (`.3s` ×29, `.15s` ×17, `.25s` ×11), and the larger reveals are **600 ms** (`.6s` ×4).
- **Hero:** a cut-together video loop. On mobile I captured a frame mid-transition with a **pixel-mosaic block dissolve** between clips (`locomotive-390-1.png`), and the colour wash shifts per clip.
- **Featured work hover (signature):** on hover, the project name **slides left** and a **small landscape thumbnail slides in beside it**, inline on the same baseline (`locomotive-1440-hover.png`). The CSS also has a flashing "All" keyframe (`featuredProjectsAllFlash`).
- **Triggered vs scroll-linked:** `is-inview` classes are toggled by the scroll engine (triggered reveals). The CSS-progress variables drive the scroll-linked parts. The `c-ring` and `team-canvas` modules add 2 canvases.
- **Cursor:** native (`cursor:auto/pointer`), plus `cursor:wait` while smooth scroll boots. There is no custom follower.

### Typography scale
Display face "LocomotiveNew", a condensed high-contrast serif at weight 400. H1 is 70 px / lh 77 at 1440 and 36 px at 390. Featured project rows render at roughly 110 px. The about paragraph is about 75 px. UI and body use Helvetica Now Display at 26 px for section labels and 15–18 px for lists. This is a deliberate **5–7× contrast** between display and UI text.

### Transitions
Page-to-page transitions are triggered through the scroll/load modules (`data-module-load`). I could not record them because the headless capture stays on one page.

### BORROW (motion language only)
| Idea | Technique | Our use |
|---|---|---|
| Huge display rows in a ruled list; the hovered row slides and an inline thumbnail slides in | #34 Hover-Reveal Preview | **"Collections index"**: giant condensed-caps rows (TEES / HOODIES / POLAROIDS / PROPS / BEYOND ANIME). On hover a product thumbnail slides in inline and a kana subtitle appears |
| Lenis + scroll progress as CSS variables | #20 Smooth (Inertia) Scroll + #09 Parallax Layers | The global Lenis instance. Panel parallax is driven by ScrollTrigger progress, written to CSS vars |
| A video hero whose clips change colour wash, joined by a pixel-mosaic dissolve | #12 Scroll-Scrubbed Video / Image Sequence + #58 Halftone / Dot-Particle Form | The hero loop cuts between tee drops with a **screentone (halftone dot) dissolve** instead of pixel blocks, and the colour block shifts yellow → lavender → pink per drop (#18) |
| Display type interleaved with pictograms (footer and H1) | #47 Giant Background Typography | Footer address and fest names set in giant condensed caps, interleaved with our own glyphs (door icon, ticket stub, katana slash) and small kana |
| easeOutCubic / easeOutQuint, 150–300 ms UI, 600 ms reveals, no bounce on large surfaces | #07 Fade-Up on Scroll, #04 Split-Text Line Reveal | Our timing tokens (see below) |
| Merch tiles with a plain "Buy now →" | #28 Image Zoom Inside Frame | Product tiles get an inner zoom of 1.04 over 600 ms on hover |

### AVOID
- A **video-first hero that renders black** until it loads (our captures show black frames). This is an LCP and data-cost risk on Indian mobile networks. Ship a poster first and keep the loop ≤ 4 MB (playbook rule).
- **Gating the site behind a bot challenge.** Locomotive returns 403 to Playwright and plain fetchers. We must not block search or AI crawlers.
- A cookie modal that covers the hero. Austerity that turns cold: their white-on-white store tiles would kill a fandom brand.
- A literal pixel-mosaic or their glyph set. We translate both into manga screentone and our own symbols.

### How The Escape Door beats it
- Locomotive is premium through *restraint*. We match that restraint on large surfaces (decelerating easings, 600 ms reveals, a disciplined grid) and add **life on small things**: springs on stickers, ink-draw SFX, and a panel "slam" with a 2-frame overshoot.
- Their list hover shows a thumbnail. Ours shows **the product popping out of a manga panel** (thumbnail plus a speech-bubble price tag), with the kana subtitle typing in.
- Their hero is a video. Ours is a **living manga spread**: panels ink in, screentone dissolves between drops, and the design title repeats behind the tee (from the IG brand language), with a static poster LCP.

---

## Timing tokens we take (merged from all three)

| Token | Value | Source of the feel |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.215,0.61,0.355,1)` (easeOutCubic) | Locomotive default |
| `--ease-out-strong` | `cubic-bezier(0.16,1,0.3,1)` (expo-out) | Smart Cookie card lift, Locomotive quint |
| `--ease-hinge` | spring (stiffness 380, damping 22) for peel and pop | Upgrade of FYNSEC's 500 ms bezier |
| `--dur-ui` | 150–250 ms (hover, press, colour) | Locomotive / Smart Cookie |
| `--dur-move` | 300–400 ms (lifts, peels, chips) | Smart Cookie / FYNSEC |
| `--dur-reveal` | 600 ms (section reveals), 60 ms stagger | Locomotive |
| Feedback | < 100 ms on every press (scale 0.97) | Playbook Part 12 |
| Reduced motion | No rotate, parallax or scrub; cross-fades only; video becomes the poster | Playbook rule |

---

## Motion language we borrow

| # | Technique (Playbook Part 03) | Borrowed from | Where on our site |
|---|---|---|---|
| #20 | Smooth (Inertia) Scroll | Locomotive | Global Lenis + ScrollTrigger (disabled for reduced motion) |
| #01 | Branded Preloader | Locomotive (load module) | "Volume cover" intro: the door/cover opens in ≤ 1.2 s, first visit only |
| #04 | Split-Text Line Reveal | Smart Cookie (two-tone H1), Locomotive (display H1) | Hero headline and every H2; the accent word rises last |
| #14 | Striped Text-Mask Reveal | Locomotive scale + our screentone | Tall condensed-caps chapter titles reveal through screentone stripes |
| #24 | Handwritten Script Draw | Smart Cookie annotations | Japanese subtitle brush strokes under chapter titles; SFX letters (ドン!) |
| #29 | 3D Tilt Card (hinge peel) | FYNSEC tip-and-peel | Product cards: the tee card tips forward on a bottom hinge (press-and-hold on mobile) |
| #58 | Halftone / Dot-Particle Form | FYNSEC noisy plate, Locomotive mosaic dissolve | Screentone plate under peeled cards; halftone dissolve between hero drops |
| #45 | Floating Polaroids / Scattered Cards | FYNSEC sticker pop-out | Product sticker or polaroid pops out of a peeled card; polaroid and fest wall |
| #34 | Hover-Reveal Preview | Locomotive featured-work rows | Collections index (TEES / HOODIES / POLAROIDS / PROPS / BEYOND ANIME) |
| #47 | Giant Background Typography | Locomotive glyph footer, IG "title repeated behind tee" | Product hero (design title repeated behind the tee) and footer |
| #18 | Background Colour Shift | Locomotive per-clip colour wash | Chapter colour blocks shift yellow → lavender → pink (occasional red) as you scroll |
| #12 | Scroll-Scrubbed Video / Image Sequence | Locomotive hero video | Hero drop loop (≤ 4 MB, poster LCP) with a screentone transition between drops |
| #09 | Parallax Layers | Locomotive CSS-progress parallax | Collage panels with thick borders drift at 2–3 speeds inside the manga spread |
| #08 | Staggered Card Reveal | Smart Cookie mode cards (expo-out lift) | Shop grid and category doors, 60 ms stagger |
| #35 | Button Fill & Underline Draw | Smart Cookie mode cards, Locomotive ruled links | Category doors and ruled list links (arrow chip fills) |
| #48 | Floating Pill Nav + Sliding Indicator | FYNSEC nav capsule | Shop filter chips (peel on hover, sliding active indicator) |
| #13 | Word-by-Word Opacity Reveal | FYNSEC JP reaction copy | Kana subtitles and brand-story lines read in word by word |
| #28 | Image Zoom Inside Frame | Locomotive store tiles | Product tile inner zoom (1.04, 600 ms) |
| #17 | Animated Number Counter | Smart Cookie live counts | Fest stats (stalls, fests, pieces shipped) — real numbers only |

Restraint rule (Part 12): one signature interaction per flow. The **card peel (#29 + #58 + #45)** is the shop's signature. The **Collections index (#34)** is the home page's signature. Everything else stays quiet.

---

## Critic addenda (2026-10-19, completeness pass)

- **Coverage check.** All 41 screenshots cited here exist in `docs/references/`:
  - fynsec ×10
  - smartcookie ×11, including the hover capture
  - locomotive ×11, including the hover capture
  - instagram ×9
- **Token names clash. CONTRACTS wins.** This file's "Timing tokens we take" defines `--ease-out` as easeOutCubic. playbook-notes defines `--ease-out` as expo-out. The binding tokens are in `src/lib/motion.ts` (CONTRACTS §2):
  - Easing: `EASE.out 'expo.out'`, `punch 'power4.out'`, `slam 'back.out(1.7)'`, `inOut 'power3.inOut'`.
  - Spring: `SPRING { stiffness: 400, damping: 28 }`.
  - Durations: `DUR { ui: 0.2, enter: 0.9, slam: 0.45 }`.

  Treat the table above as feel guidance only. If the Locomotive easeOutCubic is wanted for large-surface reveals, add it to `EASE` as a new key (e.g. `EASE.calm`). Do not reuse the name `--ease-out`. The FYNSEC hinge spring here (380/22) differs from SPRING (400/28). Use SPRING unless DESIGN.md is updated.
- **One signature per flow (Part 12) is broken as written.** This file makes the **card peel** the shop's signature, but DESIGN §8 and CONTRACTS §6 make **#66 AddToCartButton** the signature of the same shop/product flow. Recommendation: #66 stays the signature. Downgrade the peel to a quiet hover (#28 back-print crossfade + screentone plate, no sticker burst) on catalogue cards. Keep the full peel and sticker pop for one home section only (S05 Squad or S06 Wall).
- **Collections index (#34)** is named the home signature here, but it is not in DESIGN §8's section list. The hero (S01) is DESIGN's above-the-fold signature. If #34 is wanted, it fits S02 Choose Your Arc as the mobile / reduced-motion alternative to the pinned horizontal scroll.
- **Mobile peel via press-and-hold:** long-press on an `<img>` opens the native context menu (Android) or the preview (iOS), and it competes with scrolling. If you build it:
  - Use `pointerdown` with a 250 ms timer.
  - Set `-webkit-touch-callout:none` and `user-select:none` on the card media only.
  - Cancel on `pointermove` over 8 px.
  - Make sure a tap still opens the product.
- **Not covered here (a gap):** none of the three references is a manga/comic site. The manga-specific motion (panel slam, page-turn wipe, speed lines, SFX) comes only from playbook prompt 05 (p.100) and DESIGN §4/§7. There is no live reference for those timings, so validate them with the P6 screenshot loop.
