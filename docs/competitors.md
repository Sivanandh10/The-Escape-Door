# Competitor & market scan — The Escape Door

Scan date: 2026-10-19. Everything below was read live on that date unless marked otherwise. Prices are INR as shown on the page and change often. No competitor text, images or logos were copied. Only short product or collection names are quoted, to show naming patterns.

## How this was gathered (and what failed)

| Step | Tool | Result |
|---|---|---|
| Instagram profile | Scrapling `make_request` (meta tags only) | Worked. The bio and counts were in the `<meta>` tags |
| Instagram profile | Scrapling `fetch`, then `stealthy_fetch` | Both returned only the login wall: "See photos, videos and more from escapedoor.in / Sign up / Log in" |
| Instagram profile at 390 px | Playwright MCP | The first screenshot worked (grid not loaded yet). The shared MCP browser then switched to another session's page (fynsec.vercel.app), so I stopped using it |
| Instagram grid at 390 px | The project's own `playwright` package, headless and logged out. The script is in the scratchpad, not the project | Worked. The "sign up" modal was removed in the page's DOM only. **No login, no account.** 6 of 12 grid tiles rendered |
| Market search | Firecrawl `firecrawl_search` (keyless) | **Refused**: "Anonymous keyless access is unavailable". The fix it offered needs an API key, so I did not sign up (free-only rule). I used Claude Code's built-in WebSearch instead (US index, weak for India) |
| Competitor pages | Scrapling `make_request`, escalating to `fetch` for The Souled Store's single-page app | Worked for 6 sites. Redwolf is behind a password page. Skypiea.in errored on both make_request and fetch |
| robots.txt | Checked for Souled Store and Bewakoof before reading | Allowed paths only. Bewakoof's sitemap index returned "Access denied", so I did not retry it |

Not measured: page speed and Lighthouse for competitors. Don't call them "slow" without a P6-style trace.

---

## 1. Instagram: @escapedoor.in (partly blocked)

**Status:** the login wall blocks captions, post pages and "more" in the bio. The public profile header, highlights and the first 6 grid thumbnails were visible logged-out.

**Visible facts**
- Display name: **The Escape Door**. Handle: escapedoor.in
- Counts: 919 followers / 110 following / 146 posts (meta tag, `make_request`). The Playwright render a minute later showed **921 followers / 107 following**. The post count was not shown in the render.
- Bio, 4 lines with emoji bullets: "Premium Fandom Collectibles", "Custom-Made | Collabs & Pop-Up Events", "Crafting Your Fandom Dreams", "DM to Personalize Your Purchase". The page truncates the rest.
- Story highlights (labels visible): **THOMSO, Surat, stationery, Bhopal, Kolkata, kolhapur**, plus 4 more off-screen. These are city and fest pop-ups, which is the brand's real story.
- Grid, newest first, with dates from image alt text:
  1. Thomso '26 (IIT Roorkee) "Fandom Partner" card. Collab post by thomso.iitr, Oct 2026
  2. Zeitgeist 2026 (IIT Ropar) "Meet our sponsors: Fandom Partner" card, Mar 2026
  3. Reel, Feb 2026: a printed book page, likely a bookmark or stationery reel
  4. Blithchron 2026 (IIT Gandhinagar) partner card, Feb 2026
  5. Photo, Jan 2026: a hand holding 4 printed cards (bookmarks or polaroids) with ink-wash manga art and red splash. A cutting mat and a **corner-rounder punch** are visible, so production is in-house and handmade
  6. Reel, Oct 2025: Thomso '25 announcement ("back for the 3rd time as your Fandom Partner"). Cosplay, katanas, merch and stationery offer. Oct 24–26
  7–12. Did not render logged-out. Older ones are Thomso photos and 4 posts dated 25 Feb 2025.
- Tagged and collab accounts seen: thomso.iitr, zeitgeist_iitrpr, blithchron_iitgn.

