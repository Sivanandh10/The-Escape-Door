# Playbook Notes — THE ESCAPE DOOR build cheat-sheet

Source: `docs/source/playbook.txt` (Website Motion & Design Playbook, Edition 2, Oct 2026, 116 pages).
**Citations:** `(p.N)` means the `=== PAGE N ===` marker in playbook.txt. The printed page number in the PDF footer is N−1.
**How to read this file:** anything the playbook states is given plainly with a page cite. Anything marked **[builder note]** is my own implementation advice for this stack (Next.js 16 / React 19 / Tailwind v4) and is **not** in the playbook. Anything marked **[proposal]** is a project decision that DESIGN.md/BRIEF.md may override.

---

## 0. Ten rules every build agent must follow (summary)

1. **One style, one palette (5 colours), one font pairing, one motion personality** (p.9). Never mix styles (p.6).
2. **Easing:** reveals `expo.out` (0.9–1.2s), panels/wipes `power3.inOut`, playful pops `back.out(1.4)`, hovers `cubic-bezier(.2,.8,.2,1)` 0.3–0.7s, exits `expo.in`. **Linear only for scrubbed scroll (`ease:"none"`) and infinite marquees** (p.71).
3. **Animate only `transform` and `opacity`** (clip-path/filter sparingly). Nothing longer than 1.4s except scroll-scrubbed. Stagger beats simultaneous. Entering = ease-out, leaving = ease-in (p.71).
4. **Every section: an entrance, an idle micro-motion, and an exit** (p.9, p.103).
5. **`prefers-reduced-motion`:** show the static **final state**, never a blank (p.75, p.102). Pinned sections disabled/simplified under 768px; hover effects only on `pointer:fine`; no custom cursor on touch; Lenis not on touch by default (p.43, p.102, p.105).
6. **Real HTML text**: split text keeps an `aria-label` with the full sentence; canvas/3D is never the only place a heading or price lives (p.89, p.105, p.74).
7. **No placeholders, no lorem ipsum, no grey boxes**; every image shares one art direction / style seed (p.9, p.84, p.102).
8. **Never** copyrighted characters, logos or brand names the client does not own; no fake reviews/ratings/claims; no secrets in code (p.9). (Critical for an anime-merch site — see §13.)
9. **Free tools only** (p.81). Host for this project = **Netlify free** (playbook lists Netlify free as an allowed alternative, p.6, p.81).
10. **Honesty rule:** never say a tool is installed, a test passed or a score was reached unless it actually ran (p.7).

---

## 1. Part 00 — Agent Operating Protocol (p.6–p.9)

| Phase | What (automatic) | Output / proof |
|---|---|---|
| P0 Environment & tools | Node ≥20, Git, Python ≥3.10; MCP servers from Part 05 (always Scrapling for web access) + claude-seo plugin | One line: installed / connected / skipped + why |
| P1 Brief inference | 4 business questions (goal · who + which device · 8-second message · one action). Classify industry. Run the 3D test (Part 04) → level none / Accent / Scroll-driven / Immersive | BRIEF.md (half a page) |
| P2 Art direction | Firecrawl search market + 3–5 competitors; Scrapling/Firecrawl read refs (structure, copy tone, sections). Pick ONE style (Part 02), 5-colour palette, one font pairing, closest refs (A–K), one recipe (Part 09), 6–12 technique numbers. Never mix styles | DESIGN.md + section list with technique numbers |
| P3 Content & SEO plan | Real copy (short headlines, **accent word in every H2**), page map, URL slugs, one primary keyword + intent per page, schema types per page, internal-link plan (`/seo plan`, `/seo content-brief`) | SITEMAP.md + copy in code |
| P4 Assets & motion | Source/generate every image, video, 3D model, icon, pattern (Part 06) with ONE style seed. Hero loop / product reveal / launch reel via Part 11; offer a 9:16 reel at hand-over. Compress everything. Record source + licence | ASSETS.md manifest |
| P5 Build in 3 rounds | R1 structure (semantic HTML, tokens, responsive) → R2 motion (Lenis + GSAP, 3D) → R3 polish (hover, micro-interactions, spacing). **One section at a time** | Working site on localhost |
| P6 Self-verify | Playwright screenshots at **390 / 768 / 1280 / 1920** and at **5+ scroll positions per pinned section**; compare with refs. DevTools perf trace, console, network. Fix until **60 fps, no overlap, no horizontal scroll, Lighthouse ≥ 90** | Screenshots + scores |
| P7 SEO · GEO · AEO | metadata, canonical, OG/Twitter images, sitemap.xml, robots.txt, JSON-LD, alt, heading hierarchy, answer blocks, internal links, CWV fixes; then `/seo audit`, `/seo technical`, `/seo schema`, `/seo geo`, `/seo images` on the preview URL; fix every Critical/High | SEO report + fixes |
| P8 Backend (only if needed) | Forms, waitlist, login, cart, CMS per Part 07 table. Validate, env secrets, rate-limit, confirmation | Endpoints tested end-to-end |
| P9 Ship & hand over | Free deploy (Cloudflare Pages default; **Netlify** or GitHub Pages alternatives), env vars, domain + HTTPS, GA4 + Microsoft Clarity, launch checklist (Part 08), then Search Console verify + sitemap, Bing Webmaster + IndexNow, Google Business Profile for local | Live URL + README next steps |

**Web-access rule (p.7):** Scrapling first for reading a specific site (stealth if bot-blocked); Firecrawl keyless for search and pages Scrapling can't read; Playwright for screenshots/interaction; Context7 for library docs. Respect robots.txt and site terms, never copy copyrighted text/images/logos, never collect personal data.

**Defaults (p.8):** Next.js App Router + TS + Tailwind · GSAP + ScrollTrigger (+ SplitText, Flip, DrawSVG) with Lenis synced via `gsap.ticker` · Motion (Framer Motion) for layout animations, nav pill, AnimatePresence · R3F + drei, Rapier physics, postprocessing finish; Spline when no modelling needed · next/font pairing (never Inter-only) · Lucide icons (Simple Icons for brand marks) · components restyled from 21st.dev / Magic UI / ReactBits / Aceternity, **max 2–3 sources per site** · images Unsplash/Pexels/Pixabay or Google AI Studio free tier with one style seed, WebP/AVIF via next/image · Forms: route handler + Zod + react-hook-form, data to Neon/Supabase, transactional email · Payments (India): **Razorpay** (UPI, cards); WhatsApp click-to-chat for local businesses · Analytics GA4 + Clarity.

**Modes (p.9):** New build = P0–P9 in order, show plan (P1–P3) in a few lines, build without waiting unless a fact is missing. Change request = smallest correct change, keep tokens + motion language, re-run P6 and affected SEO checks.

---

## 2. The "lakhs / crores" quality bar (p.9) — a site is not finished until all ten are true

1. **Clear point of view:** one style, one palette, one type pairing, one motion personality.
2. **A signature moment above the fold** (preloader, 3D, film, product theatre) that matches the brand.
3. **Choreographed motion:** every section has an entrance, an idle micro-motion and an exit; easing from Part 03.
4. **Real, art-directed imagery** — zero placeholders, zero stock clichés, zero lorem ipsum.
5. **Typography with contrast:** huge display vs tiny labels, accent words, tight tracking on display.
6. **Generous space:** 120–180px section padding on desktop; asymmetric editorial layouts.
7. **Fast:** LCP < 2.5s, INP < 200ms, CLS < 0.1 on mobile; 60fps on a mid-range laptop.
8. **Accessible:** semantic HTML, keyboard focus, alt text, contrast, prefers-reduced-motion path.
9. **Findable:** full technical SEO, schema, sitemap, OG, GEO answer blocks — done before launch, not after.
10. **Converts:** one primary action per page, visible within the first screen, repeated at the end.

**Never (p.9):** generic centred Inter template · placeholders or lorem · copyrighted characters, logos or brand names the client does not own · fake reviews, ratings or claims · secrets in code · skipping mobile or reduced-motion · claiming work you did not verify.

"AI default vs reference" fixes (p.2): never Inter/system font everywhere at one weight; never everything centred with equal spacing (use 12-col asymmetric grids, image overlapping text by ~80px, section padding 160px desktop); never random purple-blue gradients (3–5 colour palette from the product, "no gradients except where specified"); never fade-in on everything at once (choreography: preloader → hero split-text → staggered sections → pinned story); never default linear/ease ("Reveals: expo.out 1s; hovers: cubic-bezier(.2,.8,.2,1) .6s"); always Lenis + ScrollTrigger.

Level 3 (award-level) performance budget (p.103): **LCP < 2.5s, total JS < 250KB gz (excluding 3D), 60fps on M1 / mid Android.** Explain the choreography timeline per section before the code.

---

## 3. Part 02 — Style directory (p.27–p.31)

### 3.1 The 16 styles (p.28–p.29)

| # | Style | Look (playbook wording) | Use for |
|---|---|---|---|
| 1 | Editorial Heritage Luxury | Ivory + maroon + gold, serif display with italic accent, arches, gold hairlines, rich photography, slow 1–1.4s motion | Jewellery, sarees, weddings, hotels, heritage |
| 2 | Warm Editorial Minimal | Cream paper, navy ink, grotesk + italic serif mix, mono micro-labels, lots of air, rounded soft cards | Portfolios, studios, consultants |
| 3 | Playful Candy Pop | Flat saturated colour per product, rounded heavy type, wavy edges, bouncy back.out easing, stickers and emojis | Food, drinks, kids, D2C, snacks, cafés |
| 4 | Cinematic Story Scroll | Full-screen film frames scrubbed by scroll, minimal white UI, script words, crosshair cursor, very few elements per screen | Real estate, architecture, automotive, travel, brand films |
| 5 | Dark Product Theatre | Near-black stage, one hero product lit like a studio shot, floating ingredients, one neon accent colour per product | Beverages, gadgets, cosmetics, sneakers |
| 6 | Art-Historic Surreal | Classical paintings/architecture + modern products, 3D or collage, ironic, neutral UI | Launch events, campaigns, agencies |
| 7 | Glassmorphism | Frosted translucent panels over vivid blobs/photos, thin light borders, soft shadows | Fintech, dashboards, photo overlays |
| 8 | **Neo-Brutalism** | **Thick black borders, hard offset shadows, clashing flat colours, raw grotesk type, no blur** | **Startups, Gen-Z brands, creative tools, events** |
| 9 | Bento Grid Clean | Rounded tiles of mixed sizes, each one idea, light grey canvas, crisp sans | SaaS features, specs, portfolios |
| 10 | Dark SaaS Glow | Black canvas, subtle grid lines, gradient glows, spotlight hover, gradient-text headlines | Dev tools, AI, B2B SaaS |
| 11 | Swiss / International | Strict grid, huge numbers, red/black/white, flush-left Helvetica-style, zero decoration | Architecture, museums, consultancies |
| 12 | Claymorphism | Puffy soft 3D shapes, inner shadows, pastels, cute 3D icons | Kids, edtech, wellness |
| 13 | Retro / Y2K | Chrome text, pastel gradients, sparkles, pill buttons, pixel/old-OS windows | Music, **fashion drops, Gen-Z campaigns** |
| 14 | Classical Collage Pop | Cut-out classical art on flat saturated colour, witty serif lines, **halftone**, cloth and cloud transitions | Agencies, studios, campaigns |
| 15 | Street Food Bold | Cream base, chunky condensed black type, red/orange accents, appetising cut-outs, exploded food | Restaurants, snacks, cafés |
| 16 | Soft Luxe Beauty | Blush and cream, delicate italic serif, product born from its ingredient, macro textures, slow easing | Skincare, perfume, wellness, bridal |
| 17* | Maximalist Collage | Huge Didone type overlapping photos, **cut-outs, stickers, circle badges, layered and busy but controlled** | **Fashion, magazines, art, music artists** |

*The book says "16 named styles" but the tiles list 17 (Maximalist Collage is the extra). There is **no "manga" or "comic" style** in Part 02.

### 3.2 Recommendation for "Manga page come alive": **Neo-Brutalism** (adapted to the brand's manga language) [proposal]

Why it fits: the brand language from Instagram (thick-bordered collage panels, diagonal splits, clashing flat colour blocks of electric yellow + lavender/pink + red on black, outline wordmarks, ticker bands, stickers) maps directly onto Neo-Brutalism's "thick black borders, hard offset shadows, clashing flat colours, raw grotesk type, no blur" and its "Gen-Z brands … events" use case (p.28). Manga panel borders = brutalist borders; screentone = halftone texture (#58). Runner-up: **Maximalist Collage** (fashion/stickers/circle badges/layered). Do **not** mix the two: take Neo-Brutalism as the style and borrow only *components* (stickers #52, circular badge #46, polaroids #45), not Maximalist's Didone type.

Closest playbook precedent for the comic feel: **Build prompt 05 "Web-Slinger — Comic 3D Scroll" (p.100)**: MeshToonMaterial + gradientMap, bold outlines, **halftone pass**, slight chromatic aberration, high-contrast grade; HTML panels over the canvas; **speed lines and halftone intensify with Lenis velocity**; **onomatopoeia in a hand-drawn outlined display font on back/elastic ease** ("WHOOSH", "THWIP!" bursts); static comic-panel fallback on reduced-motion / low power; lighter post on mobile; and an explicit **IP NOTE: design an ORIGINAL hero, do not use the franchise's name, logo, emblem or suit** — apply the same rule to every anime property here.

