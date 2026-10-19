# Build contracts — read before writing any code

Many agents build this site in parallel inside ONE working tree. These contracts keep it coherent.
Also read: `/DESIGN.md` (art direction — binding), `/BRIEF.md`, `/SITEMAP.md` (copy/SEO), `docs/playbook-notes.md` (technique specs), `docs/stack-notes.md` (version-accurate APIs — Next 16, Tailwind 4, GSAP 3.15, motion 14, R3F 9, zod 4, zustand 5), `docs/references.md`.

## 0. Ground rules
- **Only edit files you own** (§9). Need something from a file you don't own? Import its public API as specified here; if it's missing, create a tiny local fallback inside your own files and note it in your final report — never edit another owner's file.
- **Next 16**: `params`/`searchParams` are Promises; read `node_modules/next/dist/docs/` when unsure. React 19.3. Server Components by default; `'use client'` only where needed.
- **Free-only**, no new paid services. New npm packages: avoid; if essential, report it (don't install mid-flight — another agent may be running npm).
- **No placeholders / lorem ipsum.** Real copy from SITEMAP.md / BRIEF.md. Unknown facts → render from data with `[confirm]`-free UI (e.g. "Price on request"), and never invent numbers, reviews or claims.
- **Original art only.** No franchise logos, character likenesses, crests, symbols, or copied art. Collection names are TEXT only.
- **Accessibility**: semantic HTML, one H1 per page, focus-visible ring (`--door` 3px offset), alt text, aria-hidden on decorative SFX, keyboard reachable, contrast AA, touch targets ≥ 44px.
- **Motion**: GSAP + ScrollTrigger via `useGSAP` (scope + cleanup), Lenis via the global provider, Motion (`motion/react`) for micro-UI. Every animation has a reduced-motion path (use `useReducedMotion()` from `@/lib/motion`). UI durations 150–400 ms.
- **Performance**: no layout thrash, transforms/opacity only, `will-change` sparingly, images via `next/image` with sizes, lazy-load heavy client components with `next/dynamic`, R3F only in the hero.
- **Verify your work**: dev server runs at **http://localhost:3100** (shared — never start/stop it, never run `next build`). Screenshot with `node scripts/shot.mjs <url> --out=qa/<you> --widths=390,768,1440 --scrolls=...` then **Read the PNGs and look at them**. Typecheck only your files: `npx tsc --noEmit -p . 2>&1 | grep -E "<your paths>"`. Fix the 3 biggest visual problems you see each round.

## 1. Directory map
```
src/app/                    routes (see §9 owners)
src/app/lab/<name>/page.tsx isolated preview route per section/component (noindex, dev QA)
src/components/brand/       Wordmark, Badge, Mascot, DoorIcon
src/components/fx/          Halftone, Screentone, SpeedLines, InkSplat, Sfx, Ticker, Panel, VerticalType, PaperGrain, ArcMotif
src/components/motion/      SmoothScroll, Cursor, Magnetic, Tilt, SplitReveal, PageTransition, Reveal
src/components/layout/      Header, Footer, MobileMenu, SkipLink
src/components/shop/        ProductCard, ProductGrid, PriceTag, AddToCartButton, WishlistButton, CartDrawer, CartIcon(door), BundleHint
src/components/home/        S00Preloader … S13Instagram (one file per section)
src/components/forge/       Custom Forge studio
src/components/admin/       admin UI
src/lib/                    types, data, pricing, cart, whatsapp, analytics, supabase, seo, motion, utils
supabase/                   migrations/*.sql, seed.sql
netlify/functions/          track.mts (+ others if needed)
public/brand public/mockups public/textures public/og
scripts/                    shot.mjs, generate-mockups.mjs, …
```

## 2. Design tokens (owner: F1, in `src/app/globals.css` via Tailwind v4 `@theme`)
CSS vars + Tailwind colour utilities: `ink paper volt hype lav pink door tone-1 tone-2 tone-3 tone-4` → `bg-ink text-paper border-ink bg-volt text-door …`.
Per-arc vars set at runtime on `<html>` or a section: `--arc-a`, `--arc-b` (default `--door`/`--volt`) → utilities `bg-arc-a text-arc-b`.
Fonts → CSS vars + utilities: `font-display` (Anton) · `font-sfx` (Bangers) · `font-sfx-jp` (Dela Gothic One) · `font-body` (DM Sans, default) · `font-mono` (JetBrains Mono) · `font-jp` (Noto Sans JP).
Utilities/classes F1 provides: `.panel` (ink border 4px, no radius) · `.panel-paper` · `.shadow-hard` (6px 6px 0 ink) / `.shadow-hard-volt` · `.screentone` (dot bg) · `.outline-text` (transparent fill, ink/paper stroke) · `.accent` (volt highlighter behind an `<em>`) · `.label` (mono 11–12px uppercase tracked) · `.container-x` (max 1440, 16px→24px gutters) · `.section-y` (72–96 mobile / 120–180 desktop padding) · `.focus-ring`.
Easing tokens (`src/lib/motion.ts`): `EASE = { out: 'expo.out', punch: 'power4.out', slam: 'back.out(1.7)', inOut: 'power3.inOut' }`, `SPRING = { type:'spring', stiffness: 400, damping: 28 }`, `DUR = { ui: 0.2, enter: 0.9, slam: 0.45 }`.

## 3. Shared types — `src/lib/types.ts` (owner: F2)
```ts
export type ProductType = 'tshirt'|'hoodie'|'polaroid'|'bookmark'|'poster'|'badge'|'sticker'|'keychain'|'cosplay'|'katana'|'figurine'|'cape'|'accessory'|'hat'|'tote'|'stationery'
export type Motif = 'smoke'|'walls'|'flames'|'waves'|'spiral'|'ribbons'|'speedlines'
export interface Collection { slug: string; name: string; jp: string; group: 'anime'|'beyond'; accentA: string; accentB: string; motif: Motif; tagline: string; blurb: string; order: number; featured: boolean; subFandoms?: string[] }
export interface Variant { id: string; label: string; price: number|null; attrs?: Record<string,string> }
export interface ProductImage { src: string; alt: string; side?: 'front'|'back'|'detail'; sample?: boolean }
export interface Product { id: string; slug: string; name: string; type: ProductType; collection: string; tags: string[]; designTitle: string; jpTitle?: string; description: string; images: ProductImage[]; variants: Variant[]; sizes?: string[]; priceFrom: number|null; priceOnRequest?: boolean; bundleRuleId?: string; customizable: boolean; featured: boolean; dropOfWeek: boolean; stock: 'in'|'low'|'out'|'made-to-order'; colorBlock: string; createdAt: string }
export interface BundleRule { id: string; label: string; appliesTo: { type: ProductType; variantAttr?: [string,string] }; kind: 'nForPrice'|'buyXgetY'; n: number; price?: number; free?: number }
export interface CustomRule { type: ProductType; minQty: number; unitPrice: number|null; note: string }
export interface CartItem { key: string; productId: string; slug: string; name: string; type: ProductType; collection: string; variantId: string; variantLabel: string; size?: string; unitPrice: number|null; qty: number; image: string; custom?: CustomSpec }
export interface CustomSpec { mode: 'own'|'company'; product: ProductType; fileUrls: string[]; zones: Array<{ zone: 'front'|'back'; x: number; y: number; scale: number }>; halfHalf: boolean; notes?: string; quantity: number }
export interface CartTotals { lines: Array<CartItem & { lineTotal: number|null; saving: number }>; subtotal: number; savings: number; total: number; hasPriceOnRequest: boolean; applied: Array<{ ruleId: string; label: string; saving: number }>; hints: string[] }
export interface FestEvent { id: string; name: string; venue: string; city: string; startDate: string|null; endDate: string|null; dateLabel: string; confirmed: boolean; kind: 'stall'|'popup'|'fest'|'online'; status: 'upcoming'|'past' }
export interface Partnership { id: string; fest: string; institution: string; years: string; role: string; detail?: string; order: number }
export type LeadKind = 'whatsapp_order'|'custom_request'|'remind_me'|'newsletter'|'exit_intent'
export interface LeadInput { kind: LeadKind; name?: string; city?: string; contact?: string; message?: string; payload?: unknown; source?: Attribution }
export interface Attribution { src?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string; referrer?: string; landing?: string }
export interface SiteSettings { heroKicker: string; heroTitle: string; heroSub: string; bannerText: string; tickerWords: string[]; whatsapp: string; instagram: string }
export interface InstaPost { id: string; image: string; url: string; caption: string; order: number }
```

## 4. Data & logic APIs (owner: F2)
- `src/lib/data/seed.ts` — `collections`, `products` (≥ 48: every anime arc × tees/hoodies/polaroids/posters/bookmarks/badges/stickers + cosplay/katana/capes/figurines/earrings/keychains + Beyond Anime), `bundleRules`, `customRules`, `events`, `partnerships`, `instaPosts`, `settings`, `hoodieTiers`, `teeFits`. Prices exactly per `docs/source/NOTEBOOK_TRANSCRIPTION.md`.
- `src/lib/data/repo.ts` (server-only) — `getCollections()`, `getCollection(slug)`, `getProducts(filter?: {collection?, type?, q?, min?, max?, featured?})`, `getProduct(slug)`, `getDropOfWeek()`, `getEvents()`, `getPartnerships()`, `getSettings()`, `getInstaPosts()`. Supabase when env present, else seed. Never throws to the UI — falls back to seed.
- `src/lib/pricing.ts` — pure: `computeTotals(items: CartItem[], rules = bundleRules): CartTotals`, `formatINR(n)` ("₹1,200"), `customQuote(spec, product?)`, `minQtyFor(type)`. Unit tests in `src/lib/pricing.test.ts` (run with `node --test` via tsx-free approach or a tiny TS runner — F2 decides and documents).
- `src/lib/cart.ts` — zustand 5 + persist (`localStorage` key `ted-cart-v1`): `useCart()` → `{ items, add(item), remove(key), setQty(key,q), clear(), open, setOpen(b), lastAdded }`; `useWishlist()` → `{ ids, toggle(id), has(id) }`. Hydration-safe hook `useHydrated()`.
- `src/lib/whatsapp.ts` — `buildOrderMessage({ items, totals, name, city, note, customLinks })` → clean multi-line text; `waLink(text)` → `https://wa.me/${NEXT_PUBLIC_WHATSAPP_NUMBER}?text=…`.
- `src/lib/analytics.ts` (client) — `track(event, props?)`, `initAnalytics()` (pageview, scroll depth 25/50/75/100, time on page via `sendBeacon` on hide, visitor id in localStorage, `src`/UTM capture into sessionStorage → `getAttribution()`). Events: `page_view add_to_cart remove_from_cart wishlist_add whatsapp_click checkout_start custom_start custom_submit remind_me newsletter collection_open product_view search filter`.
- `src/lib/leads.ts` (client) — `submitLead(input: LeadInput): Promise<{ ok: boolean; id?: string; stored: boolean }>` → POST `/api/lead`.
- `src/lib/supabase/{client,server,admin}.ts` — browser client, server client (cookies), service-role client (server-only). `isSupabaseConfigured()`.
- `src/lib/seo.ts` — JSON-LD builders: `orgJsonLd() websiteJsonLd() productJsonLd(p) breadcrumbJsonLd(items) eventJsonLd(e) faqJsonLd(qa) itemListJsonLd(products)` + `<JsonLd data={…}/>` component in `src/components/seo/JsonLd.tsx`. `SITE_URL` from `NEXT_PUBLIC_SITE_URL`.
- `src/lib/motion.ts` — tokens (§2), `useReducedMotion()`, `registerGsap()` (registers ScrollTrigger, SplitText, DrawSVGPlugin, Flip once, client only).
- API routes: `POST /api/lead` (zod, rate limit, honeypot, insert → `leads`), `POST /api/track` (batch → `events`, geo from Netlify header), `POST /api/upload-url` (signed upload URL for bucket `custom-uploads`, max 10MB, png/jpg/webp/svg/pdf). Also `netlify/functions/track.mts` using `context.geo` (F2 decides which the client uses after reading stack-notes; documents it).
- Supabase SQL (`supabase/migrations/0001_init.sql`): tables `collections products bundle_rules custom_rules events partnerships insta_posts settings leads orders analytics_events admins`, RLS (public read for catalogue tables; insert-only via API for leads/events; owner-only (`is_admin()`) for everything else), storage buckets `product-images` (public read) and `custom-uploads` (private). `supabase/seed.sql` generated from seed.ts by `scripts/gen-seed-sql.mjs`.

## 5. Brand & FX component APIs
- F3 `src/components/brand/Wordmark.tsx` — `<Wordmark variant="full"|"bracket"|"stacked" className animated? />` (SVG, door-bracket "[" filled with mini manga panels; `animated` enables the #24 stroke-draw with ids exposed via `data-draw` paths). Also `public/brand/wordmark.svg`, `badge.svg`, `favicon.svg`, `icon-512.png`, `apple-touch-icon.png`.
- F3 `src/components/brand/Badge.tsx` — `<Badge size />` cream circle retro rust lettering.
- F3 `src/components/brand/Mascot.tsx` — `<Mascot mood="idle"|"peek"|"wave"|"shock"|"sleepy"|"cheer"|"work" size={number} className animate? />` — pure SVG; `animate` adds idle bob (CSS, reduced-motion aware).
- F3 `src/components/brand/DoorIcon.tsx` — `<DoorIcon open={0..1} />` small door used by the cart icon.
- F3 `src/components/fx/ArcMotif.tsx` — `<ArcMotif motif="smoke"|... colorA colorB className animated? />` original SVG/canvas motifs per arc.
- F3 product mockups: `public/mockups/<product-slug>-front.webp`, `-back.webp` (black oversized tee with original back print on its `colorBlock`, design title repeated behind, corner tag "SAMPLE — replace with real photo"), and flat-lay mockups for polaroids/posters/bookmarks/badges/stickers/props. Generated by `scripts/generate-mockups.mjs` from `seed.ts` (deterministic). Plus `src/components/shop/TeeArt.tsx` — `<TeeArt product side="front"|"back" />` SVG version of the same tee for animated sections (Drop of the Week / Back-Print Reveal / Forge).
- F1 `src/components/fx/*`: `<Halftone src|color dotSize angle className />` (CSS mask / canvas), `<Screentone density="light|mid|dense" />`, `<SpeedLines intensity? focus? />` (canvas, reads Lenis velocity from `useScrollVelocity()`), `<InkSplat variant={1..6} />`, `<Sfx text="ドン!" jp size tone="ink|volt|hype" rotate />`, `<Ticker items speed direction tone rotate />` (#37), `<Panel tone slant="none|left|right" className>` (thick border, optional diagonal clip), `<VerticalType text side />`, `<PaperGrain />`.
- F1 `src/components/motion/*`: `<SmoothScroll>` (Lenis + GSAP ticker sync; exposes `window.__lenis`; `useLenis()`, `useScrollVelocity()`), `<Cursor />` (#31: dot + ring; label from nearest `[data-cursor="OPEN"|"ADD"|"VIEW"|"DRAG"]`; hidden on touch), `<Magnetic strength>` (#30), `<Tilt max>` (#29), `<SplitReveal as="h2" text trigger="scroll|load" />` (#04, GSAP SplitText, masked lines), `<Reveal stagger>` (#07/#08), `<PageTransition />` (#53 manga page-turn ink wipe between routes; first-load excluded).
- F1 layout: `<Header />` (wordmark, nav: Shop · Arcs ▾ · Custom Forge · Fests · Cosplay; search; wishlist; **door-shaped cart icon** with count; mobile menu as a manga panel sheet), `<Footer />` (giant outline "ESCAPE DOOR" #47, links, Instagram, disclaimer, newsletter form → `submitLead({kind:'newsletter'})`), `<Providers>` (SmoothScroll, Cursor, Toaster(sonner styled), CartDrawer mount point, analytics init, ArcTheme context `useArcTheme().set(collectionSlug|null)` → sets `--arc-a/--arc-b` on `<html>` with a 400ms tween).

## 6. Shop component APIs (owner: P1 shop agent unless noted)
- `<ProductCard product priority? />` — panel card, front image; hover/focus crossfades to back print (#28 + #40); price via `<PriceTag>`; `data-cursor="ADD"`; wishlist heart; quick "Add" for single-variant items.
- `<AddToCartButton product variant size qty onAdded? />` (#66 storytelling button: label morphs → product thumbnail flies (FLIP) into the header door-cart which opens a crack → "ADDED!" SFX pop; < 100ms feedback; reduced-motion = instant + toast).
- `<CartDrawer />` (owner: P2 cart agent) mounted by F1 Providers via `next/dynamic` import of `@/components/shop/CartDrawer`.

## 7. Sections (home) — `src/components/home/S##Name.tsx`, default export, no props except optional data passed from `src/app/page.tsx`
S00Preloader · S01Hero · S02ChooseArc · S03Drop · S04BackPrint · S05Squad · S06Wall · S07Gsm · S08Cosplay · S09ForgeTeaser · S10Partners · S11Live · S12Beyond · S13Instagram. Footer is F1. `src/app/page.tsx` (owner: F1) composes them in order, fetching data via repo and passing it down. Each section root: `<section id="<kebab>" aria-labelledby=…>` with its own H2 (accent word in `<em>`), JP subtitle, and `data-arc` where relevant.

## 8. Analytics/attribution
Fest QR links: `/?src=thomso` etc. — `initAnalytics` stores `src` for the session and every lead/order carries `source`. WhatsApp message footer includes `ref: <src>` when present.

## 9. File ownership
| Owner | Files |
|---|---|
| **F1 design-system & shell** | `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/template.tsx` (if used), `src/components/{fx,motion,layout}/**`, `src/components/Providers.tsx`, `src/lib/motion.ts`, `src/lib/utils.ts`, `src/app/lab/system/**` |
| **F2 data, logic & backend** | `next.config.ts`, `src/lib/{types,pricing,pricing.test,cart,whatsapp,analytics,leads,seo}.ts`, `src/lib/data/**`, `src/lib/supabase/**`, `src/components/seo/**`, `src/app/api/**`, `netlify/**`, `netlify.toml`, `supabase/**`, `scripts/gen-seed-sql.mjs`, `.env.example` |
| **F3 brand & assets** | `src/components/brand/**`, `src/components/fx/ArcMotif.tsx`, `src/components/shop/TeeArt.tsx`, `public/**`, `scripts/generate-mockups.mjs`, `ASSETS.md`, `src/app/icon.*`, `src/app/apple-icon.*`, `src/app/lab/brand/**` |
| Section agents | their `src/components/home/S##*.tsx` (+ private subfolder `src/components/home/s##/**`), `src/app/lab/s##-*/**` |
| P1 shop | `src/app/shop/**`, `src/app/arc/**`, `src/app/product/**`, `src/components/shop/**` except CartDrawer/CartPanel/checkout |
| P2 cart & checkout | `src/components/shop/{CartDrawer,CartPanel,CheckoutForm,WishlistView}.tsx`, `src/app/{cart,wishlist,checkout-success}/**` |
| P3 forge | `src/app/custom/**`, `src/components/forge/**` |
| P4 admin | `src/app/admin/**`, `src/components/admin/**`, `src/proxy.ts` (admin guard, if needed) |
| P5 content & SEO | `src/app/{fests,cosplay,about,faq,privacy}/**`, `src/app/not-found.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/opengraph-image.tsx`, `src/app/manifest.ts` |
| P6 reel | `reel/**` |

## 10. Lead decisions after research (BINDING — override anything above or in other docs)
1. **Cache Components is ON** (`next.config.ts`). Read `docs/stack-notes.md` §1 + Critic addenda before writing any route. No `export const dynamic/revalidate/runtime/dynamicParams`. Data via `'use cache'` functions in `repo.ts` using a **cookie-less** Supabase client (`publicClient()`), falling back to seed. Anything reading cookies/headers/searchParams goes inside `<Suspense>`. Public pages must stay static: `/shop` renders ALL products statically and filters/searches **client-side** (read the query with `useSearchParams` in a client child wrapped in `<Suspense>`); canonical is always the clean path. No server pagination (catalogue < 100 items; client "load more").
2. **`@gsap/react` is installed** — use `useGSAP`. Never put Tailwind `rotate-/translate-/scale-` classes on elements GSAP animates (they stack).
3. **3D:** never drei `ScrollControls` (fights Lenis) — drive cameras from GSAP ScrollTrigger. R3F only in the hero, behind the gate in DESIGN §7b. Do not upgrade React.
4. **Analytics endpoint:** client posts to `NEXT_PUBLIC_TRACK_ENDPOINT` (default `/.netlify/functions/track`, which uses `context.geo`; never store IP). `/api/track` is NOT created. In `next dev` the request 404s silently — `track()` must swallow errors. Lead/upload routes stay as Next route handlers (`/api/lead`, `/api/upload-url`).
5. **Personal data:** forms collect only what's needed (name, city, optional WhatsApp/contact, message), with a one-line consent note linking `/policies/privacy` (DPDP Act 2023). Analytics: random anonymous visitor id + country/region/city only. No IP, no fingerprinting.
6. **Types:** add `updatedAt: string` to `Product` (sitemap lastModified). `FestEvent.dateLabel` shows e.g. "21–28 Feb · dates to be confirmed" — **no invented year**; `startDate/endDate` null until confirmed; Event JSON-LD only when `confirmed && startDate`.
7. **Routes added:** `/policies/privacy`, `/policies/shipping`, `/policies/returns`, `/policies/terms`, `/contact` → owner **P5**. Policies render the facts we have and clearly mark unknown items as "being finalised — message us on WhatsApp" (no invented terms).
8. **Home sections:** add `S14Faq.tsx` (owner **P5**) rendered between S12 and S13. Shop signature = #66 (see DESIGN §7b); the card "peel" only in S05.
9. **Product naming:** original codename titles (e.g. "Cursed Static", "Beyond the Wall", "Flame Breath Ribbon") — never character names in product titles; collection name as a tag/text. Footer disclaimer: "Original fan-inspired designs. Not affiliated with or endorsed by any anime studio, publisher or rights holder."
10. **Supabase file names** follow §4 (`client.ts`, `server.ts` [also exports `publicClient()`], `admin.ts`). Cart persist `name: 'ted-cart-v1'` with `version` + `migrate`.
11. **Netlify cost:** functions only where needed; images via `next/image` from `/public` (Supabase-hosted product photos use `unoptimized` or remotePatterns — F2 configures `next.config.ts` images: `qualities: [60, 75, 85]`, remotePatterns for `*.supabase.co`). F2 owns `next.config.ts`.
12. **Preloader** ≤ 2 s, once per session, skipped for reduced motion and bots (`navigator.webdriver` false-positives are fine for QA — add `?nopreload` to skip in screenshots).
13. **Live site:** https://the-escape-door.netlify.app (Netlify, auto-deploys every push to `main` of github.com/Sivanandh10/The-Escape-Door). `SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL (Netlify build var) || 'https://the-escape-door.netlify.app'` (dev: localhost only if NODE_ENV=development and nothing else set). Never push a commit that fails `next build`.

## 12. Admin kit (owner: P4a — `src/components/admin/**` except `crud/**`) — AS BUILT
Import from the barrel `@/components/admin` (or the individual files). Server helpers from `@/components/admin/server`, auth actions from `@/components/admin/actions`.
**Shell is automatic:** `src/app/admin/layout.tsx` wraps every `/admin/*` page in `<AdminShell>` (sidebar, demo banner, mobile sheet, owner gate, noindex, hides the public header/footer). Pages render only `<AdminPage>` + content — never AdminShell themselves.

**Mode / auth**
- `useAdmin() → { demo: boolean; email: string|null }` (client). `demo` = Supabase env missing → read seed (`@/lib/data/seed`), **disable writes** and show `DEMO_WRITE_NOTE` (exported string) as tooltip/inline note.
- Server (pages/actions, inside `<Suspense>`): `getAdminContext() → { demo, session }` · `requireAdmin()` (redirects to /admin/login when signed-out / not owner; passes in demo) · `adminDb()` → cookie-bound Supabase client (RLS `is_admin()`) or `null` in demo. Re-check in every Server Action (`requireAdmin()`), then `updateTag(TAGS.x)` from `@/lib/data/repo`.
- Browser writes: `supabaseBrowser()` (RLS applies to the signed-in owner). `src/proxy.ts` matcher = `/admin` + `/admin/:path*` only; sets `x-ted-path` request header + `X-Robots-Tag: noindex`.

**Layout**
- `<AdminPage title no? jp? kicker? description? actions? toolbar? className?>` — page header (the page's single H1; wrap the accent word in `<em>`), `no` = chapter "04" (see `ADMIN_NAV` in `nav.ts`: 01 dashboard, 02 analytics, 03 qr, 04 leads, 05 orders, 06 products, 07 collections, 08 events, 09 instagram, 10 settings). Children are spaced `space-y-6/8`.
- `<AdminPanel title? jp? action? tone?='ink'|'paper'|'volt'|'lav'|'door' shadow?='none'|'door'|'volt'|'paper' id? index? className? bodyClassName?>` — section card (H2 title), staggered rise entrance by `index`.

**Data**
- `<DataTable<T> rows columns rowKey caption loading? error? onRetry? empty? search?={placeholder?, text:(row)=>string} toolbar? onRowClick? rowActions?=(row)=>ReactNode pageSize?=25 initialSort?={id,dir} selectedKey? dense? className?>` (client — props are functions, so use it from a `'use client'` component).
  `DataTableColumn<T> = { id, header, cell:(row)=>ReactNode, sortValue?:(row)=>string|number|null, align?, className?, hideOnMobile?, mobileLabel? }`. Built-in: client search, sortable headers (aria-sort), pagination, skeleton (loading), ErrorState (error + retry), EmptyState (empty / no search match), row exit animation (removed rows slide out — pairs with ConfirmShred), phone card layout < 768px (first visible column = card title), Enter/Space on rows when `onRowClick`.
- `<StatCard label value:number|null format?='int'|'inr'|'pct'(0..1)|'compact' jp? delta?(fraction vs prev) hint? tone?='ink'|'volt'|'lav'|'pink'|'door' icon?(element) index?>` — #17 count-up on view; `formatStat(v, format)`.

**States**
- `<EmptyState title body? action? mood?='work' sfx?='シーン…' compact?>` (server-safe, mascot Kado) · `<AdminSkeleton variant?='table'|'cards'|'chart' rows?>` · `<ErrorState title? message? onRetry? retrying?>` (client).

**Destructive (#69 + undo)**
- `<ConfirmShred itemLabel onConfirm onCommit? onUndo? undoMs?=6000 label?='Delete' variant?='icon'|'button' confirmText? disabled? disabledReason?>` — trash button → "Shred this?" slip → shred animation → `onConfirm()` (remove optimistically) → sonner toast with **Undo** → `onCommit()` after the window (also flushed on pagehide). If `onCommit` throws: `onUndo()` + error toast. In demo pass `disabled disabledReason={DEMO_WRITE_NOTE}`.
- `shredWithUndo({ itemLabel, onConfirm, onCommit?, onUndo?, undoMs? })` — same flow without the popover (bulk deletes).

**Class helpers (server+client)**: `adminBtn({ variant?='primary'|'door'|'ghost'|'danger'|'quiet', size?='md'|'sm', className? })` · `adminInput` (inputs/selects/textareas; `aria-invalid` → red) · `adminLabel` · `adminPill(tone?='volt'|'lav'|'pink'|'door'|'hype'|'paper'|'muted')` (status chips; suggested lead status: new=volt, contacted=lav, converted=door, closed=muted, spam=hype).