**Profile picture and logo:** a white circle with a stacked 3-line wordmark, **THE / ESCAPE / DOOR**. The letterforms are a chunky 1970s "groovy" display serif: very round, heavy and bouncy, with a slight baseline wobble. The fill is a warm rust-to-orange tone with a grainy, risograph-like texture.
- Approximate hex: rust `#B8432A`, burnt orange `#D9622B`, shadow red-brown `#8E2F1F`, on white `#FFFFFF`.

**Visual language in the visible tiles (approximate hex)**
- Collab cards follow each fest's art direction, not ours:
  - Thomso '26: sage/olive `#A9B08A` with a purple panel `#6E4E9E`
  - Zeitgeist: white with violet script `#7A3FC2`
  - Blithchron: electric yellow `#F2C230` on black `#0B0B0B`
- The brand's own Thomso '25 tile is the closest to the owner's description: a **violet/lavender block** (`#5B3FA0`, `#B9A3E3`), white and **yellow** (`#F7D84A`) headline type, a cosplay group photo, a diagonal ticker strip at the bottom and big condensed date numerals in yellow.
- Product tile: black-and-white ink manga art with **red** (`#C8102E`-ish) splatter accents, which matches the "occasional red".
- Not visible logged-out: grey screentone borders, rotated tall condensed caps, Japanese subtitles, tees on pastel blocks with repeated titles. These are probably further down the grid. **Owner: please send 5–10 original post files for these.**

**Key insight:** the logo (warm retro groovy serif, rust/orange) and the described feed language (black, screentone, yellow and lavender, condensed caps) are two different systems. Recommendation for DESIGN.md:
- Keep the logo untouched as the "cover stamp". The owner must supply it as a vector.
- Treat rust/orange as a fourth accent used only around the logo.
- Run the site in the manga system.
- Do not redraw or "improve" the logo.

Screenshots saved:
- `docs/references/instagram-profile-390.png`: header and bio, grid not loaded
- `docs/references/instagram-grid-390.png`: full page at 390 px, 2x, grid loaded
- `docs/references/instagram-highlights-390.png`
- `docs/references/instagram-post-01.png` … `instagram-post-06.png`: tiles 1–6 as listed above

---

## 2. Competitor table

