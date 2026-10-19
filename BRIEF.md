# BRIEF — The Escape Door (escapedoor.in)

**Type:** client site · new build · fandom merch e-commerce (WhatsApp checkout) + custom-merch studio + fest partner showcase.

## The 4 business questions
| | |
|---|---|
| **Goal** | Turn anime fans into WhatsApp orders and custom-merch leads; turn fest and stall foot traffic (QR codes) into tracked buyers; show fest organisers they are a proven Fandom Partner. |
| **Who + device** | Indian college students, 17–25, who arrive from Instagram (@escapedoor.in) or a QR code at a fest stall. ~85% on mid-range Android phones over 4G. Second audience: fest organising teams (desktop, looking for partners and sponsors). |
| **8-second message** | *Original anime merch — oversized tees, hoodies, polaroids, posters and props — at student prices, custom-made on demand. Pick your arc.* |
| **One action** | **Add to cart → Buy on WhatsApp.** Secondary: **Open the Custom Forge** (custom order lead). Both visible in the first screen and repeated at the end. |

## Industry & positioning
Fandom / streetwear merch, India. Positioning: **the premium, story-first anime store** — original fan-inspired art (never official logos or copied character art), student pricing, and a visible fest pedigree (Thomso ×3, Fluxus, Alcheringa's Alcher Con, Ignus, Zeitgeist, Blithchron, Abhivyakti).

## Experience concept
**"Manga page come alive."** The site is a living manga volume: every scroll is a page turn, every anime collection is a door into its arc. Anime is ~80% of the experience; Jane-Austen/Swiftie/Harry-Potter/K-pop/F1/Pixar fans get one "Beyond Anime" door.

## 3D test (Part 04) → level: **Scroll-driven (hero only) + Accent**
- Hero: an R3F door portal that opens as you scroll and pulls the camera through — lazy-loaded after first paint, poster image first (LCP is the poster/type, never the canvas), DPR capped, paused off-screen, skipped entirely under `prefers-reduced-motion` and on low-memory devices.
- Everything else is 2D (SVG, canvas halftone, CSS/GSAP) so mid-range Android stays at 60 fps.

## Success criteria
- Lighthouse mobile ≥ 90 (perf, a11y, best practices, SEO); LCP < 2.5 s, INP < 200 ms, CLS < 0.1.
- Cart → WhatsApp works end-to-end with a clean pre-filled order; every order/custom request is saved as a lead before WhatsApp opens.
- Owner sees visits, top collections/products, add-to-cart rate, WhatsApp clicks and per-fest QR attribution in /admin.
- Zero fake reviews, zero invented numbers, zero franchise logos or copied character art.

## Constraints
Free tools only · Netlify free hosting · Supabase free (Postgres + Auth + Storage) · Netlify Functions · prices in ₹ from the owner's notebook (docs/source/) · unknowns tracked in OPEN_QUESTIONS.md.
