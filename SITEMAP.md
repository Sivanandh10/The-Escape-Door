# SITEMAP.md — The Escape Door (P3 Content & SEO plan)

> Brand: **The Escape Door** (Instagram [@escapedoor.in](https://www.instagram.com/escapedoor.in)) · Market: India · Currency: INR · Language: `en-IN`
> Concept: the site is a living manga volume. Anime is ~80% of the site. Every other fandom sits behind one door, **Beyond Anime**.
> Domain: `https://{DOMAIN}` [CONFIRM: production domain, e.g. a .in domain]. All URLs below are relative to it.
> Price source: `docs/source/NOTEBOOK_TRANSCRIPTION.md`. Every number on this page comes from the notebook. Anything unknown is marked `[CONFIRM: …]`. Do not ship a `[CONFIRM]` line live. Hide that block until the owner answers.
> Method: claude-seo `seo-plan` (ecommerce template) and the playbook P3/P7 rules (one H1, an accent word in every H2, question H2s with self-contained answers). No paid APIs. DataForSEO was skipped.

---

## 0. SERP intent check (what ranks today)

The Firecrawl keyless search returned "anonymous keyless access unavailable". The free fallback was the built-in web search (US index, so treat the results as a rough guide). I ran 9 queries on 2026-10-19.

| Query | What ranks | What it means for us |
|---|---|---|
| anime oversized t-shirt India | D2C **product pages**, e.g. one Indian anime store's `/products/*-oversized-t-shirt` set, sale prices around ₹799–999 | The intent is transactional. Category and product pages win. Our ₹800 price sits under ₹1000, so build long-tails around "under 1000". |
| jujutsu kaisen t-shirt India | D2C **collection pages** (`/collections/jujutsu-kaisen-t-shirts`), Meesho product pages, marketplaces | Series × product collection pages rank. This confirms the `/arc/[collection]` hub with `?category=` handled through internal sections (see §1). |
| custom anime t-shirt printing India | Print-on-demand services, IndiaMART listings, a few blogs | Intent is commercial or service. Few results are anime-specific, so `/custom` can own this niche. |
| anime polaroid set India | Mostly **Polaroid camera** pages (the brand) | The word "polaroid" is ambiguous and also a trademark. Pair it with "prints" or "photo cards". Make pack SKUs ("set of 3") so "set" queries land on a real product. |
| anime merch store India | News and editorial lists (Outlook Respawn, university blogs) | List intent. Home won't rank here early. Win it through PR and listicle mentions plus a strong Organization entity. |
| cosplay katana LED buy India | Only non-Indian stores (US, UAE) | **Low local competition.** `/shop/cosplay-props` plus `/cosplay` is a quick-win opportunity. |
| anime posters set India | Amazon kits, small poster stores (300 GSM, "buy 4 get 2") | Bundle offers are the norm. Lead with "6 for ₹1000 / buy 5 get 1 free". |
| magnetic anime bookmarks India | Generic bookmark sellers on Flipkart and IndiaMART, no anime specialist | **Content gap.** The magnetic bookmark category can rank. |
| anime hoodie heavyweight GSM India | D2C product pages stating GSM (300–450) | Fans search by GSM. Our GSM-tier pricing (up to 430–600 GSM) is the differentiator. Put GSM in the H2s and in the filters. |

---

## 1. Page map, index rules and canonicals

Slugs are lowercase and hyphenated, with no trailing slash and no dates in URLs. Every page is reachable within 3 clicks of `/`.

| URL | Template | Index | Canonical | In sitemap.xml | Notes |
|---|---|---|---|---|---|
| `/` | Home (the "Volume cover") | index | self | yes, priority 1.0 | |
| `/shop` | Catalogue with filters | index | self (clean) | yes | All filter, sort and search params are handled by the rules below |
| `/shop/t-shirts` | Category | index | self | yes | Regular + baby tees (fit filter) |
| `/shop/oversized-t-shirts` | Category | index | self | yes | Kept separate because it is the highest-intent apparel keyword |
| `/shop/hoodies` | Category | index | self | yes | GSM-tier filter |
| `/shop/polaroids` | Category | index | self | yes | Polaroid-style prints, single and packs |
| `/shop/bookmarks` | Category | index | self | yes | Plain + magnetic |
| `/shop/posters` | Category | index | self | yes | |
| `/shop/badges` | Category | index | self | yes | |
| `/shop/stickers` | Category | index | self | yes | |
| `/shop/cosplay-props` | Category | index | self | yes | Katanas (basic/LED), capes |
| `/shop/accessories` | Category | index | self | yes | Keychains, earrings, figurines |
| `/arc/jujutsu-kaisen` | Collection (arc) | index | self | yes | Fan-inspired designs only |
| `/arc/attack-on-titan` | Collection (arc) | index | self | yes | |
| `/arc/demon-slayer` | Collection (arc) | index | self | yes | |
| `/arc/one-piece` | Collection (arc) | index | self | yes | |
| `/arc/naruto` | Collection (arc) | index | self | yes | |
| `/arc/beyond-anime` | Collection (the "door") | index | self | yes | K-pop, K-drama, F1, films, series, books, games, sports, art, coffee, spiritual |
| `/product/[slug]` | Product | index | self (no params) | yes, `lastModified` = product `updated_at` | Slug: `{design-name}-{product-type}`, e.g. `/product/cursed-flame-oversized-t-shirt`. Use the design title, never a raw character name alone. A slug never changes; if a rename is unavoidable, 301 the old slug. |
| `/custom` | Custom Forge studio | index | self | yes | |
| `/fests` | Fandom Partner arc + Catch us live | index | self | yes | |
| `/cosplay` | Cosplay guide + lookbook | index | self | yes | Editorial and commercial-investigation. It must not duplicate `/shop/cosplay-props` (see the cannibalisation guard). |
| `/about` | About | index | self | yes | |
| `/faq` | FAQ (GEO answer blocks) | index | self | yes | |
| `/policies/shipping` · `/policies/returns` · `/policies/privacy` · `/policies/terms` · `/contact` | **Recommended additions** | index | self | yes | Needed for trust (E-E-A-T), Merchant Center free listings and the payment gateway. The content is [CONFIRM: owner policies]. Do not invent shipping times or return windows. |
| `/cart` | Cart | **noindex, follow** | — | no | |
| `/wishlist` | Wishlist | **noindex, follow** | — | no | |
| `/checkout-success` | Order success (#71 success moment) | **noindex, nofollow** | — | no | Contains order data and is never cached publicly |
| `/404` (`not-found.tsx`) | Not found | returns HTTP **404**, noindex | — | no | Manga "missing page" panel with links to /shop, the 5 arcs and /custom |
| `/admin/*` | Admin | **noindex, nofollow** + `X-Robots-Tag: noindex` header + auth | — | no | `robots.txt: Disallow: /admin/` and `Disallow: /api/` |

### Canonical and parameter rules (code these in `generateMetadata`)

1. **Filters, sort and view on `/shop`** (`?size=`, `?fit=`, `?gsm=`, `?price=`, `?sort=`, `?view=`, `?arc=`): canonical = `/shop`, and the page stays `index, follow`. Don't combine noindex with a canonical; that sends mixed signals.
2. **Category as a parameter**: `/shop?category=hoodies` → **301** to `/shop/hoodies`. Use the same rule for `/shop?arc=naruto` (only `arc`, nothing else) → 301 to `/arc/naruto`. The clean URL always wins.
3. **Filters on category and arc pages** (`/shop/hoodies?gsm=430-600`, `/arc/one-piece?category=posters`): canonical = the clean path (`/shop/hoodies`, `/arc/one-piece`).
4. **Pagination** `?page=2+`: **self-canonical** (`/shop/hoodies?page=2`), index, follow. Never canonicalise page 2 to page 1, because products deeper in the list would lose crawl paths. Links are real `<a href>`. Infinite scroll also writes `?page=` into the URL.
5. **Site search** `/shop?q=…`: `noindex, follow`, canonical `/shop`. This is the WebSite SearchAction target.
6. **Product variants** (`?size=M`, `?colour=black`): one URL per design. Canonical = `/product/[slug]`. Sizes are `ProductGroup.hasVariant`, not separate pages.
7. **Tracking params** (`utm_*`, `ref`, `igshid`, `fbclid`): canonical strips them.
8. **Trailing slash, case and `www`**: one host and one form. Netlify `_redirects` 301s the rest.
9. **sitemap.xml** lists only indexable clean URLs: home, shop, 10 categories, 6 arcs, products, custom, fests, cosplay, about, faq and policies.

### Cannibalisation guards

| Pair | Who owns what |
|---|---|
| `/shop/oversized-t-shirts` vs `/shop/t-shirts` | "oversized" terms → oversized. "t-shirt / regular / baby tee" → t-shirts. Each page cross-links the other once. |
| `/shop/cosplay-props` vs `/cosplay` | **Price and buy** terms ("LED katana price", "buy cosplay cape") → shop. **Plan and inspiration** terms ("anime cosplay ideas for fest", "how to cosplay at college fest") → `/cosplay`. |
| `/arc/{x}` vs `/shop/{category}` | Series + "merch" → arc. Product type + "anime" → category. Arc pages never target "anime t-shirts" generically. |
| `/custom` vs `/fests` | "custom/print my design/bulk" → custom. "fest/collab/stall/partner" → fests. |
| `/faq` vs `/custom` FAQ block | The full answers live in `/faq`. `/custom` shows 3 answers that are written differently and links to `/faq#custom`. |

---

## 2. Indexable pages: keywords, metadata, headings, schema, links

Conventions:
- **Title** ≤ 60 characters and **meta** ≤ 155 characters, both counted including the ₹ sign.
- In every **H2**, the accent word is marked `**word**`. It renders in electric yellow or lavender on a screentone chip, as a design token, not inline-styled text.
- Japanese subtitles sit **outside** the `<h2>` element in a `<span lang="ja" aria-hidden="true">`, so the heading text stays clean for search and screen readers.
- One H1 per page. Animated split-text keeps the real sentence in the DOM, with `aria-label` on the wrapper.
- Content-brief word targets: Home ~600 words · Category ~350–450 words (intro of ~60 words above the grid, the rest below it) · Arc ~400 · Product ~250–400 (unique, never templated filler) · Custom ~900 · Fests ~700 · Cosplay ~900 · FAQ ~1,000.

### 2.1 Home `/`
- **Primary:** anime merch India
- **Secondary:** anime merchandise online India · anime oversized t-shirts · fandom collectibles India · anime gifts for college students
- **Intent:** commercial + navigational (brand)
- **Title:** `Anime Merch India: Tees, Hoodies & Props | The Escape Door`
- **Meta:** `Fan-inspired anime merch: oversized tees ₹800, hoodies from ₹1200, polaroids ₹50, posters, badges and cosplay katanas. Custom orders open.`
- **H1:** Anime merch, drawn like a living manga volume
- **H2s:**
  - Pick your **arc**: Jujutsu Kaisen, One Piece, Naruto and more
  - Oversized tees that own the **frame**
  - Every **panel** of the shop: tees to katanas
  - Bring your own design to the Custom **Forge**
  - Catch us **live** at your college fest
  - Beyond anime: K-pop, F1, films and **more**
  - Questions fans ask us **first**
- **Schema:** Organization · WebSite + SearchAction · ItemList (featured arcs + categories) · FAQPage (3 Qs, linking to /faq)
- **Links out:** the 5 arcs + `/arc/beyond-anime` · `/shop/oversized-t-shirts` · `/shop/hoodies` · `/shop/polaroids` · `/shop/cosplay-props` · `/custom` · `/fests` · `/faq`

### 2.2 Catalogue `/shop`
- **Primary:** buy anime merch online
- **Secondary:** anime t-shirts and hoodies online · anime accessories India · anime gifts under 500
- **Intent:** transactional
- **Title:** `Shop Anime Merch Online — All Fandoms | The Escape Door`
- **Meta:** `Browse 2000 t-shirt designs, 1500 polaroids, 750 posters and 400+ badges. Filter by arc, size, GSM and price. Fan-inspired, original designs.`
- **H1:** The full catalogue: every arc, every panel
- **H2s:** Filter by **arc** · Shop by **category** · Packs that **save** (3 polaroids ₹100, 6 posters ₹1000) · Want it **custom**?
- **Schema:** CollectionPage + ItemList (first 24 products, `url` + `position`) · BreadcrumbList
- **Links out:** all 10 categories · all 6 arcs · `/custom`

### 2.3 Category pages `/shop/[category]`
Shared H2 skeleton: *"{Category} by **arc**"* · *"Size, fit and **print**"* (apparel) or *"Packs and **prices**"* (collectibles) · a category-specific H2 · *"Make it **yours**"* (→ /custom).
Shared schema: **CollectionPage + ItemList + BreadcrumbList** (Home › Shop › Category).

| Slug | Primary | Secondaries | Intent | Title (≤60) | Meta (≤155) | H1 | Unique H2 (accent) | Links out |
|---|---|---|---|---|---|---|---|---|
| `t-shirts` | anime t-shirts India | anime printed t-shirt · anime baby tee · anime t-shirt under 700 | transactional | `Anime T-Shirts India — Regular & Baby Tees \| Escape Door` | `Anime t-shirts in regular fit for ₹600 and baby tees for ₹400. Fan-inspired designs across Jujutsu Kaisen, One Piece, Naruto and more.` | Anime t-shirts, regular and baby fit | Regular ₹600, baby tee ₹400: pick your **fit** | oversized-t-shirts, hoodies, 5 arcs, /custom |
| `oversized-t-shirts` | anime oversized t-shirt | anime oversized t-shirt under 1000 · oversized anime tee India · black oversized anime t-shirt | transactional | `Anime Oversized T-Shirts ₹800 — Under ₹1000 \| Escape Door` | `Anime oversized t-shirts at ₹800, under ₹1000. Black drop-shoulder tees with fan-inspired back prints up to 12×15 in. Add your own design.` | Anime oversized t-shirts, ₹800 flat | Back prints up to 12×15 **inches** | t-shirts, hoodies, /custom, 5 arcs |
| `hoodies` | anime hoodies India | heavyweight anime hoodie · 430 GSM hoodie · anime hoodie under 1500 | transactional | `Anime Hoodies India — 280 to 600 GSM \| The Escape Door` | `Anime hoodies priced by weight: 280–330 GSM ₹1200, 330–380 ₹1500, 380–430 ₹1800, 430–600 GSM ₹2500. Fan-inspired prints.` | Anime hoodies, priced by GSM | Choose your **weight**: four GSM tiers | oversized-t-shirts, /custom, 5 arcs |
| `polaroids` | anime polaroid prints | anime polaroid set · anime photo cards · k-pop polaroids | transactional | `Anime Polaroid Prints — ₹50 Each, 3 for ₹100 \| Escape Door` | `Polaroid-style anime prints at ₹50 each or 3 for ₹100. 1500 designs across anime, K-pop, K-drama, F1 and films. Custom sets from 20 pieces.` | Anime polaroid prints, 1500 designs | Build a **set**: 3 for ₹100 | bookmarks, posters, /arc/beyond-anime, /custom |
| `bookmarks` | anime bookmarks | magnetic anime bookmarks · anime bookmark set · book quote bookmarks | transactional | `Anime Bookmarks — Plain & Magnetic \| The Escape Door` | `Plain anime bookmarks ₹30 (4 for ₹100) and magnetic bookmarks ₹100 (2 for ₹150). 1800 plain and 450 magnetic designs. Custom from 14 pieces.` | Anime bookmarks, plain and magnetic | Magnetic bookmarks that **snap** shut | polaroids, posters, /arc/beyond-anime (book quotes), /custom |
| `posters` | anime posters India | anime poster set · anime wall posters · buy 5 get 1 free posters | transactional | `Anime Posters India — 6 for ₹1000 \| The Escape Door` | `Anime posters at ₹200 each, or 6 for ₹1000: buy 5, get 1 free. 750 designs across anime and every other fandom.` | Anime posters: buy 5, get 1 free | Six posters, one **wall** | polaroids, badges, 5 arcs |
| `badges` | anime badges India | anime pin badges · anime badge set · custom badges bulk | transactional | `Anime Badges — ₹50 Each, 5 for ₹200 \| The Escape Door` | `Anime pin badges at ₹50 each or 5 for ₹200. 400+ designs for bags, jackets and lanyards. Bulk custom badges for fests and clubs.` | Anime badges, 400+ designs | Five badges, one **bag** | stickers, /custom, /fests |
| `stickers` | anime stickers India | anime sticker pack · laptop anime stickers · custom stickers | transactional | `Anime Stickers — ₹30 Each \| The Escape Door` | `Anime stickers at ₹30 each for laptops, bottles and phones. Fan-inspired designs plus custom sticker runs from 15 pieces.` | Anime stickers for every surface | Stick it **everywhere** | badges, bookmarks, /custom |
| `cosplay-props` | cosplay katana India | LED katana cosplay · anime cosplay cape · cosplay sword price India | transactional | `Cosplay Katanas & Capes India — LED & Basic \| Escape Door` | `Cosplay katanas: basic ₹1200–2000, LED ₹3000–4000. Capes ₹700–1000. Display and cosplay props, not real blades.` | Cosplay katanas and capes | Basic vs **LED**: which katana? | /cosplay, accessories, /fests |
| `accessories` | anime accessories India | anime earrings · anime keychain · anime figurines India | transactional | `Anime Accessories — Keychains, Earrings \| The Escape Door` | `Anime keychains ₹150, earrings and accessories ₹250–800, figurines from ₹250. Fan-inspired designs for gifting and everyday carry.` | Anime accessories, keychains and figurines | Small pieces, big **fandom** | cosplay-props, badges, /cosplay |

> Product-safety copy on `cosplay-props`: describe props as display/cosplay items. [CONFIRM: katana material and length; any event or venue prop rules the owner already follows.]

### 2.4 Arc (collection) pages `/arc/[collection]`
Wording rule: "fan-inspired original designs" on every arc. **Never** "official", "licensed" or "authentic {series} merch". Don't use official logos, key art or screenshots. Every visual is an original illustration.

| Slug | Primary | Secondaries | Title (≤60) | Meta (≤155) | H1 |
|---|---|---|---|---|---|
| `jujutsu-kaisen` | jujutsu kaisen merch India | jujutsu kaisen t-shirt · jjk oversized tee · jjk hoodie | `Jujutsu Kaisen Merch India — Fan-Inspired \| Escape Door` | `Fan-inspired Jujutsu Kaisen merch: oversized tees ₹800, hoodies from ₹1200, polaroids, posters and badges. Original designs, not official merch.` | The Jujutsu Kaisen arc |
| `attack-on-titan` | attack on titan merch India | attack on titan t-shirt · aot hoodie · aot poster | `Attack on Titan Merch India — Fan-Inspired \| Escape Door` | `Fan-inspired Attack on Titan merch: oversized tees ₹800, hoodies, posters ₹200, polaroids ₹50 and badges. Original designs, not official merch.` | The Attack on Titan arc |
| `demon-slayer` | demon slayer merch India | demon slayer t-shirt · demon slayer katana cosplay · demon slayer hoodie | `Demon Slayer Merch India — Fan-Inspired \| Escape Door` | `Fan-inspired Demon Slayer merch: tees, hoodies, posters, badges and cosplay katanas from ₹1200. Original designs, not official merch.` | The Demon Slayer arc |
| `one-piece` | one piece merch India | one piece t-shirt · one piece wanted poster · one piece hoodie | `One Piece Merch India — Fan-Inspired \| The Escape Door` | `Fan-inspired One Piece merch: oversized tees ₹800, posters 6 for ₹1000, polaroids, bookmarks and badges. Original designs, not official merch.` | The One Piece arc |
| `naruto` | naruto merch India | naruto t-shirt · naruto hoodie · naruto bookmark | `Naruto Merch India — Fan-Inspired \| The Escape Door` | `Fan-inspired Naruto merch: oversized tees ₹800, hoodies, magnetic bookmarks ₹100, posters and badges. Original designs, not official merch.` | The Naruto arc |
| `beyond-anime` | fandom merch India | k-pop merch India · f1 merch India · k-drama polaroids · book quote bookmarks | `Fandom Merch India — K-pop, F1, Films \| The Escape Door` | `Beyond anime: tees, polaroids, bookmarks and posters for K-pop, K-drama, F1, films, series, books, games, sports, art and coffee fans.` | Beyond Anime: open the other door |

- **Intent:** transactional with collection browsing.
- **Arc H2 skeleton:** *"Wear the **arc**: tees and hoodies"* · *"Collect the **panels**: polaroids, posters, badges"* · *"Gear for your **cosplay**"* (only on arcs that have props) · *"Fan-made, **original** designs"* (the disclaimer block, ~40 words) · *"Next **arc**"* (links to the other arcs).
- **Beyond-anime H2s:** *"Pick another **fandom**"* (chips: K-pop, K-drama, F1, films, series, books, games, sports, art, coffee, spiritual) · *"Tees for every **fandom**"* · *"Polaroids and **bookmarks**"* · *"Don't see yours? Make it **custom**"*.
- **Schema:** CollectionPage + ItemList + BreadcrumbList (Home › Arcs › {Arc}).
- **Links out:** each arc → its top 4 categories (anchor e.g. "Jujutsu Kaisen oversized tees" → `/arc/jujutsu-kaisen#apparel`, plus a category link `/shop/oversized-t-shirts`) · the 2 neighbouring arcs · `/custom` · `/cosplay` (Demon Slayer, Naruto, One Piece).

### 2.5 Product `/product/[slug]`
- **Primary:** `{design name} {product type}` (e.g. "cursed flame oversized t-shirt")
- **Secondary:** `{arc} {product type}` · `{product type} under ₹{price-ceiling}` · `{fit/GSM}`
- **Intent:** transactional
- **Title pattern:** `{Design} {Type} — ₹{price} | The Escape Door`. If it runs past 60, drop the brand first, then the price.
- **Meta pattern:** `{Design} {type}, fan-inspired by {Arc}. ₹{price}. {fit/GSM or pack size}. {one unique detail}. Original design by The Escape Door.` Trim to 155 characters.
- **H1:** `{Design name} {Product type}`
- **H2s:** Size and **fit** (apparel) / What's in the **pack** (collectibles) · Print and **fabric** · Pairs well **with** · Delivery and **returns** [CONFIRM content] · Fan-made, **original** design
- **Schema:** Product (single SKU) or **ProductGroup** with `variesBy: size` and `hasVariant` for apparel · Offer (`priceCurrency: INR`, `price`, `availability`, `url`, `itemCondition: NewCondition`) · BreadcrumbList (Home › Shop › Category › Product). Add `MerchantReturnPolicy` and `OfferShippingDetails` **only after** the policies are confirmed. **No AggregateRating or Review until real reviews exist.**
- **Links out:** parent category · parent arc · 4 "pairs well with" products (cross-category, same arc) · `/custom` ("Put this on a hoodie instead")
- **Pack SKUs** (rank for "set" queries): `anime-polaroid-set-of-3` (₹100), `plain-bookmark-pack-of-4` (₹100), `magnetic-bookmark-pack-of-2` (₹150), `poster-pack-of-6` (₹1000), `badge-pack-of-5` (₹200).

### 2.6 Custom Forge `/custom`
- **Primary:** custom anime t-shirt printing India
- **Secondary:** print your own design on t-shirt · custom polaroid prints bulk · custom badges for college fest · custom magnetic bookmarks
- **Intent:** commercial / service (transactional)
- **Title:** `Custom Anime T-Shirt Printing India — Forge \| Escape Door`
- **Meta:** `Print your own design: front 4×4 in, back 12×15 in. Send your art, or we design it for ₹200 extra. Custom polaroids from 20 pcs, badges in bulk.`
- **H1:** The Custom Forge: your design, our press
- **H2s:**
  - How the **Forge** works in three steps
  - Print **zones**: front 4×4 in, back 12×15 in
  - Your art, or we **draw** it for ₹200
  - Bulk minimums in **plain** numbers
  - Custom for clubs, teams and **fests**
  - Questions before you **forge**
- **Schema:** Service (`serviceType: Custom merchandise printing`, `provider: Organization`, `areaServed: IN`, `offers` → Offer with `priceSpecification` only for the fixed numbers) · BreadcrumbList · FAQPage (3 Qs)
- **Links out:** `/shop/oversized-t-shirts` · `/shop/hoodies` · `/shop/polaroids` · `/shop/badges` · `/fests` · `/faq#custom`
- **Signature interaction:** #67-style morph from the upload slot to a tee preview. One per flow.

### 2.7 Fests `/fests`
- **Primary:** college fest merchandise partner
- **Secondary:** anime stall at college fest · custom fest merch India · fest collab merchandise · anime pop-up stall
- **Intent:** commercial (fest organisers) + navigational (students looking for the stall)
- **Title:** `College Fest Merch Partner & Anime Stalls \| Escape Door`
- **Meta:** `Bring The Escape Door to your fest: anime merch stalls and custom fest merch. Seen at Thomso IIT Roorkee, Fluxus IIT Indore and Alcheringa IIT Guwahati.`
- **H1:** The Fandom Partner arc
- **H2s:**
  - Become our Fandom **Partner**
  - What a stall brings to your **campus**
  - Custom merch for your **fest**
  - Catch us **live**: upcoming stalls
  - Fests we've already **opened** doors at
  - How to **book** us
- **Schema:** CollectionPage · ItemList of **Event** (only for confirmed dates **with year**, see §5) · Service (fest partnership) · BreadcrumbList
- **Links out:** `/custom` · `/shop/badges` · `/shop/polaroids` · `/cosplay` · Instagram (for live updates) · `/about`
- Copy note: fest names are factual text mentions. Never use fest or institute logos. [CONFIRM: written permission to show stall photos that contain fest branding.]

### 2.8 Cosplay `/cosplay`
- **Primary:** anime cosplay props India
- **Secondary:** cosplay ideas for college fest · LED katana cosplay · anime cape cosplay · how to cosplay on a budget India
- **Intent:** commercial investigation / informational
- **Title:** `Anime Cosplay Props India — Katanas, Capes \| Escape Door`
- **Meta:** `Plan your anime cosplay: basic katanas ₹1200–2000, LED katanas ₹3000–4000, capes ₹700–1000, keychains and earrings. Build your fest look.`
- **H1:** Cosplay, panel by panel
- **H2s:**
  - Build a look in four **pieces**
  - Basic or **LED** katana?
  - Capes that **move** with you
  - Finishing touches: earrings and **keychains**
  - Cosplay for your college **fest**
  - Questions cosplayers **ask**
- **Schema:** CollectionPage + ItemList (props) · BreadcrumbList · FAQPage
- **Links out:** `/shop/cosplay-props` · `/shop/accessories` · `/fests` · `/arc/demon-slayer` · `/arc/naruto` · `/arc/one-piece`

### 2.9 About `/about`
- **Primary:** The Escape Door (brand)
- **Secondary:** escapedoor.in · anime merch brand India · fandom collectibles brand
- **Intent:** navigational / trust
- **Title:** `About The Escape Door — Fandom Merch, Anime First`
- **Meta:** `The Escape Door makes fan-inspired, original merch for anime and every other fandom: tees, hoodies, polaroids, props. Find us at college fests.`
- **H1:** Behind the Escape Door
- **H2s:** Why anime comes **first** · Over 2000 **designs** and counting · From Instagram to your **campus** · Fan-made, **original** work · Who's behind the **door** [CONFIRM: founder names, city, year started]
- **Schema:** AboutPage · Organization (full) · BreadcrumbList
- **Links out:** `/shop` · `/fests` · `/custom` · `/faq` · `/contact` · Instagram

### 2.10 FAQ `/faq`
- **Primary:** The Escape Door FAQ
- **Secondary:** anime t-shirt price India · custom polaroid minimum order · cosplay katana price
- **Intent:** informational (GEO / AI answers)
- **Title:** `FAQ — Prices, Custom Orders & Fests \| The Escape Door`
- **Meta:** `Straight answers: oversized tees ₹800, hoodies ₹1200–2500 by GSM, custom polaroids from 20 pieces, print sizes, fest stalls and more.`
- **H1:** Questions fans ask us
- **H2s:** the question H2s in §4. Group them under anchors `#prices`, `#custom`, `#fests` and `#about`.
- **Schema:** FAQPage · BreadcrumbList
- **Links out:** each answer links to the page that owns the answer (category, `/custom`, `/fests`).

### 2.11 Policies and contact (recommended additions)
Titles: `Shipping Policy | The Escape Door`, `Returns & Exchanges | The Escape Door`, `Privacy Policy | The Escape Door`, `Terms of Sale | The Escape Door`, `Contact The Escape Door`. Use one plain H1 each, with H2s that still carry an accent word (e.g. "How we **ship**"). The body is [CONFIRM: all policy facts]. Schema: WebPage + BreadcrumbList. `/contact` adds a ContactPage. Don't publish an address or phone until they are confirmed.

---

## 3. Keyword map

`[CONFIRM]`: the brief referenced an "11 seed keywords CTX list" that was not supplied to this step. The 11 seeds below come from the product list, the notebook and the SERP check. Swap them in if the owner's list differs. No volume data, because no paid APIs were used. Run them through the free GSC Performance report after launch.

| # | Seed keyword | Target page | Intent | Long-tails (same page) |
|---|---|---|---|---|
| 1 | anime merch India | `/` | commercial | anime merchandise online India · anime gifts for college students · fandom collectibles India |
| 2 | anime oversized t-shirt | `/shop/oversized-t-shirts` | transactional | **anime oversized t-shirt under 1000** · black oversized anime tee · oversized anime t-shirt back print |
| 3 | anime t-shirts India | `/shop/t-shirts` | transactional | anime baby tee · anime t-shirt under 700 · anime printed t-shirt for girls |
| 4 | anime hoodies India | `/shop/hoodies` | transactional | heavyweight anime hoodie · 430 GSM hoodie India · anime hoodie under 1500 |
| 5 | anime polaroid prints | `/shop/polaroids` (+ product `anime-polaroid-set-of-3`) | transactional | **anime polaroid set** · anime photo cards · k-pop polaroids India |
| 6 | anime bookmarks | `/shop/bookmarks` | transactional | magnetic anime bookmarks · anime bookmark set of 4 · book quote bookmarks |
| 7 | anime posters India | `/shop/posters` | transactional | anime poster set of 6 · anime wall posters for room · buy 5 get 1 free posters |
| 8 | anime badges India | `/shop/badges` | transactional | anime pin badges set · anime badges for bags · custom badges bulk India |
| 9 | anime stickers India | `/shop/stickers` | transactional | anime laptop stickers · custom anime stickers |
| 10 | cosplay katana India | `/shop/cosplay-props` | transactional | LED katana cosplay price · anime cape cosplay · cosplay sword under 2000 |
| 11 | custom anime t-shirt printing India | `/custom` | commercial | print my own design on t-shirt · custom hoodie printing India · custom polaroids minimum 20 · custom magnetic bookmarks |

Supporting keywords (non-seed):

| Keyword cluster | Page |
|---|---|
| {series} merch India / {series} t-shirt / {series} hoodie (×5) | `/arc/{series}` |
| k-pop merch India · f1 merch India · k-drama polaroids · fandom merch India | `/arc/beyond-anime` |
| college fest merchandise partner · anime stall at college fest · custom fest merch | `/fests` |
| anime cosplay props India · cosplay ideas for college fest | `/cosplay` |
| anime accessories · anime keychain · anime earrings · anime figurines India | `/shop/accessories` |
| The Escape Door · escapedoor.in · escape door anime | `/about` + `/` |

Future content gaps (post-launch, Phase 2): "how to choose hoodie GSM" (→ hoodies), "anime polaroid wall ideas" (→ polaroids), "cosplay checklist for college fest" (→ /cosplay). Build these as sections on the owning page first, and only make them blog posts if GSC shows demand.

---

## 4. GEO answer blocks (FAQ)

Each block is an H2 question followed by a 40–60-word answer that stands on its own. The accent word is marked. Every answer uses notebook or brief facts only. Use these on `/faq`, and reuse the relevant 2–3 on category pages, `/custom` and `/fests` with different wording.

**1. How much does an anime oversized t-shirt **cost**?** `#prices`
> At The Escape Door, an anime oversized t-shirt costs ₹800, which keeps it under ₹1000. Regular-fit anime t-shirts cost ₹600 and baby tees cost ₹400. Every design is fan-inspired and original, chosen from a library of around 2000 t-shirt designs spanning anime, shows, movies, games, sports and more.

**2. How are hoodies priced by **GSM**?** `#prices`
> Hoodies at The Escape Door are priced by fabric weight. A 280–330 GSM hoodie costs ₹1200, 330–380 GSM costs ₹1500, 380–430 GSM costs ₹1800, and the heaviest 430–600 GSM hoodie costs ₹2500. Higher GSM means a thicker, warmer hoodie. Any hoodie design can also be printed with your own artwork.

**3. Can I print my own **design** on a t-shirt or hoodie?** `#custom`
> Yes. In the Custom Forge you can send your own artwork, or have The Escape Door create the design for ₹200 extra. The front print area is 4×4 inches and the back print area is 12×15 inches. The final price depends on the garment you choose. [CONFIRM: what "half-n-half, extra ₹200" means.]

**4. What is the minimum order for custom **polaroids**?** `#custom`
> Custom polaroid-style prints start at a minimum of 20 pieces. The designs can be all the same or all different. At ₹50 each, 20 custom pieces cost ₹1000. Ready-made polaroids from the 1500-design library cost ₹50 each or ₹100 for a set of three, covering anime, K-pop, K-drama, F1 and films.

**5. How much do plain and magnetic **bookmarks** cost?** `#prices`
> Plain bookmarks cost ₹30 each or ₹100 for four, chosen from about 1800 designs. Magnetic bookmarks cost ₹100 each or ₹150 for two, from about 450 designs. Custom bookmarks need at least 14 pieces, and 14 custom pieces cost ₹1400. [CONFIRM: whether the 14-piece custom price applies to magnetic bookmarks only.]

**6. Is there a poster **deal**?** `#prices`
> Yes. Posters cost ₹200 each, or ₹1000 for six, which works out as buy five, get one free. The Escape Door's poster library has around 750 designs across anime and other fandoms, so a full wall set can mix series. [CONFIRM: poster size and paper weight before publishing a spec line.]

**7. How much are anime badges and **stickers**?** `#prices`
> Anime badges cost ₹50 each or ₹200 for five, from a library of 400-plus designs. Stickers cost ₹30 each. For bulk custom badges, a past order of 350 badges in different designs was priced at ₹12 per badge. Custom stickers need a minimum of 15 pieces. [CONFIRM: per-piece custom sticker price.]

**8. How much does a cosplay **katana** cost?** `#cosplay`
> A basic cosplay katana costs ₹1200–2000, and an LED katana costs ₹3000–4000. Capes cost ₹700–1000, keychains ₹150, and earrings and other accessories ₹250–800. Figurines range from ₹250 to ₹1200, with select pieces at ₹2500. Katanas are sold as cosplay and display props, not real blades.

**9. Is this official licensed anime **merch**?** `#about`
> No. The Escape Door sells original, fan-inspired designs made by fans for fans. It is not affiliated with, endorsed by or licensed by the creators, publishers or studios of any series named on the site. Series names are used only to describe what each design is inspired by.

**10. Where can I find The Escape Door **live**?** `#fests`
> The Escape Door runs pop-up stalls at college fests, including Thomso at IIT Roorkee, Fluxus at IIT Indore and Alcheringa at IIT Guwahati. Past stall dates include VIT Bhopal (21–28 February), IIT Indore (14–16 March) and IIT Ropar (13–15 March). Follow @escapedoor.in on Instagram for upcoming stalls. [CONFIRM: years for these dates.]

**11. How can our college fest **partner** with you?** `#fests`
> Fest teams can make The Escape Door their Fandom Partner: a stall for your fest and custom merch for your committee or attendees. Custom minimums are low, with polaroids from 20 pieces, bookmarks from 14 and stickers from 15, plus bulk badges. [CONFIRM: booking contact and what a partnership includes.]

**12. Do you only make anime **merch**?** `#about`
> Anime comes first, but not only anime. Beyond Anime covers shows, series, movies, K-pop, K-drama, F1, sports, games, paintings, spiritual themes, coffee and book quotes. The libraries run to about 2000 t-shirt designs, 1500 polaroids, 1800 plain bookmarks, 450 magnetic bookmarks, 750 posters and 400-plus badges.

**Held back until confirmed (do not render):** "How long does **delivery** take?" [CONFIRM: dispatch and transit times, shipping charges, serviceable PIN codes]. "Can I **return** or exchange?" [CONFIRM: return window and conditions]. "Do you offer cash on **delivery**?" [CONFIRM].

Notes: FAQ rich results stopped showing on Google from 7 May 2026 (playbook Part 08). FAQPage markup stays because it gives clean Q/A for AI answer engines, not for a SERP feature. The playbook suggests 134–167-word passages for GEO. These 40–60-word answers are the citable core. On `/faq`, follow each answer with one supporting sentence and a link to the owning page.

---

## 5. Schema plan (JSON-LD, server-rendered in the initial HTML)

All JSON-LD goes in the initial server-rendered HTML through a `<JsonLd>` server component, never injected client-side. The `@id` values are stable so pages reference each other.

**Organization**: on every page in the layout (minimal), and in full on `/` and `/about`.
```json
{"@context":"https://schema.org","@type":"Organization","@id":"https://{DOMAIN}/#org",
 "name":"The Escape Door","alternateName":"Escape Door","url":"https://{DOMAIN}/",
 "logo":"https://{DOMAIN}/brand/logo-512.png",
 "description":"Fan-inspired, original anime-first merchandise and fandom collectibles from India.",
 "sameAs":["https://www.instagram.com/escapedoor.in"],
 "areaServed":"IN"}
```
`email`, `telephone`, `address` and `foundingDate` are [CONFIRM]. Leave them out until supplied.

**WebSite + SearchAction**: on `/` only.
```json
{"@context":"https://schema.org","@type":"WebSite","@id":"https://{DOMAIN}/#website",
 "name":"The Escape Door","url":"https://{DOMAIN}/","inLanguage":"en-IN","publisher":{"@id":"https://{DOMAIN}/#org"},
 "potentialAction":{"@type":"SearchAction","target":{"@type":"EntryPoint","urlTemplate":"https://{DOMAIN}/shop?q={search_term_string}"},
 "query-input":"required name=search_term_string"}}
```

**Product / ProductGroup + Offer**: on `/product/[slug]`.
```json
{"@context":"https://schema.org","@type":"ProductGroup","@id":"https://{DOMAIN}/product/{slug}#group",
 "name":"{Design} Oversized T-Shirt","productGroupID":"{sku-base}","variesBy":"https://schema.org/size",
 "brand":{"@type":"Brand","name":"The Escape Door"},
 "description":"{unique copy} Fan-inspired original design; not official merchandise.",
 "image":["https://{DOMAIN}/img/{slug}-front.avif"],
 "hasVariant":[{"@type":"Product","sku":"{sku}-M","size":"M","name":"{Design} Oversized T-Shirt (M)",
   "offers":{"@type":"Offer","url":"https://{DOMAIN}/product/{slug}?size=M","priceCurrency":"INR","price":"800",
   "availability":"https://schema.org/InStock","itemCondition":"https://schema.org/NewCondition",
   "seller":{"@id":"https://{DOMAIN}/#org"}}}]}
```
- `availability` comes from Supabase stock: `InStock`, `OutOfStock`, or `MadeToOrder` for print-on-order items. `LimitedAvailability` is for fest-drop stock.
- Price-range items (katanas, figurines, capes) are one Product per actual SKU with its exact price. Never put a range in `price`.
- Packs are their own Product with the pack price (e.g. `price: "100"` for 3 polaroids).
- `MerchantReturnPolicy` and `OfferShippingDetails` go under the Organization (`hasMerchantReturnPolicy`) and in the Offer only after the policies are confirmed.
- No `aggregateRating` or `review` until real, verifiable reviews exist. No fake reviews.

**BreadcrumbList**: on every indexable page except `/`. Trails: Home › Shop › {Category} › {Product}. Home › Arcs › {Arc}. Home › Custom Forge. Home › Fests.

**CollectionPage + ItemList**: on `/shop`, `/shop/[category]`, `/arc/[collection]` and `/cosplay`.
```json
{"@context":"https://schema.org","@type":"CollectionPage","name":"Anime Oversized T-Shirts","url":"https://{DOMAIN}/shop/oversized-t-shirts",
 "isPartOf":{"@id":"https://{DOMAIN}/#website"},
 "mainEntity":{"@type":"ItemList","itemListElement":[{"@type":"ListItem","position":1,"url":"https://{DOMAIN}/product/{slug}"}]}}
```
Use a summary list (URLs only, up to 24) to avoid duplicating Product markup.

**FAQPage**: on `/faq` (all rendered Qs), and on `/`, `/custom` and `/cosplay` (only the Qs visible on that page). The text matches the visible answer exactly. Never include held-back `[CONFIRM]` questions.

**Service**: on `/custom` (custom merchandise printing) and `/fests` (fest merchandise partnership). `provider` = `#org`, `areaServed` = IN.

**Event**: on `/fests`, **only** when the owner confirms the date **with year**, the venue and that the stall is going ahead. The notebook has no year, so every past entry stays as plain text.
```json
{"@context":"https://schema.org","@type":"Event","name":"The Escape Door anime merch stall at {Fest} {YEAR}",
 "startDate":"{YYYY-MM-DD}","endDate":"{YYYY-MM-DD}","eventStatus":"https://schema.org/EventScheduled",
 "eventAttendanceMode":"https://schema.org/OfflineEventAttendanceMode",
 "location":{"@type":"Place","name":"{Institute}","address":{"@type":"PostalAddress","addressLocality":"{City}","addressCountry":"IN"}},
 "organizer":{"@id":"https://{DOMAIN}/#org"},"description":"Pop-up stall with fan-inspired anime merch at {Fest}."}
```
Set `eventStatus: EventCancelled` or `EventPostponed` when that happens. Remove an Event when it ends, or move it to a "past stalls" ItemList without Event markup.

**AboutPage / ContactPage / WebPage**: on `/about`, `/contact` and the policies.

---

## 6. Internal links, alt text and OG images

### 6.1 Internal-link plan
- **Global header (manga "chapter tabs"):** Shop · Arcs (mega-panel: 5 arcs + Beyond Anime) · Custom Forge · Fests · Cosplay. The search icon opens `/shop?q=`.
- **Footer:** all 10 categories · 6 arcs · About · FAQ · Contact · Policies · Instagram. Then the **disclaimer line**:
  > *The Escape Door sells original, fan-inspired designs. We are not affiliated with, endorsed by or licensed by the creators, publishers or studios of any series named on this site. All trademarks belong to their respective owners.*
- **Breadcrumbs** on every page except home, rendered as a thin screentone strip.
- **Hub and spoke:**
  - Home → arcs and categories.
  - Arc ↔ category through cross-filter sections, e.g. "Naruto posters" on `/arc/naruto` links to `/shop/posters`.
  - Category → the top 6 products. Product → its category, its arc and 4 cross-category products from the same arc.
  - Every apparel page → `/custom`. `/custom` ↔ `/fests`. `/cosplay` ↔ `/shop/cosplay-props`.
  - FAQ answers → the owning page.
- **"Next chapter" panel** at the bottom of every arc and category page links the next arc or category in the reading order, so the volume reads like a manga with a page-turn micro-interaction.
- **Anchor text:** descriptive ("anime oversized t-shirts", "custom polaroid prints"). Never "click here" or "shop now" alone. Vary anchors across pages.
- **Orphan check:** every product appears in at least one category ItemList and one arc. Run an automated check in P6 (crawl from `/` with Playwright and list unreachable sitemap URLs).

### 6.2 Image alt-text pattern
- **Product:** `{Design name} {product type} in {colour}, {view}: fan-inspired {Arc} design by The Escape Door`. Keep it under 125 characters. Example: "Cursed Flame oversized t-shirt in black, back view: fan-inspired Jujutsu Kaisen design by The Escape Door".
- **Packs:** `Set of {n} {arc/fandom} polaroid-style prints laid out on a lavender panel`.
- **Lifestyle / fest:** `Students browsing The Escape Door anime merch stall at {Fest}, {Institute}`. Only use this with confirmed photos and permission. No identifiable faces without consent.
- **Arc hero art (original illustrations):** describe the scene, not the character's trademark name, e.g. "Original manga-panel illustration of a sword-wielding hero against a yellow sunburst".
- **Decorative** screentone, ticker bands, outline wordmarks and Japanese subtitle graphics: `alt=""` (with `aria-hidden` where it's an SVG).
- **File names** mirror the slug: `{slug}-{view}.avif`. Never `IMG_1234`.

### 6.3 OG / Twitter image plan (1200×630, `opengraph-image.tsx` with next/og)
| Template | OG composition (brand language) | Text on image |
|---|---|---|
| `/` | Black base, grey screentone frame, yellow + lavender diagonal split panels, outline wordmark "THE ESCAPE DOOR", ticker band at the bottom | "Anime merch, drawn like a manga volume" |
| `/shop` | 3×2 collage panel grid with thick borders, product cut-outs | "Every arc. Every panel." |
| `/shop/[category]` | Hero product on a pastel colour block, category name in tall condensed caps repeated behind it, price chip | "{Category} · from ₹{min}" |
| `/arc/[collection]` | Arc colour block (one palette accent per arc), arc name stacked vertically, Japanese subtitle line, original illustration only | "{Arc} · fan-inspired designs" |
| `/arc/beyond-anime` | A door half-open, with fandom chips spilling out | "Beyond Anime" |
| `/product/[slug]` | Black oversized tee on a pastel block, design title repeated behind it (the IG signature), price sticker | "{Design} · ₹{price}" |
| `/custom` | Anvil/forge panel, print-zone outlines (4×4 front, 12×15 back) drawn as manga guides | "Custom Forge · your design" |
| `/fests` | Ticker band of fest names (text only, no logos), stall collage | "Fandom Partner · Catch us live" |
| `/cosplay` | Katana silhouette diagonal split, red accent | "Cosplay, panel by panel" |
| `/about`, `/faq`, policies | The home frame with the page title | page H1 |

Rules: the fonts and 5 colours come from DESIGN.md, and text is real (rendered by next/og, not baked into a JPEG). No official anime artwork, logos or screenshots. Keep each image ≤ 300 KB. Set `twitter:card = summary_large_image`. Noindex pages inherit the home OG image.

---

## 7. Implementation checklist (P5/P7 hand-off)
- [ ] `app/sitemap.ts`: indexable clean URLs only, with `lastModified` from Supabase.
- [ ] `app/robots.ts`: allow `/`, disallow `/admin/` and `/api/`, point to the sitemap.
- [ ] `generateMetadata` per template, applying the §1 canonical rules (strip params, self-canonical pagination, 301 `?category=` → clean).
- [ ] `not-found.tsx` returns 404 with links.
- [ ] Netlify `_redirects` for host and trailing-slash normalisation.
- [ ] JSON-LD server components per §5. Validate with the Rich Results Test and the Schema.org validator in P7.
- [ ] Footer disclaimer on every page, plus the "Fan-made, **original** designs" block on arc and product pages.
- [ ] Owner `[CONFIRM]` list: domain · policies (shipping/returns/COD) · the "half-n-half" meaning · whether the bookmark custom price is magnetic-only · custom sticker unit price · poster size · stall years · contact details · founder story · photo permissions · the 11-seed list from CTX.
- [ ] Post-launch: Search Console (verify, submit sitemap, inspect home) is done by the human for this client site. Also Bing Webmaster + IndexNow and Merchant Center free listings once policies are live.

---

## Critic addenda (2026-10-19, completeness pass)

**Prices.** Every ₹ figure in §2 and §4 was re-checked against `docs/source/NOTEBOOK_TRANSCRIPTION.md` and matches, with one exception:
- **FAQ #7, "a past order of 350 badges … ₹12 per badge":** OPEN_QUESTIONS lists this line as ambiguous (it could also read "₹350 for 12 pcs"). Render that sentence only after the owner confirms it. Until then, end the answer at "Custom stickers need a minimum of 15 pieces."

**Small fixes (apply these when you implement):**
1. **FAQ anchors.** FAQ #8 uses `#cosplay`, but §2.10 lists only `#prices #custom #fests #about`. Add `#cosplay` as a fifth group.
2. **Rule 1 vs rule 5 contradiction.** Rule 1 says not to combine noindex with a canonical. Rule 5 does exactly that for `?q=`. Fix: search results get `robots: { index: false, follow: true }` and **no** canonical.
3. **Fest names (§2.7 meta, FAQ #10).** The client's own Instagram grid also shows **Zeitgeist 2026 (IIT Ropar)** and **Blithchron 2026 (IIT Gandhinagar)** as "Fandom Partner" collabs (competitors.md §1). Add them to the "Fests we've already opened doors at" text list. The notebook's "IIT Ropar 13–15 March" stall is probably Zeitgeist; [CONFIRM].
4. **Asset paths must match CONTRACTS.**
   - Organization `logo` → `/brand/icon-512.png` (F3 ships `public/brand/icon-512.png`, not `logo-512.png`).
   - Product `image` → `/mockups/{slug}-front.webp` until real photos exist in the Supabase `product-images` bucket.
   - The §6.2 file-name rule then becomes `{slug}-{view}.webp|avif`.
5. **sitemap.ts must be data-driven.** DESIGN §2 allows admin-added arcs (Chainsaw Man, Solo Leveling, Haikyuu, Spy x Family). Generate `/arc/*` and `/product/*` from `getCollections()` / `getProducts()`, not from a hard-coded list of 6 arcs. Use the cookie-less Supabase client there, and avoid `new Date()`; see stack-notes §1.5.
6. **`lastModified = updated_at`.** The CONTRACTS `Product` type has only `createdAt`. Either F2 adds `updatedAt?: string` (the DB column can exist anyway), or `sitemap.ts` falls back to `createdAt`.
7. **301 rules: how to build them on this stack.** `/shop?category=x` → `/shop/x` and `/shop?arc=x` → `/arc/x` go in `next.config.ts` `redirects()` with `has: [{ type: 'query', key: 'category', value: '(?<cat>[a-z-]+)' }]` and `destination: '/shop/:cat'` (verified in the Next 16 docs, `redirects.md`).
   - Not via `proxy.ts`. Its matcher is limited to `/admin` and `/auth` (stack-notes §1.10).
   - Next answers `permanent: true` with a **308**, which search engines treat like a 301.
   - **Host and www:** set the primary domain in Netlify, which redirects the other host automatically.
   - **Trailing slash:** Next's default `trailingSlash: false` already redirects `/x/` → `/x`.
   - Whether a `public/_redirects` file is honoured next to the Next adapter is UNVERIFIED. Prefer the two mechanisms above.

**Home H2 coverage (§2.1 vs DESIGN §8 / CONTRACTS §7).** CONTRACTS gives each of the 13 visible home sections its own H2, but §2.1 has only 7 H2s.

Proposed mapping. **[proposal]** marks new H2 copy that uses only notebook facts.

| Section | H2 |
|---|---|
| S02 Choose Arc | Pick your **arc**: Jujutsu Kaisen, One Piece, Naruto and more |
| S03 Drop | Oversized tees that own the **frame** |
| S04 Back-Print | **[proposal]** Turn it around: back prints up to 12×15 **inches** |
| S05 Squad | Every **panel** of the shop: tees to katanas |
| S06 Wall | **[proposal]** Pin up the **wall**: polaroids 3 for ₹100 |
| S07 GSM | **[proposal]** Hoodie power **levels**: 280 to 600 GSM |
| S08 Cosplay | **[proposal]** Props for your next **cosplay** |
| S09 Forge | Bring your own design to the Custom **Forge** |
| S10 Partners | **[proposal]** Your fest's Fandom **Partner** |
| S11 Live | Catch us **live** at your college fest |
| S12 Beyond | Beyond anime: K-pop, F1, films and **more** |
| S13 Instagram | **[proposal]** Fresh panels on **Instagram** |

"Questions fans ask us **first**" and the home **FAQPage (3 Qs)** have **no section** in DESIGN or CONTRACTS. Either add a 3-question block (e.g. inside S11 or above the footer), or drop FAQPage from the home schema. §5 forbids FAQ markup that is not visible.