| # | Name / URL | Positioning | Price points seen (INR, selling price) | Strengths | Weaknesses we can beat |
|---|---|---|---|---|---|
| 1 | **The Souled Store**: thesouledstore.com/anime-collection | Mass pop-culture apparel. **Officially licensed** (product names use "Franchise: Character", e.g. "Jujutsu Kaisen: Itadori"). Retail stores in Mumbai, Pune, Bangalore and Ahmedabad. "Homegrown Indian brand", "6 Million happy customers" | Oversized tees ₹999–1,499; super-oversized ₹549–1,699; oversized jerseys ₹1,199–1,499; jackets/pullovers ₹2,599–3,999; caps ₹999. Price filter bands go from ₹299 to ₹4,099. 167 anime items | Deep filters (Theme by series with counts, Category, Fit, Colour, Pattern, Sleeve, Price bands); COD; 30-day returns and exchanges; app push (10% extra cashback); "Members Only" pricing; licensed names | Rendered anime page keeps a **generic site-wide title** ("Online Shopping for Men & Women Clothing…"), an **empty meta description and empty canonical**. Schema is only Organization + WebSite SearchAction (no CollectionPage, ItemList or Product on the listing). Anime is one tab among Marvel, DC, etc. Generic e-com grid with no story. Only ~17 accessories and no polaroids, bookmarks or badges |
| 2 | **Bewakoof**: bewakoof.com/anime-collection | Value youth apparel. Co-branded tags "bewakoof x naruto", "bewakoof x demon slayer" (licensed) | Anime tees ₹321–945 (schema AggregateOffer low 321 / high 945, 35 items). Typical oversized ₹699–912; struck MRPs ₹1,249–2,199 (38–76% "off") | Strongest SEO in the set: CollectionPage + ItemList + AggregateOffer JSON-LD, keyword title "Anime T Shirts Online: Anime Tees for Men & Women", ~1,000 words of long-form category copy with question-style H2s and a fit-comparison list. Ratings (4.4–4.8) on cards. Bundle tags ("Buy 2 for 1199", "Buy 3 get 10% off"). Free shipping over ₹399; sizes XS–6XL; COD (in home meta) | Two `meta name=description` tags on the page (duplicate). Heavy reliance on inflated MRP and 70% "off". Apparel only (no polaroids, badges, props). Anime is a 35-item tab next to Marvel and Tom & Jerry. Product names are long SEO strings ("Men's Black … Graphic Printed Oversized T-shirt") with no personality |
| 3 | **Comicsense**: comicsense.store | Calls itself "The OG Anime Merchandise Store in India". **Anime-only fan-art house** with a disclaimer that designs are fan art by independent artists, not official | Tees ₹999–1,499 (MRP ₹1,299–1,799); Haikyu/Blue Lock cosplay jerseys ₹949; hoodies ₹1,999–3,299; sweatshirts ₹1,799; joggers ₹1,699; tapestries ₹899; stickers ₹49–59 each; woven keychains ₹299; figurines ₹1,199–4,599; 3D DIY frames ₹649–3,649; cosplay uniforms ₹1,999–2,599; Mikasa scarf ₹699 | Widest anime-only catalogue (tees, jerseys, cosplay, jewellery, tapestries, deskmats, manga, stickers, katana stands, blind boxes). **Codename product naming** that avoids trademarks ("Honored One", "Disgraced One", "Nichirin Warrior", "Karasuno-10"). Many real dated reviews on the home page. UGC "Viral Finds" strip. Free-gift thresholds (₹2,000 / ₹3,500). 7.5% prepaid cashback. "100 Days Return policy" | WordPress/WooCommerce theme with **15 `<h1>` tags** on the home page (one per category tile) and no meta description. No JSON-LD found on the home page. A very long, generic product-carousel home page. Cosplay means jerseys and uniforms, not props or katanas. No customisation and no event or pop-up story |
| 4 | **Hello Swanky**: helloswanky.com/collections/anime-t-shirts | Shopify streetwear label with an anime line | Oversized anime tees ₹799–909 (struck ₹1,599–1,819, "50% OFF"); "under ₹699" budget picks; free shipping over ₹999 (FREESHIP999) | Keyword title and meta description; long SEO copy with tables, "otaku type" matrix and FAQ; 240 GSM combed cotton, XS–5XL; DTG and screen print stated | **Only 2 products** were live in the anime collection, while the copy lists dozens of designs that aren't there (thin and mismatched). Two different `rel=canonical` tags (one with `?page=1`). Organization schema has empty `sameAs` strings. Copy contradicts itself ("under ₹200" vs "₹699"). Mojibake in a product title ("â€“") |
| 5 | **Suggoii Store**: suggoii.store | Bengaluru figure and collectibles shop. Fan-run voice ("We're a fan-run shop, not a corporation") | Figures (prices not captured); blind-box "3 items" mystery gift box | Best brand voice among the small players ("Find your little soul-spark", "Drop 24 · fresh in", "Suggoii stories" journal). Rich Rank Math schema (OnlineBusiness + Organization + Place with geo + WebSite SearchAction + WebPage). Phone and email in schema. 4.9★ claim | Figures only, no apparel or paper goods. Elementor builder (many decorative `h2`s like "★", "!!", "✦"). H1 is a 40-word sentence. Trustpilot 3.8 (from search snippet, not verified) |
| 6 | **The Poster Store**: theposterstore.in, also served at theposterstore.onrender.com | Kerala-based poster and polaroid shop across all fandoms (anime is one of ~20 categories) | Anime posters **₹79** (A5/A4/A3, MRP ₹179), 300 GSM matte, unframed; custom polaroids ₹169; 16-piece aesthetic polaroid set ₹229; collage kits (9/30/50 pcs). Stacked bundles "Buy 4 get 2 … Buy 20 get 10"; free shipping over ₹1,000 | Aggressive bundle ladder; custom polaroids and posters; collage kits; size guide in cm; Organization + WebSite + WebPage schema; Discord community | **The same site is indexable on a second host** (`*.onrender.com` shows in search results), which splits duplicate content and ranking signals. No H1 on the home page. Generic titles ("Home | The Poster Store"). "Anime Posters" naming with repeated suffixes ("Zenitsu #3 | Demon Slayer | Anime Posters") |
| — | **Redwolf**: redwolf.in | Historically a licensed pop-culture apparel brand | — | — | On 2026-10-19 the whole storefront redirected to a Shopify **password page** ("greatness loading"). Currently not trading online, so there's a gap in the market |
| — | Skypiea.in, Anime Devta | Small Shopify anime labels (from search results) | not captured | — | Could not be read (fetch errors / no live URL confirmed) |

