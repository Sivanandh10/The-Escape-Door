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
1. **WhatsApp number** → `/admin/settings` → *WhatsApp order number* (with country code, e.g. `+91 98765 43210`) → Save. Live immediately, no redeploy. (`NEXT_PUBLIC_WHATSAPP_NUMBER` is only a fallback when the setting is empty.)
2. **Supabase (free):** create a project at supabase.com → SQL editor → run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`. Add to Netlify env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `ADMIN_EMAILS=<owner email>`. Redeploy.
3. **Admin login:** Supabase → Authentication → Users → *Add user* (owner email + password). Then in the SQL editor: `insert into admins (user_id) select id from auth.users where email = '<owner email>';`, then run `supabase/migrations/0002_roles.sql` (makes that owner the protected superadmin). Sign in at `/admin/login`. Add everyone else from `/admin/team` (see **Team & roles**).
4. Optional: `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_CLARITY_ID`; custom domain (escapedoor.in) in Netlify → Domain management, then set `NEXT_PUBLIC_SITE_URL`.
5. Answer `OPEN_QUESTIONS.md` (logo vectors, price doubts, sizes, shipping/returns, stall years) and upload real product photos in /admin → Products.
6. After the domain is live: Google Search Console (verify, submit `/sitemap.xml`), Bing Webmaster + IndexNow.

## Team & roles
More than one person can sign in to `/admin`, each with their own login and only the rooms they need.

**Setup (once):** run `supabase/migrations/0002_roles.sql` in the Supabase SQL editor (after `0001_init.sql`; safe to run again). It adds roles and permissions to `public.admins`, rewrites the RLS policies to check them, and makes **sivanandh10cc@gmail.com the superadmin**. Then run `supabase/migrations/0003_superadmin_delete.sql` (superadmin-only deletes, see below).

**Add a member:** `/admin/team` → *Add member* → email, display name, role, optional extra permissions → *Add to team*. A strong temporary password is generated (or type your own) and shown **once** with copy buttons and the login link (`/admin/login`) — send it to them on WhatsApp. If the email already has a Supabase login it is reused. Edit a member to change role / extras / name, *Reset password* (new temp password, old one stops working) or *Remove* (confirm step; optionally deletes their login too).

**Hierarchy** (owner rule: *superadmin all access, admin all access, but only the superadmin can delete*): Superadmin (LV5) > Admin (LV4) > Editor (LV3) > Sales (LV2) > Viewer (LV1).

| Rank | Role | Opens | Delete |
|---|---|---|---|
| LV5 | **Superadmin** (one, protected) | everything, including Team | **Yes — the only one** |
| LV4 | Admin | dashboard, analytics, leads, orders, catalogue, settings, QR — creates and edits everything, not Team | No |
| LV3 | Editor | dashboard, catalogue (products, collections, events, partners, Instagram), QR | No |
| LV2 | Sales | dashboard, analytics, leads, orders, QR | No |
| LV1 | Viewer | dashboard, analytics (read only) | No |

Extra permissions can be ticked per person on top of the role (`dashboard.view analytics.view leads.view leads.edit orders.view orders.edit catalog.edit settings.edit qr.use`). *Manage team* (`team.manage`) and *Delete* (`delete`) are superadmin-only and can't be granted. Edit rights include view rights. The sidebar only shows rooms a member can open; any other admin URL shows a "locked door" page, and read-only members see edit controls disabled.

**Only the superadmin deletes.** Run `supabase/migrations/0003_superadmin_delete.sql` after `0002` (safe to run again). Every table the admin can delete from (collections, products, bundle_rules, custom_rules, events, partnerships, insta_posts, leads, orders, settings, analytics_events) and the `product-images` / `custom-uploads` buckets allow `DELETE` only when `public.admin_role() = 'superadmin'` — a permissive "superadmin delete" policy plus a restrictive "only superadmin deletes" guard, so a later `FOR ALL` policy can't reopen it. In the admin, everyone else sees delete buttons (rows, drawer *Delete*, product image *Remove*) locked with "Only the superadmin can delete"; deletes go through the `deleteRows` server action, which re-checks the superadmin before touching the database. To take something off the site without deleting it, use *Hidden* / *Spam* / *Cancelled*. If you ever re-run `0002_roles.sql`, run `0003_superadmin_delete.sql` again right after it (0002 recreates its old delete-capable policies; the restrictive guard still blocks them, but 0003 tidies them away).

**The superadmin is protected at the database level**, not just in the UI: a trigger on `public.admins` refuses to update or delete that row for every database role (including the service-role key and the SQL editor), the table can't be truncated, and no one else can ever be made superadmin. A second trigger on `auth.users` stops that login from being deleted (hard or soft), banned or moved to another email — its password can still be changed, so the owner can use "forgot password"; the app's own *Reset password* refuses the superadmin. If the owner's login doesn't exist yet, `0002_roles.sql` stops with "Bootstrap failed" and changes nothing. Team changes only go through server actions that re-check that the caller is the superadmin; browsers have no write access to `public.admins`. `0001_init.sql` is safe to re-run after `0002`: it detects the roles and skips its old `is_admin()` write policies (which would now cover every member). (Anyone with owner access to the Supabase project dashboard can still drop triggers, so keep dashboard access to yourself.)

**Pricing rules & QR links in the admin:** Catalogue → *Deals* (bundle packs: N for ₹ / buy X get Y, optional variant filter, live “saves ₹…” preview), *Custom rules* (custom-order minimums + per-piece prices, apparel design / half-n-half fees and print zones) and *Pricing* (hoodie GSM tiers, tee fits) need *Edit catalogue*; saved links in *QR codes* need *QR studio*. Everyone with the permission can add and edit; deleting (including removing a tier, fit or saved link) stays superadmin-only. Saves are live on the site straight away. No extra migration needed.

**Dashboard vs Analytics:** raw analytics rows are readable only with `analytics.view`. Members with just `dashboard.view` (e.g. Editor) get the KPIs, visits chart, funnel, top collections / products and devices, computed on the server; top pages, traffic sources and cities are left out.

`ADMIN_EMAILS` no longer blocks anyone on the team; it only bootstraps a first superadmin when no superadmin row exists yet.

## Develop
```bash
npm install
npm run dev                            # http://localhost:3000
node --test src/lib/pricing.test.ts    # bundle/pricing tests
node scripts/generate-mockups.mjs      # regenerate sample mockups (dev server running)
```
Docs: `BRIEF.md`, `DESIGN.md`, `SITEMAP.md`, `docs/API.md` (as-built APIs), `docs/CONTRACTS.md`, `ASSETS.md`, `OPEN_QUESTIONS.md`.

## Published defaults (2026-10-25, owner: "add all by yourself, I'll edit later")
- Policies live from the drafts: shipping (₹79, free above ₹999, COD up to ₹2,000 with ₹50 fee, dispatch 2–4 days / custom 7–10), returns (damage within 48 h, size exchange within 7 days, refunds 5–7 working days), terms (contact via WhatsApp/Instagram; no postal address listed yet). Edit anytime in Admin → Pages.
- Size charts saved with typical measurements (oversized, regular, baby tee, hoodie; inches, ±1"). Edit in Admin → Pricing → Size charts.