**Neo-Brutalism tokens for this site [proposal — DESIGN.md is final]** (structure = the Part 02 token block, p.31; only colours/fonts swapped):

```css
:root{
  /* COLOUR — 5 roles only (60% bg / 30% ink-surface / 10% brand+accent, p.31) */
  --bg:#0a0a0a;      /* black base */
  --ink:#f4f1ea;     /* paper white (manga page) */
  --brand:#ffe600;   /* electric yellow */
  --accent:#c9b6ff;  /* lavender (pink #ff9ec7 = per-product colour block only, via #18/#41) */
  --muted:#8c8c8c;   /* screentone grey (borders, halftone) */
  /* red (#e10600-ish) = occasional: sale/sold-out/error only — not a 6th role */
  --f-display: clamp(3rem, 7vw, 7.5rem);  --f-h2: clamp(2.2rem, 4.5vw, 4.5rem);
  --f-h3: clamp(1.4rem, 2vw, 2rem);       --f-body: clamp(1rem, 1.05vw, 1.125rem);
  --f-label: .75rem; /* uppercase, letter-spacing .2em */
  --lh-tight:.95; --lh-body:1.6; --track-display:-.03em;
  --s1:8px; --s2:16px; --s3:24px; --s4:32px; --s5:48px; --s6:64px; --s7:96px; --s8:128px; --s9:160px;
  --section-y: clamp(96px, 12vw, 180px); --container:1320px; --gutter: clamp(20px, 4vw, 48px);
  /* SHAPE — brutalist: hard offset shadow, no blur */
  --border: 3px solid var(--ink);  --shadow-hard: 6px 6px 0 var(--brand);
  --r-sm:0; --r-md:4px; --r-lg:8px; --r-pill:999px;
  /* MOTION (verbatim from p.31) */
  --ease-out: cubic-bezier(.16,1,.3,1);      /* expo.out → reveals */
  --ease-io:  cubic-bezier(.65,0,.35,1);     /* power3.inOut → panels, wipes */
  --ease-back:cubic-bezier(.34,1.56,.64,1);  /* back.out → playful pops */
  --d-fast:.3s; --d-base:.6s; --d-slow:1.1s; --stagger:.08s;
}
@media (prefers-reduced-motion: reduce){ *{animation:none!important;transition:none!important} }
```

**Typography (p.30):** "Brutal" pairing = Archivo Black / Space Grotesk 700 display + Space Grotesk 400 body + IBM Plex Mono accent. The brand uses **tall condensed caps stacked/rotated vertically** → use the "Product punch" display face **Anton / Oswald 700** (p.30) for the condensed caps with **Space Grotesk 400** body/UI and **IBM Plex Mono / Space Mono** micro-labels [proposal]. Max 2 families + mono labels; `font-display:swap`; preload the display font (p.105). Japanese subtitles need a JP-capable Google Font (e.g. Noto Sans JP / Dela Gothic One) — subset it [builder note, not in playbook].

**Accent-word trick (p.30):** one word of every heading in italic serif *or a different colour*. Tell the code: "In each H2, wrap the last word in `<em>`". For this style, style `<em>` as electric-yellow fill or outline stroke (`-webkit-text-stroke`), not italic serif [proposal].

**Layout rules (p.31):** 12-col grid, content in 7/5 or 8/4 splits; 120px headline next to 12px caption; 120–180px section padding desktop; one idea per screen in hero/story; images bleed off the edge or overlap text at least once per page; micro-labels above headings ("01 — ABOUT"). **Colour rules (p.31):** 60/30/10; pull colours from the photography; a dark (here: light/colour-block) contrast section once or twice per page for rhythm; **one background colour per product in product sliders**; body text contrast ≥ 4.5:1.

**Style conflicts to manage:** Neo-Brutalism says **no blur** → keep #44 Glassmorphism, #54 Blur-In and #72 Glow Mesh out of the main site, or confine #72 to app-like flows (checkout/order status) per Part 12 [proposal]. #32 Spotlight is a Dark SaaS idiom — adapt it as a screentone/yellow spotlight on product grids, not a purple glow.

---

## 4. Part 03 — Easing, timing, motion personality (p.31, p.71)

| Curve | Value | Use |
|---|---|---|
| Linear — AVOID | `cubic-bezier(0,0,1,1)` | Only scrubbed scroll (`ease:"none"`) and infinite marquees |
| **expo.out ★ reveals** | `cubic-bezier(0.16,1,0.3,1)` | Text reveals, fade-ups, images. GSAP `"expo.out"` |
| power3.inOut — panels | `cubic-bezier(0.65,0,0.35,1)` | Curtains, wipes, page transitions, accordions |
| back.out — playful | `cubic-bezier(0.34,1.56,0.64,1)` | Product pops, stickers. GSAP `"back.out(1.4)"` |
| Hover ease | `cubic-bezier(0.2,0.8,0.2,1)` | All hover transitions (.4–.7s) |
| expo.in — exits | `cubic-bezier(0.7,0,0.84,0)` | Elements leaving the screen |

**Timing cheat-sheet (p.71):**

| Interaction | Duration | Ease | Stagger |
|---|---|---|---|
| Hover colour / scale | 0.3–0.6s | cubic-bezier(.2,.8,.2,1) | — |
| Button fill | 0.5s | power3.inOut | — |
| Text line reveal | 0.9–1.2s | expo.out | 0.05–0.08s per line/word |
| Card grid reveal | 0.8–1s | power3.out | 0.08–0.12s |
| Image clip reveal | 1.1–1.4s | expo.inOut | 0.12s |
| Preloader exit | 0.8–1s | expo.inOut | — |
| Page transition | 0.5–0.8s | power3.inOut | — |
| Scroll-scrubbed anything | follows scroll | `ease:"none"`, `scrub:0.5–1` | — |
| Infinite float | 2–4s yoyo | sine.inOut | offset each item |
| Elastic snap-back | 1–2s | elastic.out(1,.3) | — |