**Our prices vs the market** (owner notebook in `docs/source/NOTEBOOK_TRANSCRIPTION.md`)

| Product | The Escape Door | Market band seen | Read |
|---|---|---|---|
| Oversized tee | ₹800 | ₹699–1,499 | Mid-low with no fake MRP. Lead on honesty plus custom options |
| Regular tee | ₹600 | ₹321–999 | In band |
| Hoodie | ₹1,200 / 1,500 / 1,800 / 2,500 by GSM | ₹1,999–3,299 | **Under** Comicsense. Selling hoodies by GSM is unique, so make it a visual ladder |
| Poster | ₹200 (buy 5 get 1) | ₹79 (bulk-discount poster shops) | Higher. Justify with paper, finish and size, or show A4/A3 tiers. **Open question for the owner** |
| Polaroid | ₹50 / 3 for ₹100 | ₹14–169 per piece | In band. 3-for-₹100 is a strong impulse bundle |
| Sticker | ₹30 | ₹49–59 | **Cheaper** than Comicsense |
| Badge | ₹50 / 5 for ₹200 | not found online | Few online competitors. An SEO opening |
| Bookmark / magnetic | ₹30 / ₹100 | ~₹34 per piece magnetic (8 for ₹274) and ~₹60 per piece 3D (3 for ₹179), from an Amazon affiliate roundup in search results | Plain bookmarks are cheap. Magnetic bookmarks at ₹100 are priced above that roundup, but they are rare in anime stores |
| Katana basic / LED | ₹1,200–2,000 / ₹3,000–4,000 | No Indian store found online for LED katanas (search returned US/UAE only) | Few online competitors. An SEO opening |
| Capes | ₹700–1,000 | Comicsense Mikasa scarf ₹699 (closest) | In band |

---

## 3. Patterns observed

**Collection naming**
- Licensed brands name the franchise first: "Franchise: Character" (Souled Store) or "brand x franchise" tags (Bewakoof).
- Fan-art houses use **codenames** that fans decode ("Honored One", "Nichirin Warrior", "Karasuno-10"). This avoids trademarked names in titles and doubles as insider humour.
- Poster shops use "Character #n | Series | Anime Posters".

**UX patterns**
- Filters by series/theme (with counts), fit, size, colour, sleeve and price band
- Sort options
- Ratings on cards
- "Only n left" scarcity
- Bundle tags on cards
- Free-shipping threshold bars (₹399 / ₹999 / ₹1,000)
- Free-gift thresholds
- Prepaid cashback
- COD stated in the footer or meta
- 30–100 day returns
- Track-order link to a courier portal
- App-download nags
- UGC/review walls
- No competitor showed WhatsApp ordering on the pages read. Our bio already runs on "DM to personalise".

**Size charts:** Bewakoof explains oversized vs regular in prose. Hello Swanky and Comicsense size inside variant pickers. The Poster Store gives a cm table. **None used an interactive fit visual.**

