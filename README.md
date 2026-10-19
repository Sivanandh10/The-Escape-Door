# The Escape Door — anime-first fandom merch site

**Live:** https://the-escape-door.netlify.app · **Repo:** github.com/Sivanandh10/The-Escape-Door (every push to `main` auto-deploys on Netlify)

"Manga page come alive": Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 · GSAP + ScrollTrigger + Lenis · Motion · React Three Fiber (hero door) · Supabase (free) · Netlify Functions. All art is original (mascot "Kado", logos recreated, 85 sample product mockups) — see `ASSETS.md`.

## What's in it
- **Home (15 sections):** preloader → hero with 3D door portal → Choose Your Arc doors → Drop of the Week → back-print turntable → squad grid → polaroid/sticker wall → hoodie GSM power levels → cosplay stage (Basic vs LED katana) → Custom Forge teaser → Fandom Partner timeline → Catch Us Live (remind-me form) → Beyond Anime → FAQ → Instagram strip → footer.
- **Shop:** `/shop` (filters, search), `/shop/[category]`, `/arc/[collection]`, `/product/[slug]` (front/back, variants, bundle maths, add-to-cart animation), cart drawer → **WhatsApp checkout** (order saved as a lead first), `/wishlist`, `/checkout-success`.
- **Custom Forge** `/custom`: pick product → upload or "let us design it" (+₹200) → print zones (front 4×4 in, back 12×15 in, half-n-half +₹200) → minimums enforced → live price → WhatsApp.
- **Content:** `/fests`, `/cosplay`, `/about`, `/faq`, `/contact`, `/policies/*`, 404. SEO: metadata, sitemap.xml, robots.txt, OG image, JSON-LD (Organization, WebSite, Product, Breadcrumb, FAQ, CollectionPage; Event only for confirmed stalls).
- **Admin** `/admin`: dashboard KPIs + charts, analytics, fest QR codes (`?src=thomso`), leads (CSV), orders, products/collections/events/partners/Instagram/settings CRUD. Runs in clearly labelled **demo mode** until Supabase is connected.
- **Launch reel:** `reel/escape-door-reel-9x16.mp4` (15 s, 1080×1920).

## Go-live checklist (owner)
1. **WhatsApp number** → Netlify → Site configuration → Environment variables → `NEXT_PUBLIC_WHATSAPP_NUMBER` = `91XXXXXXXXXX`. Redeploy.
2. **Supabase (free):** create a project at supabase.com → SQL editor → run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`. Add to Netlify env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `ADMIN_EMAILS=<owner email>`. Redeploy.
3. **Admin login:** Supabase → Authentication → Users → *Add user* (owner email + password). Then in the SQL editor: `insert into admins (user_id) select id from auth.users where email = '<owner email>';`. Sign in at `/admin/login`.
4. Optional: `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_CLARITY_ID`; custom domain (escapedoor.in) in Netlify → Domain management, then set `NEXT_PUBLIC_SITE_URL`.
5. Answer `OPEN_QUESTIONS.md` (logo vectors, price doubts, sizes, shipping/returns, stall years) and upload real product photos in /admin → Products.
6. After the domain is live: Google Search Console (verify, submit `/sitemap.xml`), Bing Webmaster + IndexNow.

## Develop
```bash
npm install
npm run dev                            # http://localhost:3000
node --test src/lib/pricing.test.ts    # bundle/pricing tests
node scripts/generate-mockups.mjs      # regenerate sample mockups (dev server running)
```
Docs: `BRIEF.md`, `DESIGN.md`, `SITEMAP.md`, `docs/API.md` (as-built APIs), `docs/CONTRACTS.md`, `ASSETS.md`, `OPEN_QUESTIONS.md`.
