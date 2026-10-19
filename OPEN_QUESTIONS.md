# Open questions — facts only the owner can give

The site is built and working with sensible defaults for each of these. Every default is editable in /admin (or one env var) so nothing needs a code change.

## Blocking for launch
1. **Instagram screenshots.** The brief mentions 6 Instagram screenshots, but only the 3 notebook photos arrived. Please send them — the visual language and both logos were rebuilt from the written description (and whatever Instagram showed publicly).
2. **Logo files.** Please send the original vector files (SVG / AI / PDF) for (1) the cream circle badge with rust lettering and (2) the purple door-bracket "[" wordmark. The site uses hand-made SVG recreations marked *replace with original files* (`public/brand/`).
3. **WhatsApp number** for orders (international format, e.g. 91XXXXXXXXXX). Set as `NEXT_PUBLIC_WHATSAPP_NUMBER`.
4. **Owner email** for the /admin login (Supabase Auth, owner-only).
5. **Domain.** Is it `escapedoor.in`? Until then the site runs on the Netlify subdomain.

## Price doubts from the notebook (site uses the reading on the left)
| Item | What the site uses | Doubt |
|---|---|---|
| Custom badges | min **350 pcs at ₹12/pc** (different designs allowed) | Could also read "₹350 for 12 pcs". 350 is a large minimum for students — which is right? |
| Stickers | ₹30 each · **₹100 pack** | Notebook says "100₹/pc" — how many stickers in the ₹100 pack? |
| Custom stickers | min **15 pcs at ₹30/pc** | Notebook also writes "25 × 15" — is it ₹25/pc for custom? |
| Magnetic bookmark | ₹100 each · 2 for ₹150 · **₹80/pc bulk** | From how many pieces does ₹80/pc apply? |
| Custom bookmarks | min **14 pcs at ₹100/pc = ₹1400** | Plain or magnetic? Plain retail is ₹30. |
| Custom polaroids | min **20 pcs at ₹50/pc = ₹1000** | Confirmed by the maths in the notebook — just checking the 3-for-₹100 deal does not apply to custom. |
| Custom apparel | +₹200 if Escape Door designs it; half-n-half +₹200; "depends on cloth price" | Is the +₹200 per piece or per order? Is the print price included in the garment price for front 4×4 in and back 12×15 in? |
| Posters | ₹200 · 6 for ₹1000 (buy 5 get 1 free) | Poster size(s)? (A4 / A3 / 12×18?) |
| Hoodies | ₹1200 / 1500 / 1800 / 2500 by GSM | Which colours/designs exist at each GSM? |
| Cosplay "₹150–2000, 4000" | shown as a range per product | Which items fall in each range? |
| Figurines "₹250–1200, 2500" | range; ₹2500 shown as premium tier | Correct? |
| Cosplay hats, tote bags, stationery, half-n-half tees | **"Price on request"** | Prices? |

## Business facts
6. **Sizes & size chart** for regular, oversized and baby tees, and hoodies (S–XXL? chest measurements?).
7. **Shipping:** pan-India? Charges? Free-shipping threshold? Delivery time? COD available?
8. **Returns / exchanges** policy (needed for the FAQ and Product schema `hasMerchantReturnPolicy`).
9. **Stall dates — which year?** VIT Bhopal 21–28 Feb · IIT Ropar 13–15 Mar · IIT Indore 14–16 Mar. The site shows them as *2027 — dates to be confirmed* and emits Event schema only once you tick "confirmed" in /admin.
10. **Fest history:** confirm the years for Thomso (3×) and the exact wording you're allowed to use ("Official Fandom Partner"?). Fest logos are **not** used — text names only — unless the fests give written permission.
11. **Business details** for the footer and Organization schema: legal/business name, city, public email, GSTIN (optional).
12. **Real product photos.** All product images are original sample mockups marked *sample — replace with real photo*; upload real photos in /admin → Products.
13. **Customer photos / reviews.** The site shows "[Customer photo / review]" slots only. Send real ones (with permission) and they'll go live.
14. **Franchise disclaimer wording.** Default footer line: *"Original fan-inspired designs. Not affiliated with or endorsed by any anime studio, publisher or rights holder."* OK?

## Accounts the owner (or you) must create — free tiers
15. **Netlify** — run `npx netlify-cli login` once on this machine (or share a deploy token) so the site can be deployed.
16. **Supabase** — create a free project and share the Project URL + anon key + service-role key (service key goes only into Netlify env vars), or run `npx supabase login` here.
17. **GA4 Measurement ID** and **Microsoft Clarity project ID** (optional; slots are ready).