**SEO title and H1 patterns**
- Best: "Anime T Shirts Online: Anime Tees for Men & Women | Bewakoof" (title) with H1 "Anime Collection" and long question-led H2 copy.
- Weakest: Souled Store's generic title and empty description; Comicsense's 15 H1s.

**Schema in use**
- Bewakoof: CollectionPage, ItemList, AggregateOffer
- Suggoii: OnlineBusiness, Organization, Place, WebSite, WebPage
- Souled Store and The Poster Store: Organization, WebSite
- Hello Swanky: Organization only
- Comicsense: none detected
- **Nobody** showed BreadcrumbList, FAQPage or Event on the pages read. Event schema for pop-ups is open ground for us.

**What they all lack**
- A story: every site is a product grid with banners.
- Nobody shows the **maker** (handmade punch-and-cut process).
- Nobody shows the **IRL fest circuit**, which is our moat.
- Nobody offers **self-serve customisation** for apparel. Only The Poster Store offers custom posters and polaroids.

---

## 4. Keyword ideas with intent

Volumes and difficulty were **not measured**: no free volume tool ran in this pass, and DataForSEO and Ahrefs are paid. Priority is judgement based on intent fit and the competitors seen. Re-check in Search Console after launch.

| Keyword | Intent | Target page (slug) | Priority | Notes |
|---|---|---|---|---|
| anime merch India | Commercial / navigational-category | `/` (home) + `/anime` | High | Home H1 must say it plainly; brand story underneath |
| anime merchandise store India | Commercial | `/anime` | High | Variant; use in title/description |
| anime oversized t-shirts | Transactional | `/anime/oversized-t-shirts` | High | Bewakoof and Souled Store dominate. Win with fit visual, honest price and custom print |
| oversized anime t-shirt India / anime t-shirt for men / for women | Transactional | same + filter facets (not separate pages) | Med | Avoid thin facet pages; canonical to parent |
| Jujutsu Kaisen t-shirt India | Transactional | `/anime/jujutsu-kaisen` | High | Series hub: tees, polaroids, bookmarks, badges in one place, which no competitor does |
| Attack on Titan merch | Commercial | `/anime/attack-on-titan` | High | "merch", not "t-shirt", so lead with the cross-category hub |
| Demon Slayer t-shirt | Transactional | `/anime/demon-slayer` | High | Hub, with a tee filter anchor |
| One Piece merch India | Commercial | `/anime/one-piece` | High | Hub |
| anime hoodies (India) | Transactional | `/anime/hoodies` | High | GSM ladder (280→600 GSM) as the differentiator |
| anime polaroids | Transactional | `/anime/polaroids` | High | Low competition in anime-specific stores. "3 for ₹100" bundle |
| anime polaroid set / custom anime polaroids | Transactional | `/anime/polaroids` + `/custom/polaroids` | Med | Custom minimum 20 pcs |
| anime posters (India) | Transactional | `/anime/posters` | Med-High | Poster shops sell at ₹79, so compete on finish and size, not price |
| anime bookmarks / magnetic bookmarks anime | Transactional | `/anime/bookmarks` | Med | Few competitors; magnetic is rare |
| anime badges India | Transactional | `/anime/badges` | Med | Few competitors |
| anime stickers India | Transactional | `/anime/stickers` | Med | We are cheaper (₹30 vs ₹49–59) |
| cosplay props India | Commercial | `/cosplay` | High | Few competitors on Indian sites. Katanas, capes, earrings |
| cosplay katana India / LED katana India | Transactional | `/cosplay/katanas` | High | Basic vs LED comparison block. Note props are non-sharp (legal/safety) |
| anime cape cosplay India | Transactional | `/cosplay/capes` | Low-Med | |
| custom anime t-shirt printing | Transactional (service) | `/custom/t-shirts` | High | Upload-your-design flow: 4×4 in front, 12×15 in back, +₹200 if we design |
| custom t-shirt printing for college fest | Commercial B2B | `/collabs` | Med | Fest bulk orders (fandom-partner story) |
| anime merch stall [fest name] / Thomso merch | Navigational/local | `/pop-ups` + per-event pages | Med | Event schema per stall. Fest-goers search during fest week |
| fandom merch K-pop / F1 / books | Commercial | `/beyond-anime/*` | Low | Behind the "Beyond Anime" door; don't dilute the anime hubs |