**Golden rules (p.71):** animate only transform + opacity (clip-path/filter sparingly) · nothing longer than 1.4s except scroll-scrubbed · stagger > simultaneous · entering = ease-out, leaving = ease-in · respect prefers-reduced-motion.
**Master-prompt motion rules (p.102):** Lenis + ScrollTrigger (#20); plugins SplitText, Flip, DrawSVG; reveals expo.out 1–1.2s stagger 0.06–0.1; hovers cubic-bezier(.2,.8,.2,1) .6s; never linear except scrub/marquee; desktop gets cursor/hover effects, mobile simplified (**no pin-heavy sections under 768px, no custom cursor on touch**); reduced motion = show final state, no movement.
**Entrance/idle/exit rule (p.9, p.103):** "every section has an enter, an idle micro-motion, and an exit."
**Motion personality per style:** Heritage = slow 1–1.4s (p.28, p.93); Candy Pop = back.out bouncy (p.28, p.93); Beauty = slow expo.out (p.96). For Neo-Brutalism/manga there is no stated speed → **[proposal]** snappy: reveals 0.6–0.9s expo.out, pops back.out(1.4–2), panel wipes power3.inOut 0.5–0.8s, hard `steps()` for "printed/inked" beats (as #70 uses `steps(24)`).
**Motion restraint (p.77):** slow zoom-in · camera pan · floating · subtle parallax · auto-rotate; "too much motion reads as messy".
**UI durations (Part 12, p.112):** 150–400ms for UI, feedback within 100ms.

---

## 5. Motion dictionary — all techniques (#01–#72)

Legend: ★ = client-requested primary, ☆ = secondary list, · = defined but not requested. Difficulty ●○○ easy / ●●○ medium / ●●● advanced. Stack names are the playbook's.

**Global [builder note]:** register plugins once (`gsap.registerPlugin(ScrollTrigger, SplitText, Flip, DrawSVGPlugin, Draggable, TextPlugin)`; all are in the free `gsap` npm package per p.78 "Now 100% free incl. SplitText, DrawSVG, MorphSVG, Flip"). In React 19 client components use `@gsap/react`'s `useGSAP` (or `gsap.context()` + `revert()` on unmount) so ScrollTriggers die with the component; call `ScrollTrigger.refresh()` after fonts/images load. Wrap every motion branch in `gsap.matchMedia()` with `(prefers-reduced-motion: no-preference)` and `(min-width: 768px)` conditions so the reduced/mobile fallbacks from the playbook are automatic.

### 5.1 Page-load & intro (p.33–p.36)

**☆ #01 Branded Preloader** (aka intro screen, splash loader) ●●○ (p.33). Full-screen brand moment while assets load; panel slides up like a curtain to reveal the hero. Stack: GSAP timeline, CSS. How: fixed full-screen div (high z-index); logo + progress (real: count loaded images; fake: 0→100 over ~1.5s); when done animate panel `yPercent:-100` and start hero.
```js
const tl = gsap.timeline();
tl.to(".loader-bar", {scaleX: 1, duration: 1.4, ease: "power2.inOut"})
  .to(".loader", {yPercent: -100, duration: 0.9, ease: "expo.inOut"})
  .from(".hero h1 .line", {yPercent: 110, stagger: 0.08, duration: 1, ease: "expo.out"}, "-=0.4");
```
Pitfalls: **never longer than 2.5s (p.33); checklist says ≤ 2s (p.105) → use ≤ 2s; first visit only (sessionStorage flag)**. Must not block LCP [builder note: render hero HTML underneath; preloader is an overlay]. Spinner alternative in Part 12: "storytelling loader that matches the brand" (p.112). Logo sting for the preloader can come from the Part 11 pipeline (p.110).

**☆ #02 Circle Reveal** (clip-path iris, portal open) ●○○ (p.33). Coloured screen with a hole growing from centre. Stack: CSS clip-path + GSAP or Motion. Overlay with `clip-path: circle(0% at 50% 50%)` on the NEW content → `circle(150% at 50% 50%)`; pair with content scale 1.1→1.
```js
gsap.fromTo(".page", {clipPath: "circle(0% at 50% 50%)"},
  {clipPath: "circle(150% at 50% 50%)", duration: 1.4, ease: "expo.inOut"});
```
[proposal] the "Escape Door" opening / "Beyond Anime" door portal.

**☆ #03 Curtain / Shutter Reveal** (split panels, door open) ●○○ (p.34). Two+ panels slide away. Left `xPercent:-100`, right `xPercent:100`, `duration:1.2, ease:"power4.inOut"`; 4–6 vertical strips with stagger for a shutter version. [proposal] literal "door" opening for the brand; manga-panel strips.

**★ #04 Split-Text Line Reveal** (masked text rise) ●○○ (p.34) — "the #1 most used premium-site effect". Stack: GSAP SplitText (free) or SplitType. Split into lines/words/chars; wrap each in an `overflow:hidden` mask; animate `yPercent:110→0`, stagger 0.03–0.08s, `expo.out`.
```js
const split = SplitText.create("h1", {type: "lines,words", mask: "lines"});
gsap.from(split.words, {yPercent: 110, stagger: 0.05, duration: 1, ease: "expo.out"});
```
Prompt: "split-text masked line reveal on all H1/H2 (stagger 0.05s, expo.out)". Pitfalls: keep real text in DOM + `aria-label` with the full sentence on the split element (p.89, p.105). [builder note] split after fonts load (`document.fonts.ready`) or lines break wrong; revert split on resize. Vertical stacked caps: split by chars and rise each.

**☆ #05 Logo Assemble / Product Orbit** (fly-in composition) ●●○ (p.35). 3–5 transparent product PNGs fly in from corners (x/y far outside, rotation ±30°, scale .6), stagger 0.1, `back.out(1.4)`, 1.3s; then infinite float y ±8–10px, `sine.inOut` 2s yoyo.
```js
gsap.from(".orbit img", {x:(i)=>[-600,600,-600,600][i], y:(i)=>[-400,-400,400,400][i],
  rotate:30, scale:.6, stagger:.1, duration:1.3, ease:"back.out(1.4)"});
gsap.to(".orbit img", {y:"+=10", repeat:-1, yoyo:true, duration:2, ease:"sine.inOut"});
```
[proposal] merch (tee, katana, polaroid, badge, figurine) orbiting the wordmark.

**★ #06 Percentage Counter Loader** (0→100) ●○○ (p.35). Huge number counts 0→100 in a corner with a thin bar. Tween `{v:0}`→`{v:100}`, write `Math.round(v)`; **use `tabular-nums`** so digits don't jump; on complete run the page reveal.
```js
const o = {v: 0};
gsap.to(o, {v: 100, duration: 1.8, ease: "power2.inOut", onUpdate: () => el.textContent = Math.round(o.v)});
```
Same ≤2s / first-visit rule as #01. Recipes use it as loader for portfolio, product launch, automotive (p.94–p.96).

**· #60 Particle Formation Morph** — listed under Load, see §5.5.

### 5.2 Scroll-driven motion (p.37–p.48) — "70% of what makes the reference sites feel premium"

**· #07 Fade-Up on Scroll** ●○○ (p.37). y 40→0, opacity 0→1, 0.8–1s `power3.out`, ScrollTrigger `start:"top 85%"`; run once for calm sites, reverse for playful ones. Baseline for every section.

**★ #08 Staggered Card Reveal** (cascade) ●○○ (p.37). Grid children fade-up with stagger 0.08–0.15s; **keep total under ~0.8s**.
```js
gsap.from(".grid > *", {y:60, opacity:0, stagger:0.1, duration:.9, ease:"power3.out",
  scrollTrigger:{trigger:".grid", start:"top 80%"}});
```
Motion alternative: `staggerChildren`. [builder note] for long product grids use `ScrollTrigger.batch` so off-screen rows don't wait on the first row. DRIFT streetwear prompt variant (p.101): 3D flip-in `opacity 0, y 50, rotateX -40, transformPerspective 1000`, stagger.

**☆ #09 Parallax Layers** ●○○ (p.38). Different speeds (bg .2, mid .5, fg 1); `yPercent` with `scrub:true`, `ease:"none"`; **images need 120% height so edges never show**; keep subtle 10–20%.
```js
gsap.to(".layer-bg", {yPercent:-15, ease:"none",
  scrollTrigger:{trigger:".hero", start:"top top", end:"bottom top", scrub:true}});
```

**★ #10 Pinned / Sticky Section** ●●○ (p.38). Section sticks while scroll animates inside. CSS-only: parent tall (300vh), child `position:sticky; top:0; height:100vh`. Or ScrollTrigger `pin:true`, `end:"+=200%"`; map progress to inner timeline with scrub.
```js
gsap.timeline({scrollTrigger:{trigger:".story", pin:true, start:"top top", end:"+=250%", scrub:1}})
  .to(".step-1",{opacity:0}).from(".step-2",{opacity:0, y:40});
```
Pitfalls: **disabled/simplified under 768px** (p.102, p.105); verify with screenshots at 5+ scroll positions per pinned section (p.6); no overlaps at any scroll position (p.74). [proposal] a "turn the manga page" story chapter.

**★ #11 Horizontal Scroll Section** ●●○ (p.39). Pin section; translate track by `-(trackWidth − viewportWidth)`; `scrub:1`; add a progress bar.
```js
gsap.to(track, {x:()=>-(track.scrollWidth - innerWidth), ease:"none",
  scrollTrigger:{trigger:".h-section", pin:true, scrub:1, end:()=>"+="+track.scrollWidth, invalidateOnRefresh:true}});
```
Pitfalls: `invalidateOnRefresh:true` + function values for resize. Mobile: **native horizontal scroll / swipe cards** instead of pin (AURELLE prompt p.101). [proposal] fest/pop-up timeline (Thomso → Fluxus → Alcheringa) or "Popular picks" row.

**☆ #12 Scroll-Scrubbed Video / Image Sequence** (Apple-style) ●●● (p.39). Export 80–200 frames with ffmpeg; draw frame on `<canvas>` by progress; preload; WebP ~60–120KB each; pin canvas section; overlay text steps that fade per range.
```js
// ffmpeg -i film.mp4 -vf "fps=24,scale=1600:-1" frames/%03d.webp
const f = {i:0};
gsap.to(f, {i:149, snap:"i", ease:"none",
  scrollTrigger:{trigger:".seq", pin:true, end:"+=300%", scrub:.5},
  onUpdate:()=>ctx.drawImage(imgs[f.i],0,0,cv.width,cv.height)});
```
Limits: **≤150 frames, ≤120KB each, preloaded progressively** (p.105); frame index = `Math.round(progress*(total-1))`, loading screen with % (p.100); mobile fallback video / poster, no heavy scrubbing on reduced-motion (p.100, p.103). Keep camera static in AI videos used for sequences (p.82).

**☆ #13 Word-by-Word Opacity Reveal** ●○○ (p.40). Split paragraph into words, all at opacity .15, scrub to 1 with stagger.
```js
const w = SplitText.create(".manifesto",{type:"words"}).words;
gsap.fromTo(w,{opacity:.15},{opacity:1, stagger:.1, ease:"none",
  scrollTrigger:{trigger:".manifesto", start:"top 75%", end:"bottom 40%", scrub:true}});
```
[proposal] brand manifesto ("every fandom needs a door").

**☆ #14 Striped Text-Mask Reveal** ●●○ (p.40). Giant text revealed through horizontal stripes; image/video through letters (`background-clip:text`); each strip `clip-path: inset(0 100% 0 0)→inset(0 0 0 0)` stagger .08, 1s expo.out; `mix-blend-mode:difference` for extra bold.
```css
.mask-text{font:900 18vw/0.9 "Anton";background:url(view.jpg) center/cover;-webkit-background-clip:text;color:transparent}
```

**★ #15 Image Scale-to-Fullscreen** ●●○ (p.41). Small rounded image grows to full-bleed on scroll, becomes next chapter's background. Pin; animate clip-path inset (or width/height) to 100vw×100vh, radius→0; fade headline in at end.
```js
gsap.fromTo(".media",{clipPath:"inset(30% 25% round 24px)"},{clipPath:"inset(0% 0% round 0px)", ease:"none",
  scrollTrigger:{trigger:".media-wrap", pin:true, end:"+=150%", scrub:true}});
```
[proposal] a single manga panel expanding into a full-screen spread / fest stall photo.

**★ #16 Scroll Progress Timeline** ●○○ (p.41). Vertical line `scaleY 0→1` (transform-origin top) scrubbed; each item gets its own ScrollTrigger toggling `.active`; year labels can be huge and sticky.
```js
gsap.to(".tl-fill",{scaleY:1, ease:"none", scrollTrigger:{trigger:".tl", start:"top 60%", end:"bottom 60%", scrub:true}});
document.querySelectorAll(".tl-item").forEach(el=>ScrollTrigger.create({trigger:el, start:"top 60%", toggleClass:"active"}));
```
[proposal] college-fest collabs timeline; order-status tracker.

**★ #17 Animated Number Counter** ●○○ (p.42). Trigger once on enter; tween number; write with `toLocaleString()`; `power3.out`, 2s.
```js
gsap.to(o,{v:+el.dataset.count, duration:2, ease:"power3.out",
  scrollTrigger:{trigger:el, start:"top 85%"},
  onUpdate:()=>el.textContent=Math.round(o.v).toLocaleString()+"+"});
```
Pitfalls: **every figure must be real and signed off by the client** (p.90 launch checklist; "no fake claims" p.9). [builder note] use `toLocaleString("en-IN")` for ₹/lakh grouping; reserve width with `tabular-nums` to avoid CLS.

**★ #18 Background Colour Shift** ●○○ (p.42). Each section `data-bg="#hex"`; ScrollTrigger onToggle tweens body background (0.8s); also switch text colour for contrast.
```js
document.querySelectorAll("[data-bg]").forEach(s=>ScrollTrigger.create({trigger:s, start:"top 50%", end:"bottom 50%",
  onToggle:self=>self.isActive && gsap.to("body",{backgroundColor:s.dataset.bg, duration:.8})}));
```
[proposal] black → yellow → lavender → pink chapters; contrast ≥ 4.5:1 for each pair (p.31).

**☆ #19 Stacking Cards** ●●○ (p.43). Each card `position:sticky; top:calc(10vh + var(--i)*24px)`; scrub previous card scale 1→.92, brightness 1→.7 as the next arrives.
```js
cards.forEach((c,i)=> i<cards.length-1 && gsap.to(c,{scale:.92, filter:"brightness(.7)",
  scrollTrigger:{trigger:cards[i+1], start:"top bottom", end:"top 10%", scrub:true}}));
```
[proposal] stacked manga pages / collection chapters.

**★ #20 Smooth (Inertia) Scroll — Lenis** ●○○ (p.43). Lenis (3KB) connected to the GSAP ticker; **lerp 0.08–0.12; never on touch devices by default**.
```js
const lenis = new Lenis({lerp: 0.1});
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
```
Provider pattern (p.99): `new Lenis({ lerp:0.1, smoothWheel:true })`, `ScrollTrigger.refresh()` after mount; deliver a `LenisProvider`. "Lenis — sync with ScrollTrigger or they fight" (p.75). Reduced motion: no Lenis [builder note]. Use `lenis.scrollTo` for dot nav / anchors (p.99). Lenis velocity can drive marquee speed (p.101) and comic speed lines (p.100).

**☆ #21 Shared-Element Flight** (FLIP) ●●● (p.44). One product element travels from section A to its slot in B while scrolling. Single fixed/absolute element; measure start/end rects; scrub x,y,scale,rotation — GSAP Flip.
```js
const s = Flip.getState(".cup");
document.querySelector(".slot").appendChild(cup);
Flip.from(s,{ease:"none", scale:true,
  scrollTrigger:{trigger:".explore", start:"top bottom", end:"top 30%", scrub:true}});
```
Pitfall: never read getBoundingClientRect every frame; cache measurements (p.75). [proposal] hero tee flies into the "Shop" grid card.

**★ #22 Scroll-Driven 3D Camera** (3D flythrough) ●●● (p.44). Real 3D scene where scroll moves the camera along a path. Stack: Three.js / R3F + drei `ScrollControls`, or Spline. Build scene (Spline / Blender → .glb); camera path `CatmullRomCurve3`; map progress 0→1 to point on curve; lerp; overlay HTML text panels per chapter.
```jsx
function Rig(){ const scroll = useScroll(); const curve = useMemo(()=>new CatmullRomCurve3(points),[]);
  useFrame(({camera})=>{ const p = curve.getPoint(scroll.offset);
    camera.position.lerp(p,.1); camera.lookAt(curve.getPoint(Math.min(scroll.offset+.02,1))); });
  return null }
```
Variant used in prompts 05/06 (p.100): one page-spanning ScrollTrigger `scrub:1` drives progress; camera at `curve.getPointAt(progress)`, lookAt further along; lerp in useFrame. Level = Scroll-driven (p.73). Perf: lazy-load canvas, poster immediately, DPR [1,2] clamp lower on phones, shorter camera paths on mobile, pause when off-screen (p.75). Text stays HTML (p.74). [proposal] "Beyond Anime" door walk-through or a manga-panel corridor; desktop only, poster on mobile.

**★ #23 Exploded View (Deconstruct / Assemble)** ●●● (p.45, pipelines p.85). Product separates into labelled parts on scroll, then re-assembles.
- Method A (2D, easiest, best control): each layer a transparent PNG, stack absolutely, scrub each layer `y` by `(index − middle) × gap`.
- Method B (video): AI video first frame = assembled, last = exploded → frames → #12 sequence; reverse with `ffmpeg -vf reverse` for the join half.
- Method C (3D): .glb, move each mesh along its own direction × progress.
- Labels fade in when parts are apart; bike example explodes in 2D directions with thin leader lines and ends assembled while background turns brand colour (p.85).
```js
const parts = gsap.utils.toArray(".burger .part"); const mid = (parts.length-1)/2;
gsap.timeline({scrollTrigger:{trigger:".burger-sec", pin:true, end:"+=200%", scrub:1}})
  .to(parts,{y:(i)=>(i-mid)*90, rotate:(i)=>(i-mid)*3, ease:"power2.inOut"})
  .from(".part-label",{opacity:0, x:-20, stagger:.1},"<.3")
  .to(parts,{y:0, rotate:0, ease:"power2.inOut"},"+=0.4");
```
[proposal] Method A on the **LED katana** (blade, guard/tsuba, handle/tsuka, LED strip, battery cap) or on a tee ("print layer / fabric / tag / packaging"). Free path: client's own product photos cut out with rembg (p.85) — no paid video tools.

**★ #24 Handwritten Script Draw** (SVG stroke draw) ●●○ (p.45). Word as SVG path (outline stroke or single-line font); `stroke-dasharray = length`, `dashoffset = length` → 0; GSAP DrawSVG (free).
```js
gsap.from(".script path",{drawSVG:0, duration:1.6, ease:"power2.inOut",
  scrollTrigger:{trigger:".chapter", start:"top 60%"}});
```
Also the check-mark draw inside #71 (p.66). [proposal] ink-brush strokes, katana slash line, hand-drawn onomatopoeia (p.100), Japanese subtitle strokes.

**☆ #25 Wavy / Liquid Section Divider** ●○○ (p.46). SVG wave (haikei.app / getwaves.io) at section edge, same colour as next section; MorphSVG or translate a 200%-wide wave `translateX(-50%)` 12s linear infinite.
```html
<svg class="wave" viewBox="0 0 1440 120" preserveAspectRatio="none"><path fill="#3a0d1c" d="M0,64 C240,120 480,0 720,48 C960,96 1200,16 1440,64 V120 H0Z"/></svg>
```
[proposal] for Neo-Brutalism replace soft waves with **jagged/diagonal manga-panel splits** (same technique, polygon path).

**· #58 Halftone** and **· #61–#63, #65** — see below / §5.5.

**· #61 Packaging / Lid-Open Reveal** ●●○ (p.47). Layers base/lid/contents; scrub lid `y:-180, x:140, rotate:35` power2.inOut; contents scale .9→1 + brightness; then macro shot (`opacity 0, scale 1.1`). Pin `end:"+=150%"`, scrub 1. [proposal] merch box / mystery-bundle unboxing.

**· #62 Bloom-Rise Product Reveal** ●●○ (p.47). Product between back and front layers; scrub `yPercent:45→0`, scale .8→1 power2.out; front layer moves down faster (`yPercent:25`, ease none). Pin `end:"+=120%"`.

**★ #63 360° Product Turntable on Scroll** ●●○ (p.48). 3D: `rotation.y = progress × 2π` lerped in useFrame. 2D: 36–72 frame turntable scrubbed on canvas. Spotlight floor ellipse + soft shadow; per-angle spec captions.
```js
useFrame(()=>{ model.current.rotation.y = THREE.MathUtils.lerp(model.current.rotation.y, scroll.offset*Math.PI*2, .1) })
```
Level = Accent (p.73). [proposal] figurine or katana turntable; 2D frame version for mobile/reduced-motion poster.

**· #65 Life-Cycle Loop Story** ●●● (p.48). Whole page one story that ends where it began; duplicate first chapter at end; on reaching it `lenis.scrollTo(0,{immediate:true}); ScrollTrigger.refresh()`.

### 5.3 Hover & cursor (p.49–p.55)

**· #26 Grayscale → Colour Hover** ●○○ (p.49). `filter:grayscale(1) contrast(1.05)`; hover grayscale(0) + scale 1.03; transition .6s cubic-bezier(.2,.8,.2,1). [proposal] fits manga B&W → colour (great with #27).

**★ #27 Expanding Accordion Gallery** ●○○ (p.49). Flex row; panel `flex:1` → hovered/active `flex:5`; `transition: flex .7s cubic-bezier(.65,0,.35,1)`; collapsed labels `writing-mode:vertical-rl; rotate:180deg`; **JS click for mobile**.
```css
.acc{display:flex;gap:8px;height:520px}
.acc .p{flex:1;transition:flex .7s cubic-bezier(.65,0,.35,1);overflow:hidden;border-radius:16px}
.acc .p:hover,.acc .p.active{flex:5}
.acc .p .label{writing-mode:vertical-rl;rotate:180deg}
```
[proposal] fandom/category panels with **vertical condensed caps** (matches the brand's rotated type). Keyboard: panels must be focusable buttons with `:focus-visible` = active [builder note]. Mobile: stack vertically.

**★ #28 Image Zoom Inside Frame** ●○○ (p.50). Wrapper `overflow:hidden`; img `transform .8s cubic-bezier(.2,.8,.2,1)`, hover scale 1.08; second image stacked, opacity 0→1 (.5s) on hover.
```css
.card .media{overflow:hidden;border-radius:14px}
.card img{transition:transform .8s cubic-bezier(.2,.8,.2,1)} .card:hover img{transform:scale(1.08)}
.card .alt{position:absolute;inset:0;opacity:0;transition:opacity .5s} .card:hover .alt{opacity:1}
```
[proposal] every product card: front print → back print / on-model shot. Hover only on `pointer:fine` (p.105).

**★ #29 3D Tilt Card** ●○○ (p.50). Parent perspective 800px; rotateX/Y from cursor offset (max ±10°; code uses ×14); smooth reset on leave; radial-gradient glare layer. Stack: vanilla / vanilla-tilt.js / Motion.
```js
card.addEventListener("mousemove", e=>{ const r=card.getBoundingClientRect();
  const x=(e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5;
  gsap.to(card,{rotateY:x*14, rotateX:-y*14, transformPerspective:800, duration:.4}); });
card.addEventListener("mouseleave", ()=>gsap.to(card,{rotateX:0, rotateY:0, duration:.6}));
```
[proposal] polaroids / trading-card style product cards / reviews. Pitfall [builder note]: cache rect on `pointerenter`, not every move (p.75 "never read getBoundingClientRect every frame").

**★ #30 Magnetic Button** ●○○ (p.51). Move button 30–40% of cursor offset with `gsap.quickTo` (.4s); leave → `elastic.out(1,.4)` 1s.
```js
const xTo=gsap.quickTo(btn,"x",{duration:.4}), yTo=gsap.quickTo(btn,"y",{duration:.4});
btn.addEventListener("mousemove",e=>{const r=btn.getBoundingClientRect();
  xTo((e.clientX-r.left-r.width/2)*.35); yTo((e.clientY-r.top-r.height/2)*.35);});
btn.addEventListener("mouseleave",()=>gsap.to(btn,{x:0,y:0,ease:"elastic.out(1,.4)",duration:1}));
```
Desktop/pointer:fine only.

**★ #31 Custom Cursor / Cursor Follower** ●○○ (p.51). Hide native cursor on desktop only (`pointer:fine`); dot follows instantly (`gsap.set`), ring via `quickTo` (.5s, "power3"); `data-cursor="View"` → ring scales up + shows label ("View", "Drag", "Play").
```js
const rx=gsap.quickTo(".ring","x",{duration:.5,ease:"power3"}), ry=gsap.quickTo(".ring","y",{duration:.5,ease:"power3"});
addEventListener("pointermove",e=>{ gsap.set(".dot",{x:e.clientX,y:e.clientY}); rx(e.clientX); ry(e.clientY); });
```
Never on touch (p.102). [builder note] cursor layer `pointer-events:none`, `aria-hidden`; keep native focus rings. [proposal] labels in EN + JP ("VIEW 見る").

**☆ #32 Spotlight / Glow Follow** ●○○ (p.52). Set `--x/--y` on pointermove; `background: radial-gradient(400px circle at var(--x) var(--y), #7b6cff40, transparent 60%), #0c0c12`. [proposal] recolour to yellow/lavender, or reveal screentone under the cursor.

**· #33 Filter Focus (Dim Others)** ●○○ (p.52). `grid[data-filter]` tiles not matching → opacity .15 + scale .96; transition .4s; stagger via `transition-delay: calc(var(--i)*15ms)`. [proposal] fandom filter chips on the shop grid.

**· #34 Hover-Reveal Preview** ●○○ (p.53). Row `::before` scaleY 0→1 (origin bottom), `.45s cubic-bezier(.7,0,.3,1)`; preview image follows cursor via quickTo.

**☆ #35 Button Fill & Underline Draw** ●○○ (p.53). `::before` scaleX 0→1, origin right→left, `.5s cubic-bezier(.7,0,.3,1)`; text colour switches at 50% of fill; links: `background-size 0% 1px → 100% 1px` .4s.
```css
.btn::before{content:"";position:absolute;inset:0;background:#1b1714;transform:scaleX(0);transform-origin:right;transition:transform .5s cubic-bezier(.7,0,.3,1);z-index:-1}
.btn:hover::before{transform:scaleX(1);transform-origin:left}
.link{background:linear-gradient(currentColor 0 0) 0 100%/0% 1px no-repeat;transition:background-size .4s}
.link:hover{background-size:100% 1px}
```

**☆ #36 Image Trail Cursor** ●●○ (p.54). Every ~80px of pointer travel place next image at cursor; `scale .6→1` .6s power3.out, then fade out after .6s (.4s); cycle 8–12 images. [proposal] hero trail of the client's own product photos / polaroids (never character art they don't own). Desktop only.

**★ #66 Storytelling Button** ●●○ (p.54) — Part 12 signature. Click plays a mini story then the button becomes the confirmation. **3 states: idle → working (story) → done**; story layer (SVG/Lottie) inside button with `overflow:hidden`, label hides; **lock while playing (`pointerEvents:"none"`); announce result via `aria-live`**. Stack: GSAP timeline or Lottie/Rive; React state machine.
```js
btn.onclick = () => gsap.timeline({onComplete:()=>btn.dataset.state="done"})
  .set(btn,{pointerEvents:"none"}).to(".label",{yPercent:-100,opacity:0,duration:.2})
  .fromTo(".truck",{x:"-20%"},{x:"120%",duration:1.4,ease:"power2.inOut"})
  .from(".done",{scale:.6,opacity:0,ease:"back.out(2)",duration:.4});
```
[proposal] "Add to cart": a tiny original chibi/door slams shut with the item → "In your bag ✓"; "Place order": katana slash or delivery scooter. Must give feedback < 100ms (p.112); reduced motion: skip story, show done state.

**★ #69 Delete / Shred** — see Part 12 block §5.6.

### 5.4 Signature components (p.56–p.67)

**★ #37 Infinite Marquee Ticker** ●○○ (p.56). Duplicate content twice in a track; `translateX 0 → -50%` linear infinite (25s); pause on hover; two strips opposite directions = energy; advanced: reverse on scroll up / speed with scroll velocity (Lenis velocity, p.101).
```css
.marquee{overflow:hidden;white-space:nowrap}
.marquee .track{display:inline-flex;gap:3rem;animation:mq 25s linear infinite}
.marquee:hover .track{animation-play-state:paused}
@keyframes mq{to{transform:translateX(-50%)}}
```
[proposal] the brand's **ticker bands** (EN + JP: "NEW DROP ✦ 新作 ✦ FREE SHIPPING…"), rotated −3° crossing strips. Pitfalls [builder note]: duplicate copy `aria-hidden="true"`; reduced-motion → static strip; avoid layout-shifting font swap.

**☆ #38 Curved / Cylindrical Carousel** ●●● (p.57). Container perspective 1200px; ring `preserve-3d`; card `rotateY(i×angle) translateZ(-radius)`; rotate ring on drag/scroll (GSAP Draggable / Swiper EffectCreative / OGL curved gallery).
```js
const n=cards.length, angle=360/n, radius=900;
cards.forEach((c,i)=>gsap.set(c,{rotateY:i*angle, z:-radius, transformOrigin:`50% 50% ${radius}px`}));
gsap.to(".ring",{rotateY:-360, ease:"none", scrollTrigger:{trigger:".curved", pin:true, end:"+=200%", scrub:1}});
```

**· #39 Arch Image Frames** ●○○ (p.57) — heritage-specific; not for this site.

**☆ #40 Variant Crossfade Viewer** ●●○ (p.58). Stack variant images; on click crossfade .6s + new one scale 1.04→1 (.8s power2.out); title slides up (`yPercent 100→0`, .6s expo.out). Stack: GSAP / Motion AnimatePresence. [proposal] PDP colourway / design switcher (black tee on yellow / lavender / pink block).

**★ #41 Colour-Morph Product Slider** ●●○ (p.58) — "the most 'wow' e-commerce hero". Each slide `{color, image, name, accent}`; on next: tween background colour (.8s); current exits (`x:-250, rotate:-25, opacity 0`, .6s power2.in); next enters from right with `back.out(1.4)` .9s at .35; **giant faded name text behind swaps too** (#47).
```js
function go(i){ const s=slides[i]; const tl=gsap.timeline();
  tl.to(".hero",{backgroundColor:s.color, duration:.8},0)
    .to(".prod.current",{x:-250, rotate:-25, opacity:0, duration:.6, ease:"power2.in"},0)
    .fromTo(prods[i],{x:250, rotate:25, opacity:0},{x:0, rotate:0, opacity:1, duration:.9, ease:"back.out(1.4)"},.35); }
```
Scroll-pinned variant (prompt 03, p.99): outgoing scales down + rotates slightly + blurs out, incoming scales 0.8→1 with subtle rotateY — never a hard cut; background + accent via CSS var `--accent`; big index (01/05) and name with masked word reveal; segmented progress bar; dot nav via `lenis.scrollTo`; **reduced-motion: no pin/scrub, products stacked**; 0.6–0.9s power3/power4.inOut. [proposal] **the hero**: black oversized tee on a pastel colour block with the design title repeated behind — exactly the brand's IG look.

**· #42 Physics Lanyard ID Card** ●●● (p.59). R3F + @react-three/rapier rope joints (ReactBits Lanyard); quick 2D: `Draggable` rotation ±40°, release → `elastic.out(1,.25)` 2.2s. Level = Immersive. [proposal] optional "fest pass" badge for the collabs page — only if budget allows.

**· #43 Periodic-Table Grid** ●○○ (p.59). Not for this site.
**· #44 Glassmorphism Info Card** ●○○ (p.60). `backdrop-filter: blur(16px) saturate(1.4)` — conflicts with Neo-Brutalism "no blur"; avoid.

**★ #45 Floating Polaroids / Scattered Cards** ●○○ (p.60). Random rotate −8°…8°; infinite y float (`"+=12"`, `2 + i*.3`s, sine.inOut yoyo); optional Draggable with inertia.
```js
gsap.utils.toArray(".polaroid").forEach((p,i)=>{ gsap.set(p,{rotate:gsap.utils.random(-8,8)});
  gsap.to(p,{y:"+=12", duration:2+i*.3, repeat:-1, yoyo:true, ease:"sine.inOut"}); });
```
[proposal] the brand literally sells polaroids — use for the polaroid product line and fest/pop-up memories (own photos only). [builder note] seed the random angles (deterministic per index) to avoid hydration mismatch in SSR.

**· #46 Rotating Circular Text Badge** ●○○ (p.61). SVG `<textPath>` on a circle, CSS rotate 360° over 12–20s linear infinite. [proposal] "CUSTOM MERCH • 特注 •" badge near hero CTA.

**★ #47 Giant Background Typography** ●○○ (p.61). Word at 20–30vw, very low contrast, behind subject; `font-size: clamp(6rem,22vw,26rem); line-height .8; opacity .06–.1` or outlined (`-webkit-text-stroke`); subject in front via z-index; parallax text slower than subject.
```css
.bigword{position:absolute;inset:auto 0 10% 0;font:900 22vw/.8 "Inter Tight";color:transparent;
  -webkit-text-stroke:2px rgba(0,0,0,.08);letter-spacing:-.04em;z-index:0}
```
[proposal] the design title repeated behind the tee (IG look); outline wordmark "THE ESCAPE DOOR"; vertical stacked caps. Pitfall: `aria-hidden` decorative words; watch horizontal overflow at 390px (no horizontal scroll, p.6) [builder note: `overflow-x:clip` on the section].

**☆ #48 Floating Pill Nav + Sliding Indicator** ●○○ (p.62). Fixed centred nav, backdrop blur (→ for Neo-Brutalism use solid fill + hard border [proposal]); indicator tweens x/width to active link; section detection via ScrollTrigger onToggle; **hide on scroll down, show on scroll up**. Motion version:
```jsx
{links.map(l=><a key={l} onClick={()=>setActive(l)}>{active===l &&
  <motion.span layoutId="pill" className="pill" transition={{type:"spring",bounce:.2}}/>}{l}</a>)}
```

**☆ #49 Smooth FAQ Accordion** ●○○ (p.62). `grid-template-rows: 0fr → 1fr` (no JS measuring), `.45s cubic-bezier(.65,0,.35,1)`; icon rotate 45°; **only one open at a time**.
```css
.qa .ans{display:grid;grid-template-rows:0fr;transition:grid-template-rows .45s cubic-bezier(.65,0,.35,1)}
.qa.open .ans{grid-template-rows:1fr} .qa .ans>div{overflow:hidden}
.qa .icon{transition:rotate .4s} .qa.open .icon{rotate:45deg}
```
[builder note] use `<button aria-expanded aria-controls>`; answers stay in DOM (GEO answer blocks, p.89). Note FAQ rich results no longer show on Google since 7 May 2026 (p.90) — still worth it for GEO, don't sell as a rich-result win.

**· #50 Bento Grid** ●○○ (p.63). `grid-template-columns:repeat(4,1fr); grid-auto-rows:180px; gap:16px`; `.t-big` span 2×2, `.t-wide` span 2; radius 20–28px, 1px border, padding 24–32px; stagger reveal; per-tile hover micro-animation. [proposal] category grid as manga-panel collage (DRIFT prompt p.101 uses bento for categories).

**★ #51 Floating 3D Product Hero** ●●○ (p.63). Product render with transparent bg (or .glb) floats (`y:-18`, 2.4s sine.inOut yoyo); ingredients as separate PNGs with different float speeds + **mouse parallax** via `data-depth` (×40, 1s); soft shadow ellipse shrinks when product rises. Stack: GSAP/CSS, optional Three.js.
```js
gsap.to(".can",{y:-18, duration:2.4, repeat:-1, yoyo:true, ease:"sine.inOut"});
addEventListener("pointermove",e=>{const x=e.clientX/innerWidth-.5, y=e.clientY/innerHeight-.5;
  document.querySelectorAll("[data-depth]").forEach(el=>gsap.to(el,{x:x*el.dataset.depth*40, y:y*el.dataset.depth*40, duration:1}));});
```
Level = Accent (p.73). [proposal] tee/katana floating with orbiting badges, stickers, bookmarks; sakura/ink-splash cut-outs.

**★ #52 Tilted Pill CTA** ●○○ (p.64). `rotate:-12deg`, overlapping a card corner; hover `rotate:-6deg; scale:1.05` with spring ease `cubic-bezier(.34,1.56,.64,1)` .4s.
```css
.sticker{rotate:-12deg;border-radius:999px;padding:.9rem 1.6rem;background:#7a1131;color:#fff;
  transition:rotate .4s cubic-bezier(.34,1.56,.64,1), scale .4s}.sticker:hover{rotate:-6deg;scale:1.05}
```
[proposal] yellow "ADD TO BAG" sticker with hard black offset shadow. Touch target ≥ 44px; rotated hit-area still reachable [builder note].

**· #64 Spec Callouts with Leader Lines** ●○○ (p.64). Anchors in % over the product; lines `scaleX:0` from left, stagger .15, .6s; labels fade + count-up; in 3D project mesh positions with `vector.project(camera)`. [proposal] pairs with #23/#63 for katana specs (length, LED modes, weight — real figures only).

**★ #66 / ☆ #67 / · #68 / ☆ #69 / ☆ #70 / ★ #71 / ☆ #72** — see §5.6 (Part 12 set).

### 5.5 Transitions & effects (p.45, p.68–p.70, p.36)

**★ #53 Page Transition** ●●○ (p.68). Coloured panel sweeps across (or elements morph) instead of a white flash. MPA: `@view-transition { navigation: auto; }`; React/Next: Motion AnimatePresence or **next-view-transitions**; classic Barba.js + GSAP. Shared element: `view-transition-name: hero-img`. Duration 0.5–0.8s power3.inOut (p.71).
```css
@view-transition { navigation: auto; }
::view-transition-old(root){animation:.5s ease both slide-out}
::view-transition-new(root){animation:.5s ease both slide-in}
.product-img{view-transition-name: hero-img}
```
Prompt: "shared product image morph between list and detail". [builder note] each `view-transition-name` must be unique on the page (set it only on the clicked card); React 19 has an experimental `<ViewTransition>` — verify via Context7 for Next 16 before using; fall back to a manga-panel wipe (#55) with AnimatePresence.

**· #54 Blur-In / Focus Pull** ●○○ (p.68). `filter: blur(12px)`, opacity 0, y 20 → sharp, 1.2s power3.out; headings/images only (GPU-heavy). Conflicts with "no blur" → skip.

**· #55 Clip-Path Wipe** ●○○ (p.69). Incoming `polygon(0 0, 0 0, 0 100%, 0 100%)` → `polygon(0 0, 115% 0, 100% 100%, 0 100%)`, 1.1s expo.inOut. [proposal] **the natural manga diagonal panel-split transition** — use for slide changes and as the page-transition panel.

**· #56 Gooey / Blob Morph** ●○○ (p.69). SVG `feGaussianBlur stdDeviation=10` + `feColorMatrix "… 0 0 0 20 -9"`.
**· #57 Fabric Drape Wipe** ●●○ (p.70). Transparent WebM cloth over page, or SVG wavy edge, or WebGL cloth shader. [proposal] a "cape" sweep could tie to the capes product — optional.

**★ #58 Halftone / Dot-Particle Form** ●●○ (p.46). Sample a PNG on a hidden canvas; every Nth pixel with alpha becomes a dot (radius = brightness); render Canvas 2D or `THREE.Points` for 10k+ (or postprocessing `DotScreen`); scrub each dot from random → target with progress; push dots away from cursor.
```js
for(let y=0;y<H;y+=6)for(let x=0;x<W;x+=6){const a=d[(y*W+x)*4+3]; if(a>128) pts.push({x,y,sx:Math.random()*W,sy:Math.random()*H});}
function draw(p){ ctx.clearRect(0,0,W,H); pts.forEach(o=>{ctx.beginPath();
  ctx.arc(o.sx+(o.x-o.sx)*p, o.sy+(o.y-o.sy)*p, 2.2, 0, 7); ctx.fill();}); }
```
[proposal] **core manga screentone motif**: the brand wordmark or a product silhouette forms out of screentone dots; screentone panel borders. Perf [builder note]: cap dot count on mobile, pause when off-screen (IntersectionObserver, p.75), seed the scatter positions; reduced motion = draw final formed state once.

**☆ #59 Cloud / Smoke Dissolve** ●●○ (p.70). 3–6 cloud PNGs scale .5→1.4 and fade in (stagger .06, .7s power2.in), swap scene at midpoint, then scale 2 / fade out (.9s power2.out); WebGL: fbm noise threshold 0→1→0. [proposal] ink-cloud / speed-line burst transition into "Beyond Anime".

**☆ #60 Particle Formation Morph** ●●● (p.36). Target points from text/logo on canvas or mesh vertices; `THREE.Points` + shader; lerp particles current→target; morph targets on scroll/click; curl-noise drift at rest.
```js
gsap.to(prog,{v:1,duration:2,ease:"expo.inOut",onUpdate(){ const p=geo.attributes.position.array;
  for(let i=0;i<p.length;i++) p[i]=start[i]+(target[i]-start[i])*prog.v; geo.attributes.position.needsUpdate=true; }});
```
[builder note] prefer #58 (2D canvas) on this site; #60 only if a desktop-only 3D chapter exists.

### 5.6 Part 12 interaction set #66–#72 (p.54–p.67, p.112)

| # | Name | Playbook spec | Escape Door use [proposal] |
|---|---|---|---|
| **★ #66** | Storytelling Button | idle → working (story) → done; SVG/Lottie inside button, overflow hidden; lock while playing; `aria-live` result (p.54) | Add-to-bag / Place-order (one signature per flow) |
| ☆ #67 | OTP Morph Verification | One input per digit, `autocomplete="one-time-code"`, `inputmode="numeric"`, paste fills all; on complete **Flip** boxes to new layout (`duration:.7, ease:"power3.inOut", stagger:.05`), draw connecting lines, morph card into success; wrong code = horizontal shake + red border; keep accessible labels (p.65) | Supabase email/phone OTP login, if login exists |
| · #68 | Character Login | SVG pupils offset = clamp(direction to cursor) × max radius via quickTo (.3s); focus/blur/validation switch expressions; hands cover eyes on password (p.65). Rive state machine alternative | Optional with an **original** mascot only |
| ☆ #69 | Delete / Shred | First click arms ("Confirm?"), second deletes; doc drops into bin (`y:30, scale:.6, .4s power2.in`), strips fall (stagger .05); label "Deleted · Undo"; **Undo for 5s before really deleting** (p.55) | Remove-from-cart / wishlist (use sonner toast with Undo) |
| ☆ #70 | Receipt Print Reveal | Printer bar fixed; receipt `clip-path: inset(0 0 100% 0) → inset(0 0 0% 0)`, 1.6s `ease:"steps(24)"`; lines stagger, total counts up; stamp scale 2→1, rotate −14°, opacity 0→1, `back.out(2)` .4s; zig-zag tear mask (p.66) | Order confirmation receipt (monospace prices) |
| **★ #71** | Success Moment (Confetti + Ticket) | Check-mark SVG path draw (#24); canvas-confetti fired from the check-mark position; ticket slides in; **once per flow, never on routine actions; reduced-motion = check only** (p.66) | Payment success page only |
| ☆ #72 | Animated Glow Mesh Background | 2–3 abs. circles `filter: blur(80px)`, brand colours 40–70% opacity, 40vw; x/y long sine loops 8–20s different durations; noise overlay against banding (p.67) | Only behind checkout/order-status (blur conflicts with Neo-Brutalism elsewhere) |

#71 code (p.66):
```js
import confetti from "canvas-confetti";
const r = check.getBoundingClientRect();
confetti({particleCount:80, spread:70, origin:{x:(r.x+r.width/2)/innerWidth, y:r.y/innerHeight}});
```
#72 code (p.67):
```js
gsap.utils.toArray(".blob").forEach((b,i)=>gsap.to(b,{x:"random(-120,120)", y:"random(-80,80)",
  duration:10+i*4, repeat:-1, yoyo:true, ease:"sine.inOut"}));
```
#69 note [builder note]: the `text:` tween needs GSAP TextPlugin registered; simpler to set label via React state. #70 receipt and #71 confetti on the same screen = fine (Part 12 pairs them, p.112) but **confetti only once**.

---

## 6. Part 04 — 3D (p.72–p.75)

**The 3D test (p.73):** answer in one sentence each — 1 Purpose (sale/signup/…), 2 Visitor + device ("a shopper on a 3-year-old Android"), 3 8-second message, 4 One action. *If 3D does not measurably help with 3 and 4, it is decoration.* Honest test: describe the site without saying how it looks; if 3D doesn't come up because it's doing a job, it isn't.
- 3D earns its place when: product is physical and needs every angle; product is abstract; **audience expects craft (design, gaming, luxury)**; you compete on being memorable, not price.
- It does not when: people came to read; **conversion speed is the metric (every 100ms costs)**; **low-end devices / poor networks dominate**; accessibility-critical without fallback; tight budget.

| Level | Meaning | Cost / risk | Techniques |
|---|---|---|---|
| **Accent** | One 3D object or hero element; rest flat | **Low — best default for commercial sites** | #51, #63, #57–#60 |
| Scroll-driven scene | One scene transforms as user scrolls | Medium | #12, #22, #23 |
| Immersive | Navigable 3D space, physics | High — needs a fallback | #22, #42, physics worlds |

**Recommendation [proposal]: Accent.** Audience = Indian college students mostly on mid-range Android phones (fest pop-ups, Instagram traffic) and the goal is shop conversion → the "does not" bullets apply. Keep 3D to one lazy-loaded Accent object (#51 floating product or #63 turntable of the katana/figurine) and do #23 as 2D Method A. If #22 is built, confine it to a single desktop-only chapter (e.g. the "Beyond Anime" door) with a poster/2D fallback on mobile, low-power and reduced-motion.

**Briefing rules (p.74):** refs as files; constraints up front; **one section at a time**; screenshot and compare before reporting; iterate on specifics.
**Check on every section (p.74):** ☐ 60 fps on a mid-range laptop ☐ sensible prefers-reduced-motion version ☐ works at 390px, never scrolls sideways ☐ no overlaps at any scroll position ☐ text is real HTML (selectable, indexable), not baked into canvas.

**Asset pipeline (p.75):** Generate (free first: Blender MCP, or CC0/CC-BY from Poly Haven / Sketchfab free; Tripo/Meshy only on free credits) → Clean in Blender (fix normals, retopologise, bake textures, apply transforms, **name meshes per part** for exploded views) → Export **glTF/GLB only** → Compress `npx @gltf-transform/cli optimize in.glb out.glb --compress draco --texture-compress webp` → Load `useGLTF` + `Suspense` + `useProgress` loader; `useGLTF.preload`.

**Performance rules (p.75):**
| Problem | Fix |
|---|---|
| Huge model files | Draco or Meshopt; **aim well under 2 MB total for all 3D assets** |
| Too many draw calls | Merge geometry; instance repeated objects |
| Oversized textures | 1024 or 2048px is plenty; WebP or KTX2 |
| Scene runs off-screen | Pause rendering when canvas leaves viewport (`frameloop="demand"` or IntersectionObserver) |
| Layout thrash | Never read getBoundingClientRect every frame; cache; animate transforms only |
| Heavy first load | **Lazy-load the 3D; show meaningful HTML + a poster immediately** |
| Mobile | **DPR [1, 2] and clamp lower on phones**; shorten camera paths; lighter postprocessing |

**Accessibility & fallback (p.75):** headings as real HTML; prefers-reduced-motion = **static final state, not a blank**; every interactive element keyboard-reachable; on low-power devices swap canvas for a poster image or short video. Prompts add: "Draco-compress the GLB, lazy-load the Canvas, DPR clamp, poster images / no 3D on prefers-reduced-motion; reduce orbit range/explosion distance on mobile" (p.99).
[builder note] in Next 16 load the R3F canvas via `next/dynamic(() => import(...), { ssr:false })` inside a client component and mount only when in view.

---

## 7. Part 05 — Free-only stack, libraries, MCP (p.77–p.82)

**Free-only rule (p.81, binding):** only free tools/tiers; never sign up for paid, never add a paid API key, never per-use tools, never paid "Pro" components; if a free tier hits its limit switch to the free alternative; if no free option, stop and ask.

| Need | Use (free) | Avoid (paid) |
|---|---|---|
| Read websites | Scrapling (local) · Firecrawl keyless | Perplexity API, Firecrawl paid crawl |
| Search | Firecrawl search free · Claude Code web search | Perplexity API |
| Browser testing | Playwright · Chrome DevTools MCP | — |
| Docs | Context7 free | — |
| SEO/GEO | claude-seo (MIT), no paid add-ons | DataForSEO / paid SEO APIs |
| Code & motion | Next.js, Astro, GSAP, Lenis, Three.js, R3F, Motion | never buy GSAP "Club" (included now) |
| UI components | shadcn/ui, Magic UI, ReactBits, 21st.dev free items, daisyUI | paid "Pro" packs |
| Images | Unsplash · Pexels · Pixabay · Google AI Studio free · own photos | Midjourney, Higgsfield, paid Firefly |
| Video/motion | Playwright + FFmpeg pipeline · Pexels/Mixkit stock | Runway, Kling, Higgsfield paid |
| 3D | Blender + Blender MCP · Poly Haven · Sketchfab CC · Spline free | paid model stores |
| Fonts & icons | Google Fonts · Fontshare · Lucide · Tabler · Phosphor | paid fonts, Icons8 paid |
| Hosting | Cloudflare Pages · **Netlify free** · GitHub Pages | Vercel Pro (Hobby non-commercial) |
| DB / forms | **Supabase free** · Neon free · Formspree / Web3Forms free | paid tiers |
| Analytics | GA4 · Microsoft Clarity · Search Console · Bing Webmaster | paid analytics |
| Email | Resend / Brevo free tier | — |
| Music/SFX | YouTube Audio Library · Pixabay audio · procedural SFX in code | paid stock music |

**Libraries (p.78):** GSAP + ScrollTrigger (must-learn; free incl. SplitText, DrawSVG, MorphSVG, Flip) · Lenis (must-use) · Motion (whileInView, layoutId, AnimatePresence, springs) · Three/R3F/drei · @react-three/rapier · Spline · Lottie/Rive (loaders, mascots) · Swiper/Embla (touch sliders, thumbnail strips) · SplitType · View Transitions API / Barba · ffmpeg · Tailwind · Next.js/Astro. Component sources: ReactBits, Aceternity, Magic UI (marquee, bento, number ticker, shimmer buttons), 21st.dev, shadcn/ui, Codrops. **Rule: borrow solved components then restyle to the site's tokens; 2–3 sources max** (p.82). Originkit/Casberry/Orbitarium: check licence per component/export (p.82).
**Part 12 free web-app libs (p.114):** shadcn/ui · Motion · GSAP · Recharts/visx · cmdk · sonner · canvas-confetti · Lottie/Rive · Lucide.

**MCP servers (p.79–p.80):**
| Server | When | Install |
|---|---|---|
| Firecrawl | Always (keyless) | `claude mcp add --transport http firecrawl -s user https://mcp.firecrawl.dev/v2/mcp` |
| Scrapling | Always — first for reading the web | `uv tool install "scrapling[ai]" && scrapling install && claude mcp add scrapling -s user -- scrapling mcp` |
| Playwright | Always | `claude mcp add playwright -s user -- npx @playwright/mcp@latest` |
| Chrome DevTools | Always (perf traces, dropped frames) | `claude mcp add chrome-devtools -s user -- npx chrome-devtools-mcp@latest` |
| Context7 | Always (current GSAP/Three/Next docs) | `claude mcp add --transport http context7 -s user https://mcp.context7.com/mcp` |
| Sequential Thinking | 3D / complex (camera rigs, scroll maths) | `claude mcp add seq-thinking -s user -- npx -y @modelcontextprotocol/server-sequential-thinking` |
| GitHub | When a repo exists | `https://api.githubcopilot.com/mcp/` (token header) |
| Figma | Only if client already pays | skip otherwise |
| Blender MCP | Custom 3D | `uvx blender-mcp` + add-on |
| Supabase | Login / e-commerce | `claude mcp add --transport http supabase -s user https://mcp.supabase.com/mcp` |
| Neon | Forms / waitlists | `https://mcp.neon.tech/mcp` |
| Cloudinary | Heavy media | (free tier only) |
Notes: `-s user` = all projects; remote servers OAuth on first use; if a command fails look it up via Context7 / official README and continue (p.80).

---

## 8. Part 06 — Assets (p.83–p.85)

**Sources (p.84):** Photos — Unsplash/Pexels/Pixabay (commercial OK) or AI (free tiers only per Part 05). Product cut-outs — **your own product photos + background removal (`rembg`, Photopea, Canva)**; or generate "on pure white seamless background, studio lighting" then remove bg. Hero/story video — Pexels Videos, Mixkit, Coverr. Scroll sequence — any video → ffmpeg frames. 3D — Sketchfab (downloadable + CC), Poly Haven (CC0), Poly Pizza. Patterns — Poly Haven textures, Transparent Textures, Hero Patterns (SVG). Waves/blobs — haikei.app, getwaves.io, blobmaker.app (or AI-written SVG paths). Icons — Lucide/Phosphor/Tabler/Heroicons. Animated icons — LottieFiles, Rive community. Fonts — Google Fonts, Fontshare, Uncut.wtf.

**Licence rule (p.84):** prefer Unsplash/Pexels/Poly Haven/own generated images; **never celebrity photos, brand logos you don't own, or Pinterest images**; AI images: keep the prompts and check the generator's commercial terms.

**Style seed (p.84):** write one "style seed" and append it to **every** image prompt. Same character in every image → reference image + identical seed text. **Aspect ratios: hero 16:9 or 21:9, cards 3:4 or 4:5, arches 3:4, mobile hero 9:16.**
Example seed format (heritage): "editorial fashion photography, warm tungsten light, deep maroon and antique gold palette, shallow depth of field, 85mm lens, soft film grain, rich silk texture detail, South Indian heritage interior, elegant and calm, no text, no watermark".
**[proposal] Escape Door seed:** "flat-lit studio product photography of an oversized black streetwear garment on a solid electric-yellow / lavender / pink colour block, manga screentone halftone texture overlay, thick black ink panel borders, high contrast, crisp edges, no characters, no logos, no text, no watermark". Never generate copyrighted anime characters.

**Pipelines (p.85):**
1. Product cut-out: product on plain white, soft shadow, front view, 2048px → `rembg i in.png out.png` → **WebP/AVIF ≤ 200KB** (squoosh) → animate with #51 / #41.
2. Scroll film (#12): 2–4 stills same camera angle → first/last-frame AI video → `ffmpeg -f concat` → `ffmpeg -i film.mp4 -vf "fps=24,scale=1600:-1" f/%03d.webp` → canvas scrub. (Paid video models are not allowed here; use free alternatives or Part 11 code-rendered frames.)
3. Exploded view (#23): Method A layered PNGs / B AI video (+ `-vf reverse`) / C 3D .glb (see §5.2).

**Compression targets:** hero video **≤ 4MB, muted, playsinline, poster** (p.82, p.105, p.110); image sequences **≤150 frames, ≤120KB each** (p.105); 3D **well under 2MB total** (p.75); images WebP/AVIF, width-appropriate, lazy below the fold (p.105); EZGIF / Squoosh / ffmpeg (p.82).

**ASSETS.md format:** the playbook requires an "ASSETS.md manifest" recording **source + licence for each** (p.6), "a list of every asset with its source or the generation prompt used" (p.102), and "keep the prompts" (p.84). No fixed table is given — **[proposal]** use:

| file (public/…) | type | source (URL / own photo / generated / code) | licence | prompt or seed (if generated) | dimensions | bytes (after compression) | used in (section) |
|---|---|---|---|---|---|---|---|

---

## 9. Part 07 — Backend (p.87)

| Project | Reach for | Why |
|---|---|---|
| Brand/portfolio site with contact form | Neon + Next.js route handler | Real Postgres, branch per preview, zero ops |
| Waitlist / newsletter | Neon or Supabase table + email provider | Double opt-in; export CSV |
| **E-commerce or dashboard with login** | **Supabase (auth + storage + DB + realtime)** | Fastest path to accounts and uploads |
| **Indian e-commerce checkout** | **Supabase + Razorpay** | UPI, cards, wallets; **webhooks to mark orders paid** |
| Enterprise logic | Spring Boot behind Next.js | — (not for this site) |
| Content the client edits | Headless CMS (Sanity, Payload) **or Supabase tables** | Editors never touch code |

Form pattern (p.87):
```ts
// app/api/enquiry/route.ts
const Schema = z.object({ name: z.string().min(2), email: z.string().email(),
  phone: z.string().optional(), message: z.string().max(2000) });
export async function POST(req: Request) {
  const data = Schema.parse(await req.json());        // validate
  await sql`insert into enquiries ${sql(data)}`;      // Neon / Supabase
  await sendEmail({ to: process.env.OWNER_EMAIL, data }); // notify owner
  return Response.json({ ok: true });
}
```
**Rules (p.87):** secrets only in env vars, never in the repo · validate on the server (Zod); client validation is UX only · **rate-limit + honeypot field on every public form** · send visitor confirmation + owner notification · **test every form end-to-end on the deployed preview** · **Row-level security ON in Supabase before going live** · don't wire Spring Boot into a brand site.
**This project:** Supabase free + Netlify Functions (route handlers deploy as functions on Netlify [builder note]). Custom-merch request form, fest-collab enquiry, cart (client state via zustand + Supabase orders), Razorpay only when the client provides keys (Razorpay is listed as the India default, p.8 — confirm pricing/fees with the human under the free-only rule). Collect the minimum fields; privacy policy + cookie consent where needed (p.90). The "never collect personal data" rule in the playbook belongs to the web-access/scraping rule (p.7).
Cart UX precedent (AURELLE, p.101): cart context + **slide-in drawer** (qty, subtotal, Checkout ready for Razorpay), wishlist, size-guide modal, typed `products.ts { name, images[], price, mrp, fabric, occasion, sizes[], colors[] }`.

---

## 10. Part 08 — SEO · GEO · launch (p.89–p.91) — complete checklist

**claude-seo commands (p.89):** `/seo plan <type>` (P3; ecommerce) · `/seo content-brief <topic>` (P3) · `/seo audit <url>` (P7 on preview) · `/seo technical` · `/seo schema` · `/seo geo` · `/seo sitemap generate` · `/seo images` · `/seo local` · **`/seo ecommerce <url>` (product schema, returns, shipping)** · `/seo hreflang` · `/seo drift baseline` (after launch).

**Done automatically in code — no asking (p.89):**
- [ ] Titles & descriptions: `export const metadata` / `generateMetadata` per page; unique; **title ≤ 60 chars, description ≤ 155**
- [ ] Canonical (`alternates.canonical`) + OG/Twitter; `opengraph-image.tsx` **1200×630** per key page
- [ ] `app/sitemap.ts` (all indexable URLs, lastModified) + `app/robots.ts` pointing to it
- [ ] JSON-LD: **Organization + WebSite on home**; **Product + Offer + MerchantReturnPolicy (shops)**; Article + Person (blog); LocalBusiness only if local; **BreadcrumbList everywhere**
- [ ] One H1; question-style H2s on informational pages, each followed by a self-contained answer block
- [ ] Images: descriptive alt, width/height set, WebP/AVIF, lazy below the fold, `priority` on the LCP image
- [ ] CWV: **LCP < 2.5s · INP < 200ms · CLS < 0.1 — measured on mobile**
- [ ] Internal links: every page ≤ 3 clicks; descriptive anchors; footer + breadcrumbs
- [ ] Animated text: real text in DOM; split-text keeps `aria-label` with the full sentence
- [ ] 3D/canvas never the only place a heading or price lives; HTML first, canvas decorative
- [ ] Favicon & manifest: `icon.png`, `apple-icon.png`, theme colour
- [ ] Custom 404 with links; 301 every changed URL in a redesign

**GEO facts (p.90, checked Oct 2026):** GEO/AEO = SEO under new names (page must be indexed + snippet-eligible first) · **self-contained answer passages ~134–167 words under question-style headings**, clear attribution · entity presence: consistent brand name, `sameAs` links (Instagram @escapedoor.in etc.) · llms.txt is not a Google citation lever · **FAQ rich results stopped on Google 7 May 2026; HowTo removed 2023 — don't sell them as wins** · Trust weighted highest: real contact info, HTTPS, author names, dates, policies.

**Post-launch — 5 steps (p.90):** 1 Search Console: verify domain, submit sitemap.xml, URL-inspect home + request indexing (client site → done by the human unless the client adds the service account, p.91) · 2 Google Business Profile (local only; NAP identical) · 3 GA4 + Clarity; mark the main action (order/form/WhatsApp) as a conversion · 4 Core pages complete: Home, About, Services/Products, Contact — each unique title, H1, schema · 5 `/seo audit` + `/seo geo`, fix, `/seo drift baseline`; plus **Bing Webmaster Tools + IndexNow**.

**Launch checklist (p.90):**
Experience — [ ] 60fps on mid-range device, verified [ ] 3D payload compressed & measured [ ] reduced-motion path tested [ ] real phone tested [ ] no horizontal scroll at any width [ ] no overlaps at any scroll position
Legal & content — [ ] font licences (no trial files) [ ] icon licences + required credits [ ] 3D model licences allow commercial use [ ] AI image/video terms checked [ ] **every claim and figure signed off by the client** [ ] privacy policy + cookie consent where needed
Technical — [ ] forms deliver, tested end-to-end [ ] meta, OG, favicon, sitemap, robots [ ] schema validates (Rich Results Test) [ ] **Lighthouse ≥ 90 mobile**; CWV in range [ ] analytics + Search Console + Bing live [ ] 301s for any changed URL

**Pre-ship quality check (Part 10, p.105):**
Design — [ ] one style, 5-colour palette, 2–3 fonts [ ] every H2 has an accent word or label [ ] at least one contrast section for rhythm [ ] no placeholder images; one art direction [ ] real copy, short headlines [ ] mobile layout designed, not just shrunk
Motion — [ ] Lenis + ScrollTrigger synced, no jitter [ ] no linear eases on reveals; stagger used [ ] **preloader ≤ 2s, first visit only** [ ] **pinned sections disabled/simplified < 768px** [ ] prefers-reduced-motion respected [ ] **hover effects only on pointer:fine**
Performance — [ ] images WebP/AVIF, lazy below fold [ ] hero video ≤ 4MB, muted, playsinline, poster [ ] image sequences ≤ 150 frames, ≤ 120KB each, progressive preload [ ] **fonts: 2 families, `font-display:swap`, preload display font** [ ] Lighthouse ≥ 90 mobile
A11y & SEO — [ ] contrast ≥ 4.5:1 (incl. text on images) [ ] alt on every image; video captions [ ] visible keyboard focus; menus usable without mouse [ ] one H1, meta title/description, OG image [ ] split text readable to screen readers (aria-label)

---

## 11. Part 09 — Recipes (p.93–p.96)

The 8 recipes: Luxury fashion/jewellery/saree (Editorial Heritage Luxury) · **Food/drinks/D2C (Playful Candy Pop)** · Developer portfolio · Real estate · Product launch/gadget/event (Dark Product Theatre / Art-Historic Surreal) · **SaaS/agency/startup (Dark SaaS Glow or Neo-Brutalism)** · Beauty · Automotive/e-bike. **None is "streetwear/merch".** Closest structural fits:

- **Food / drinks / D2C** (p.93) — D2C e-commerce with per-product colour: 1 Circle intro → logo with orbiting products (#02, #05) · 2 Colour-morph hero (#41, #51) · 3 Offers marquee (#37) · 4 Product drops into "Explore" cards (#21, #08) · 5 Exploded ingredients (#23) · 6 Manifesto word reveal (#13) · 7 UGC gallery + polaroids (#45, #29) · 8 FAQ (#49) · 9 Wave footer (#25). Global: #20, #18, back.out easing, #56 on buttons.
- **Luxury fashion store** (p.93) — store structure: preloader (#01) · video hero + split-text + CTA (#04, #30) · USP marquee (#37) · collections (#08) · signature carousel (#38) · contrast section (#25, #28) · product showcase with variants (#40, #52) · editorial accordion (#27, #26) · full-bleed film (#15) · footer (#35). Global #20, #07, #54, #31.
- Build prompts **07 DRIFT Streetwear E-Commerce** and **08 AURELLE** (p.101) are the streetwear/fashion e-commerce precedents (hero + product showcase with Flip stage, popular picks horizontal, new arrivals grid, bento categories, identity marquee with spinning badge, featured product, testimonials, footer with massive faded wordmark + floating card; cart drawer, wishlist, size guide).

**[proposal] Escape Door home — section order (D2C recipe skeleton + store sections, mapped to the requested techniques):**
1. Preloader: door-opening + 0→100 counter (#06 / #01 / #03 or #02), ≤2s, first visit only
2. Hero: colour-morph product slider — black tee on yellow/lavender/pink block, design title giant behind (#41, #47, #51, #04, #52 sticker CTA, #30)
3. Ticker bands EN/JP (#37)
4. Shop by product type — stagger grid with inner zoom + 2nd image (#08, #28, #29 on polaroid/badge cards)
5. Shared-element flight of the hero tee into the "New drop" card (#21)
6. Fandom panels — expanding accordion with vertical caps (#27), screentone halftone motif (#58)
7. Pinned "manga page" story chapter (#10, #13 manifesto, #24 ink strokes, #19 stacked pages optional)
8. Exploded / turntable katana (#23 Method A, #63, #64) — Accent 3D level
9. Full-bleed panel expand into fest/pop-up chapter (#15) → horizontal fest timeline (#11, #16) + counters (#17, real numbers only)
10. Polaroid wall (#45 — the polaroid product line)
11. "Beyond Anime" door (#02/#59 transition; optional #22 desktop-only)
12. Custom-merch CTA (#66 storytelling button, #35) + FAQ (#49)
13. Footer: giant outline wordmark (#47), ticker (#37)
Global: #20 Lenis, #18 background shift per chapter, #31 cursor (desktop), #48 nav, #53 page transitions (#55 diagonal panel wipe), #09 subtle parallax. Checkout flow: #66 → #70 → #71 (once) with #72 only there; #69 for cart removal with 5s undo; #67 if OTP login.

---

## 12. Part 11 — Motion Graphics Studio (p.106–p.110) — for the launch reel

**Principle (p.107):** Claude does not output an MP4 directly; it writes code that describes every frame; headless Chromium captures each frame; FFmpeg joins them. Pipeline: Idea → Claude Code → `index.html` + `window.seek(t)` → Playwright + Chromium → PNG per frame → **FFmpeg H.264 · CRF 16** → `out/final.mp4`.
Layers: Runtime **Node.js 22+**, Python 3, FFmpeg · Rendering Playwright + Chromium · Remotion **only if its free licence applies** (individuals/very small companies, remotion.dev/license) — default = free Playwright + FFmpeg · optional audio Python + NumPy, Librosa, SoundFile.
Setup: `npm init -y; npm install -D playwright; npx playwright install chromium; pip install --user numpy librosa soundfile`.
Files: `CLAUDE.md` (rules) · `index.html` · `render.mjs` · `beats.py` · `sfx.mjs` · `assets/` · `refs/` · `docs/` (style_guide.md · shotlist.md · review_log.md) · `out/` (silent.mp4 · final.mp4 · contact.png · poster.png).

**Key technique — animation = pure function of time (p.107):**
```js
function draw(t) {
  drawBackground();
  if (t < 3)           drawIntro(t);
  if (t >= 3 && t < 6) drawSceneTwo(t - 3);
  if (t >= 6)          drawFinalScene(t - 6);
}
window.seek = (t) => draw(t);
// 15 s x 60 fps = 900 frames -> the renderer can ask for any frame
```

**The motion CLAUDE.md — "Motion Studio Rules" (p.108, verbatim):**
```
# Motion Studio Rules
## Rendering
Every animation must be deterministic. Use window.seek(t).
The entire visual state must be calculated from time.
Do not use: setTimeout · CSS transitions · state-dependent animation ·
Math.random · uncontrolled requestAnimationFrame during rendering.
Use seeded randomness when randomness is required.
## Visual style
Avoid generic AI motion graphics. Do not use: centered text over gradients ·
excessive glow · random particle effects · unnecessary borders ·
corner labels · everything fading in.
Use: strong typography · deliberate composition · smooth camera movement ·
spring-based animation · clear visual hierarchy.
Something visually meaningful should happen every 2-4 seconds.
Brand: take palette, fonts and easing from the website's DESIGN.md.
## Export
Render with Playwright + Chromium. H.264 · yuv420p · CRF 16.
## Quality control (before final render)
1 contact sheet · 2 inspect frames · 3 phone readability · 4 animation
quality · 5 composition · 6 pacing · 7 sound sync.
Identify the 3 biggest problems. Fix them. Repeat until quality is high.
```
(Note for this brand: manga panel borders are deliberate composition, not "unnecessary borders" — but avoid decorative frames that carry no meaning.)

**Springs, not basic easing (p.108):** cheap AI animation = linear moves, fade in, fade out, slide left/right. Use **closed-form springs**: **snappy for buttons, medium for cards, heavier for large type, tiny overshoot for UI, none for important text.**
[builder note] closed-form damped spring for `seek(t)`: `x(t)=1 − e^(−ζω t)·(cos(ω_d t) + (ζω/ω_d)·sin(ω_d t))`, `ω_d = ω√(1−ζ²)`; e.g. buttons ω≈18 ζ≈0.6, cards ω≈12 ζ≈0.75, big type ω≈8 ζ≈1 (critically damped = no overshoot). Seeded RNG: mulberry32(seed).

**References beat descriptions (p.108):** put `refs/reference.mp4` or `refs/frame.png` in the project. Pipeline **Reference → Style guide → Storyboard (shotlist) → Animation**. Borrow only motion language and pacing — never logos, characters, brand assets or copyrighted content.

**Example 20-second product timeline (p.108):** 0:00–0:02 HOOK huge kinetic typography · 0:02–0:05 PRODUCT INTRO logo/product appears · 0:05–0:09 FEATURE 1 UI assembles itself · 0:09–0:13 FEATURE 2 cursor interacts with UI · 0:13–0:16 RESULT important metric · 0:16–0:20 CTA logo + call to action.

**Prompts (p.109) — key requirements:**
- First test: **1080×1920 · 9:16 · 60fps** · strong typography · kinetic motion · spring animations · multiple visual techniques · **something new every 2–3s** · premium sound design · no generic gradients · no corner labels · no unnecessary frames · no basic fade-only transitions · deterministic `window.seek(t)` · render `out/final.mp4` · contact sheet before final, fix 3 biggest problems.
- Study a reference: extract frames every 0.5s with FFmpeg; analyse typography · palette · pacing · shot duration · transitions · camera movement · texture · composition · text entrance/exit · rhythm → `docs/style_guide.md` + `docs/shotlist.md`.
- Storyboard first: 30s · 9:16 · 60fps; every shot has **timestamp · duration · visual · typography · camera movement · transition · animation technique · sound effect · purpose**; strong hook in first 2s; something new every 2–4s.
- Music sync: detect BPM, beats, downbeats, peaks → `beats.json`; major visual changes on downbeats, UI clicks/transitions on peaks.
- Product reel: gather **real** brand assets first (logo, colours, typography, screenshots) into `./assets`; don't invent product screens; STORY 0–2 hook · 2–6 intro · 6–12 three features · 12–16 result · 16–20 logo + CTA; one accent colour.
- UI morph: one container stays alive the whole video (Logo → CTA → field → loader → success → card → chart → tooltip → palette → notification → Logo); animate width/height/radius/position/content/type with springs; cursor drives it; **final frame = first frame** for a seamless loop.
- Procedural sound: UI click · soft pop · transition whoosh · low-frequency impact · final logo hit, synced to the timeline.
- Multiple formats: same timeline, **responsive compositions for 9:16, 1:1, 16:9 — do not simply crop; reposition and resize typography and UI per ratio.**

**Render & self-review (p.110):**
```
node render.mjs --fps 60 --dur 15 --sub 4
# Chromium -> Playwright -> PNG frames -> FFmpeg -> MP4 (H.264, CRF 16, yuv420p)
ffmpeg -i out/final.mp4 -vf "fps=2,scale=270:-1,tile=6x5" -frames:v 1 out/contact.png      # contact sheet
ffmpeg -i out/final.mp4 -vf "fps=1,scale=360:-1,tile=5x3" -frames:v 1 out/phone.png        # phone readability
ffmpeg -ss 4.1 -i out/final.mp4 -vf "scale=320:-1,tile=12x1" -frames:v 1 out/strip.png     # fast-moment strip
ffmpeg -stream_loop 1 -i out/final.mp4 -c copy out/loop_check.mp4                          # loop join test
```
(`--sub 4` = sub-frame sampling flag of render.mjs, e.g. for motion blur — implement it in render.mjs [builder note].)
Self-review: open `out/contact.png`, act as a strict professional motion director, **score 1–10 on the 10 categories:**
1. first 2-second hook · 2. typography · 3. phone readability · 4. composition · 5. motion quality · 6. visual variety · 7. pacing · 8. brand accuracy · 9. sound sync · 10. overall polish.
Identify the **3 biggest problems with exact timestamps**, fix, render again, new contact sheet; **repeat until every important category ≥ 8/10**. Phone: everything important readable at **360px width**; fix anything too small, crowded or low-contrast. Strip: check popping, overlaps, text collisions, abrupt movement, broken morphing, inconsistent spacing. Seamless loops: last frame connects to first (same positions, cursor, scale, rotation, background, camera).
**Export sizes (p.110):** Instagram/TikTok/Shorts **1080×1920 9:16** · Square **1080×1080 1:1** · YouTube/website hero **1920×1080 16:9** — **dedicated layouts, never just crop**.
**Used automatically in website builds (p.110):** hero loop (16:9, **≤ 4MB, muted, poster**) · product reveal / exploded view as frame sequence for #12/#23 · logo sting for the #01 preloader · social preview video · a 9:16 launch reel offered at hand-over. Same palette/fonts as the site; licensed music or procedural SFX only (Part 05, p.81).
**[proposal] 9:16 layout rules for the Escape Door reel:** keep text inside a central safe area (avoid top ~250px and bottom ~350px where IG/Reels UI overlays sit, and right-edge action buttons) [builder note — not in playbook]; stacked vertical condensed caps suit 9:16 natively; manga panels reflow as vertical strips rather than cropped 16:9 frames.

---

## 13. Part 12 — No boring UI, anywhere (p.111–p.114)

**Rule (p.112):** applies to websites, web apps, dashboards, mobile apps, forms, login/checkout flows, emails, decks, PDFs, videos. Never ship a default template. Every screen needs **(1) one clear visual idea from Part 02, (2) feedback on every action within 100ms, (3) designed loading, empty, error and success states, (4) at least one memorable micro-interaction.** Free-only; respect prefers-reduced-motion.

| Boring default | Make it alive | Technique |
|---|---|---|
| Plain "Submit"/"Place order" | Button tells a tiny story then becomes the confirmation | #66 |
| 4 grey OTP boxes | Focus glow, digit pop, boxes morph into success | #67 |
| Login form on white | Mascots watch the cursor, hide eyes on password | #68 |
| "Are you sure?" alert | Arm-then-confirm, file shredded, **Undo for 5s** | #69 |
| "Payment successful" text | Receipt prints, PAID stamp, confetti once | #70 · #71 |
| Flat dark background | Slow brand-colour glow mesh with grain | #72 |
| Spinner | Skeleton shimmer, or a storytelling loader matching the brand | #01, #06 |
| Empty table/list | Illustrated empty state + one clear action | — |
| Instant page swap | Shared-element / view transition | #53 |
| Static numbers | Count-up tickers, animated charts | #17 |
| Generic hero | Product theatre, exploded view, giant type | #51, #23, #47 |

**Screen checklist (p.112):** [ ] hover, press, focus, disabled states on every control [ ] loading = skeleton or branded loader, never a bare spinner [ ] empty state with illustration + action (e.g. empty cart) [ ] error with a human message and a way out [ ] success moment for the main goal of the flow [ ] transitions between screens, not hard swaps.
**Restraint (p.112):** **one signature micro-interaction per flow**, small ones elsewhere; **celebrations (confetti) only for real milestones**; **UI durations 150–400ms**; never block the user; always keep an undo for destructive actions.
**Everything else (p.114):** dashboards = bento (#50), count-up KPIs (#17), animated charts, command palette, toasts, skeletons, glow-mesh header (#72), dark + light theme · forms & checkout = inline validation with gentle shake, progress steps, #66 submit, #70 receipt, #71 success · emails = same palette/fonts (web-safe fallbacks), one hero image, one bold CTA, no animation · decks/PDFs = Part 02 style, big type contrast, real images, one idea per slide, accent word trick · videos = Part 11 (hook in 2s, springs, something new every 2–4s, self-review to 8/10).
Mobile-app rules (p.113, if ever needed): Expo + Reanimated/Moti/Gesture Handler/Skia/Lottie/Rive/expo-haptics; 60fps on mid-range Android; touch targets ≥ 44pt; UI-thread animations; reduced motion, dark mode, dynamic text, RTL; splash → first screen < 2s.

**[builder note] Admin/dashboard (if built, e.g. orders view with recharts):** apply the same table — skeletons, empty states, sonner toasts, #17 KPIs, #69 delete with undo.

---

## 14. Project-specific risks & decisions for all build agents

1. **IP / copyright (highest risk).** The playbook forbids "copyrighted characters, logos or brand names the client does not own" (p.9) and never "brand logos you don't own" (p.84); prompt 05 shows the pattern: original hero, no franchise name/logo/emblem/costume (p.100). For an anime-merch store: **use only the client's own product photography** of their merch; do not generate, trace or draw anime characters, series logos or title wordmarks for site decoration, mascots, AI images, 3D models or the reel; do not use franchise names as design elements (product titles/descriptions are the client's own content — leave legal review of those to the client). Japanese subtitles = original copy only. Any mascot (#68, #66 story layer) must be an original design.
2. **No fake claims:** counters (#17), "X sold", ratings, testimonials, fest partnerships must be real and client-signed (p.9, p.90). Use the fest names only as factual history the client confirms.
3. **Mobile-first reality:** assume a mid-range Android on 4G; Accent 3D only; pinned/scrubbed sections simplified < 768px; Lenis off on touch; no cursor effects on touch (p.43, p.73, p.102, p.105).
4. **Hosting = Netlify free** (allowed, p.6/p.81). Playbook's Cloudflare/OpenNext notes don't apply; use Netlify's Next.js support [builder note — verify current Next 16 support via Context7].
5. **Search Console:** client site → the human does verify/submit/inspect; use the API only if the client adds the service account (p.91).
6. **Prices:** INR from `docs/source/NOTEBOOK_TRANSCRIPTION.md`; never invent prices (p.6 "ask for facts you cannot invent").
7. **Verification per section (p.6, p.74):** Playwright at 390/768/1280/1920 + 5 scroll positions per pinned section; DevTools perf trace; no horizontal scroll; no overlaps; Lighthouse ≥ 90 mobile; report only what was actually run (p.7).

---

## Critic addenda (2026-10-19, completeness pass)

**Accuracy spot-check.** I compared 8 technique entries with `docs/source/playbook.txt`: #01 and #02 (p.33), #03 and #04 (p.34), #07 and #08 (p.37), #09 and #10 (p.38), #66 (p.54), and #70 and #71 (p.66). The values, code and pitfalls match the source, and so do the page cites. One small difference: in #70 the playbook text says the stamp rotates −14°, but its code uses `rotate:-30`. Either value is faithful to the source.

**Precedence.** DESIGN.md and CONTRACTS.md were written after this file, and they override every **[proposal]** here:
- **Tokens and fonts.** Ignore the §3.2 token block (`--bg/--ink/--brand/--accent/--muted`) and the Space Grotesk / IBM Plex Mono pairing. The binding set is in CONTRACTS §2 and DESIGN §2–3:
  - Colours: `ink paper volt hype lav pink door tone-1..4`.
  - Fonts: Anton display, Bangers + Dela Gothic One for SFX, DM Sans body, JetBrains Mono for labels and prices, Noto Sans JP for subtitles.
  - Easing: `EASE.out 'expo.out'`, `punch 'power4.out'`, `slam 'back.out(1.7)'`, `inOut 'power3.inOut'`. Spring: stiffness 400, damping 28.
- **Home section order.** The §11 proposal is replaced by DESIGN §8 / CONTRACTS §7 (S00Preloader … S13Instagram).
- **Hosting (§14.4).** The "verify Netlify Next 16 support via Context7" item is resolved: see stack-notes §8.1. Cache Components, Turbopack and Server Actions are supported, and the adapter is auto-installed.

**Technique conflicts with the stack.** Read these together with stack-notes:
- **#22 and #63 code uses drei `ScrollControls` / `useScroll().offset`.** Do **not** use that on this site, because it creates its own scroll container that fights Lenis and ScrollTrigger (stack-notes §5). Instead, drive `progress` from a GSAP ScrollTrigger (`scrub`), write it to a ref or zustand store, read it in `useFrame`, and call `invalidate()`.
- **#53 Page transition.** React 19.3's `<ViewTransition>` is **stable** and works in the App Router with no config (`import { ViewTransition } from 'react'`; Next docs `guides/view-transitions.md`). It is no longer "experimental", so you do not need `next-view-transitions`. See stack-notes addenda for the `share="morph" default="none"` rule.
- **#20 Lenis "never on touch".** Lenis 1.3.27 already leaves touch native (`syncTouch` is off by default), and it honours reduced motion by default (`respectReducedMotion: true`). DESIGN §7 also says "Lenis off" for reduced motion. Either path is compliant.
- **#04 / #13 SplitText.** Use the 3.15 API: `SplitText.create(el, { type, mask: 'lines', autoSplit: true, aria: 'auto', onSplit })` and return the tween from `onSplit` (stack-notes §3.1). `aria: 'auto'` covers the playbook's `aria-label` rule.
- **#45 random rotations, #58 scatter, #72 `"random(...)"`.** Under Cache Components, `Math.random()` during a server render needs `connection()`. Compute random values client-side in effects, or use a seeded PRNG (mulberry32) keyed by index. That also avoids hydration mismatch.
- **#71 "payment success page only".** This site has **no online payment**: orders go out by WhatsApp (CONTRACTS §4 `whatsapp.ts`), and Razorpay is not wired. The real milestones are "order message sent" and "custom request sent" (DESIGN §10). Fire #71 once on `/checkout-success` and once on the Forge submit, never on add-to-cart.
- **DESIGN S01 hero uses #22 (an R3F door portal that pulls the camera through on scroll).** That is the "Scroll-driven" 3D level. §6 recommends **Accent** for a mid-range-Android audience. If it stays, it must meet these conditions:
  1. The poster image is the LCP.
  2. The canvas loads only after first paint, via `next/dynamic` with `ssr:false`.
  3. Under 768 px, on reduced motion and when `deviceMemory <= 4`: no canvas, a static or 2D panel fallback.
  4. The whole 3D payload is under 2 MB.
  5. Total JS stays under 250 KB gz, excluding 3D (p.103).

**Missing for builders (added here):**
- **Part 12 flows mapped to this site:**
  - Shop flow: the signature is #66 on Add to cart.
  - Cart: #69 remove with a sonner Undo (5 s).
  - Order: #70 receipt-style WhatsApp summary, then #71 once.
  - Forge: one signature, the upload slot morphing into a tee preview.
  - Admin: #17 KPIs, #69, skeletons.
  - Only one signature per flow, so the references.md "card peel" must not also be the signature of the same shop flow. See the references addenda.
- **Budgets to enforce in P6:**
  - LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on mobile.
  - JS < 250 KB gz excluding 3D.
  - 3D < 2 MB.
  - Hero video ≤ 4 MB.
  - Preloader ≤ 2 s on the first visit only (references.md tightens this to ≤ 1.2 s, which is fine).
  - Images ≤ 200 KB per cut-out.