Question H2 ideas for GEO answer blocks (write them as our own copy):
- What size oversized tee should I buy?
- What GSM hoodie is best for Indian winters?
- Are your katanas real blades?
- Can I print my own design?
- What is the minimum for custom polaroids?
- Where is your next pop-up stall?

---

## 5. Ten differentiation moves for our site

1. **Make the site the manga volume.** Categories are "chapters". Listing pages are panel grids with thick borders and diagonal splits. Opening a product is a page-turn. Competitors are all generic e-com grids, so this is the one visual idea that makes the store memorable.
2. **Fest circuit as proof and a URL set.** Add a `/pop-ups` map and timeline (Thomso ×3, Zeitgeist, Blithchron, Fluxus, Alcheringa, and the highlight cities Surat, Bhopal, Kolkata and Kolhapur). Give each stall an Event-schema page with dates, venue and "what we're bringing". No competitor has IRL presence on the site, and Event rich results are open ground.
3. **"Build a Panel Pack" bundle builder.** Use the owner's real bundle math: polaroids 3/₹100, bookmarks 4/₹100, badges 5/₹200, posters buy-5-get-1. Show a live price and a "next tier" nudge with a satisfying slot-in animation. Competitors only show static "Buy 4 get 2" banners.
4. **Self-serve custom studio.** Upload art or pick from our designs, then preview it on a tee with the real print zones (front 4×4 in, back 12×15 in). Show the "+₹200 we design it" toggle, the half-and-half option, and minimum quantities for custom polaroids, bookmarks and stickers. Nobody offers apparel customisation self-serve.
5. **WhatsApp-first ordering without an account.** Each product and the custom studio generate a prefilled WhatsApp/DM message (product, size, design code). This matches the existing "DM to personalise" habit. Show the UPI/COD policy clearly. **Owner to confirm COD.**
6. **Fit and fabric made visible.** Add an interactive oversized-vs-regular silhouette on a size slider, plus a **GSM ladder for hoodies** (280→600 GSM with weight and warmth cues). Bewakoof explains fit in 1,000 words; we show it in 3 seconds.
7. **Honest pricing, no fake MRP.** One real price per item; bundles are the only "deal". Competitors run struck-through "50–76% off" on almost everything. A visibly honest price fits "premium collectibles" and builds trust.
8. **Show the maker.** Short loops of cutting, punching and printing. The Jan 2026 post shows a corner-rounder punch and cutting mat. Add a "handmade at the escape door" stamp per item. It is authentic, cheap to shoot, and no competitor does it.
9. **Series hubs instead of product-type silos.** `/anime/jujutsu-kaisen` holds tees, hoodies, polaroids, bookmarks, badges and stickers for that series, with its own copy, FAQ, BreadcrumbList, CollectionPage/ItemList and Product/Offer schema. Competitors either split by product type (no series story) or have SEO holes:
   - Souled Store: empty meta description and canonical
   - Comicsense: 15 H1s
   - Hello Swanky: 2 products under a long page of copy
   - The Poster Store: duplicate host
10. **Trademark-safe naming with fan decoding.** Use our own codenames for designs (Comicsense proves fans love decoding them). Use the series names only descriptively in hub copy and alt text. Add a clear "original fan-art, not official merchandise" note. Never use official logos or screenshots. **Legal wording is an open question for the owner**, because Souled Store and Bewakoof are licensed and we are not.

Bonus moves:
- A "Beyond Anime" door keeps K-pop, F1, books and the rest out of the anime hubs.
- A `/collabs` page for fest organisers ("Fandom Partner" pitch, past fests, bulk custom merch) turns the Instagram collab cards into B2B leads.

---

## Open questions surfaced by this scan
- COD: yes or no? (Every big competitor offers it.)
- Poster pricing at ₹200 vs ₹79 market: what size and paper justify it?
- Are any designs licensed, or all original fan art? This decides the naming and disclaimer approach.
- Vector logo file and 5–10 original Instagram post files (the logged-out view does not show the screentone, ticker and Japanese-subtitle posts).

## Sources read (2026-10-19)
- https://www.instagram.com/escapedoor.in/ (meta tags + logged-out render)
- https://www.thesouledstore.com/anime-collection, /robots.txt, /sitemap.xml
- https://www.bewakoof.com/anime-collection, /robots.txt
- https://www.comicsense.store/ , /product-category/home-office/sticker/ , /product-category/accessories/from-the-anime-world/
- https://helloswanky.com/collections/anime-t-shirts
- https://suggoii.store/
- https://theposterstore.in/ , /shop?category=Polaroid ; https://theposterstore.onrender.com/product/one-piece-anime-posters
- https://redwolf.in/ (redirected to /password)
- Search context (built-in WebSearch): respawn.outlookindia.com (anime merch trade and Bandai Namco India articles), magicdrop.in (Amazon affiliate roundups for bookmarks and sticker price bands), upes.ac.in (Anime Devta)

---

## Critic addenda (2026-10-19, completeness pass)

- **Prices re-checked against `docs/source/NOTEBOOK_TRANSCRIPTION.md`.** Every price in "Our prices vs the market" matches the notebook: tees, hoodie GSM tiers, poster, polaroid, sticker, badge, bookmarks, katanas and capes. These lines were missing and are added here:
  - Baby tee ₹400
  - Keychain ₹150
  - Figurines ₹250–1,200 (₹2,500 premium)
  - Earrings and accessories ₹250–800
  - Market comparison: Comicsense figurines ₹1,199–4,599 and woven keychains ₹299, so **ours are cheaper**.
- **The slugs in §4 and §5 are superseded by `/SITEMAP.md`, which is binding.** Map them as follows:

  | competitors.md | SITEMAP.md |
  |---|---|
  | `/anime`, `/anime/oversized-t-shirts`, `/anime/hoodies`, … | `/shop`, `/shop/oversized-t-shirts`, `/shop/hoodies`, … |
  | `/anime/{series}` | `/arc/{series}` |
  | `/beyond-anime/*` | `/arc/beyond-anime` |
  | `/cosplay/katanas`, `/cosplay/capes` | `/shop/cosplay-props` + `/cosplay` |
  | `/custom/t-shirts`, `/custom/polaroids` | `/custom` |
  | `/pop-ups`, `/collabs` | `/fests` |
- **Fest-history facts. Keep the sources straight:**
  - **IG grid (evidence):** Thomso '25 ("3rd time" as Fandom Partner, so Thomso '26 would be the 4th if confirmed), Thomso '26, Zeitgeist 2026 (IIT Ropar), Blithchron 2026 (IIT Gandhinagar).
  - **Notebook:** VIT Bhopal, IIT Indore and IIT Ropar stalls, with no year.
  - **Brief only:** Fluxus (IIT Indore) and Alcheringa (IIT Guwahati).
  - Differentiation move #2 says "Thomso ×3". Use the owner-confirmed count, because OPEN_QUESTIONS #10 is still open.
- **Two logo systems.** §1 says "do not redraw or improve the logo". DESIGN §5 and CONTRACTS F3 ship **SVG recreations** of both marks (circle badge and door-bracket wordmark), marked "RECREATION — replace". That is acceptable only as a temporary stand-in. The owner must supply the vectors (OPEN_QUESTIONS #2) before launch.
- **Market-search limitation.** Firecrawl keyless search was refused in this pass, and the built-in WebSearch is US-indexed. Indian SERP evidence is thin. Re-validate the priorities in §4 with Search Console data after launch.
