// JSON-LD builders + site URL helpers. Owner: F2. SITEMAP.md §5 (schema plan).
// Pure: safe in Server Components, generateMetadata, sitemap.ts and route handlers.
import type { FestEvent, Product, Variant } from './types'

/** Production origin (Netlify). CONTRACTS §10.13. */
export const PRODUCTION_URL = 'https://the-escape-door.netlify.app'

/**
 * Canonical site origin, no trailing slash (CONTRACTS §10.13):
 * NEXT_PUBLIC_SITE_URL → Netlify build var URL → localhost (only under `next dev`) → PRODUCTION_URL.
 * Note: `URL` is not inlined into client bundles, so client code sees NEXT_PUBLIC_SITE_URL or the
 * fallback — set NEXT_PUBLIC_SITE_URL on Netlify once a custom domain exists.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3100' : PRODUCTION_URL)
).trim().replace(/\/+$/, '')
export const SITE_NAME = 'The Escape Door'
export const INSTAGRAM_URL = 'https://www.instagram.com/escapedoor.in'
export const ORG_ID = `${SITE_URL}/#org`
export const WEBSITE_ID = `${SITE_URL}/#website`
export const DISCLAIMER = 'Original fan-inspired designs. Not affiliated with or endorsed by any anime studio, publisher or rights holder.'

type JsonLdObject = Record<string, unknown>

/** absUrl('/shop') → "https://site/shop"; absolute URLs pass through. */
export function absUrl(path = '/'): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

const AVAILABILITY: Record<Product['stock'], string> = {
  in: 'https://schema.org/InStock',
  low: 'https://schema.org/LimitedAvailability',
  out: 'https://schema.org/OutOfStock',
  'made-to-order': 'https://schema.org/MadeToOrder',
}

/** Organization — minimal everywhere (layout), `full` on / and /about. Unconfirmed facts are omitted. */
export function orgJsonLd(full = false): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    alternateName: 'Escape Door',
    url: `${SITE_URL}/`,
    logo: absUrl('/brand/icon-512.png'),
    sameAs: [INSTAGRAM_URL],
    ...(full
      ? {
          description: 'Fan-inspired, original anime-first merchandise and fandom collectibles from India.',
          areaServed: 'IN',
        }
      : {}),
  }
}

/** WebSite + SearchAction (home only). */
export function websiteJsonLd(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: 'en-IN',
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/shop?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}

function rangeOf(v: Variant): [number, number] | null {
  const m = /^\s*(\d+)\s*[–—-]\s*(\d+)\s*$/.exec(v.attrs?.range ?? '')
  return m ? [Number(m[1]), Number(m[2])] : null
}

function offerFor(p: Product, v: Variant, url: string): JsonLdObject | null {
  if (p.priceOnRequest) return null
  const base = {
    priceCurrency: 'INR',
    availability: AVAILABILITY[p.stock] ?? AVAILABILITY.in,
    itemCondition: 'https://schema.org/NewCondition',
    url,
    seller: { '@id': ORG_ID },
  }
  if (typeof v.price === 'number') return { '@type': 'Offer', ...base, price: String(v.price) }
  const r = rangeOf(v)
  // Ranges never go in `price` (SITEMAP §5): low/high only.
  if (r) return { '@type': 'AggregateOffer', ...base, lowPrice: String(r[0]), highPrice: String(r[1]) }
  return null
}

/**
 * Product (single SKU / variant offers) or ProductGroup (apparel: variesBy size, one variant
 * per fit-or-GSM × size). No ratings or reviews until real ones exist.
 */
export function productJsonLd(p: Product, opts: { collectionName?: string } = {}): JsonLdObject {
  const url = absUrl(`/product/${p.slug}`)
  const images = p.images.map((i) => absUrl(i.src))
  const desc = `${p.description} Fan-inspired original design; not official merchandise.`
  const common = {
    '@context': 'https://schema.org',
    name: p.name,
    description: desc,
    image: images,
    brand: { '@type': 'Brand', name: SITE_NAME },
    ...(opts.collectionName ? { category: opts.collectionName } : {}),
  }

  if (p.sizes?.length && !p.priceOnRequest) {
    const hasVariant = p.variants.flatMap((v) =>
      p.sizes!.map((size) => {
        const offer = offerFor(p, v, `${url}?size=${encodeURIComponent(size)}`)
        return {
          '@type': 'Product',
          sku: `${v.id}-${size}`.toUpperCase(),
          name: `${p.name} (${p.variants.length > 1 ? `${v.label}, ` : ''}${size})`,
          size,
          image: images[0],
          ...(v.attrs && Object.keys(v.attrs).length
            ? { additionalProperty: Object.entries(v.attrs).map(([name, value]) => ({ '@type': 'PropertyValue', name, value })) }
            : {}),
          ...(offer ? { offers: offer } : {}),
        }
      }),
    )
    return {
      ...common,
      '@type': 'ProductGroup',
      '@id': `${url}#group`,
      productGroupID: p.id,
      url,
      variesBy: 'https://schema.org/size',
      hasVariant,
    }
  }

  const offers = p.variants.map((v) => offerFor(p, v, url)).filter((o): o is JsonLdObject => o !== null)
    .map((o, i) => (p.variants.length > 1 ? { ...o, name: p.variants[i]?.label } : o))
  return {
    ...common,
    '@type': 'Product',
    '@id': `${url}#product`,
    sku: p.id.toUpperCase(),
    url,
    ...(offers.length === 1 ? { offers: offers[0] } : offers.length ? { offers } : {}),
  }
}

/** BreadcrumbList — items like [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }]. */
export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absUrl(it.path) })),
  }
}

/** Event — only when the owner confirmed the date WITH a year (CONTRACTS §10.6). Otherwise null. */
export function eventJsonLd(e: FestEvent): JsonLdObject | null {
  if (!e.confirmed || !e.startDate || !/^\d{4}-\d{2}-\d{2}/.test(e.startDate)) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `The Escape Door anime merch stall at ${e.venue || e.name}`,
    startDate: e.startDate,
    ...(e.endDate ? { endDate: e.endDate } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: e.kind === 'online' ? 'https://schema.org/OnlineEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode',
    location: e.kind === 'online'
      ? { '@type': 'VirtualLocation', url: INSTAGRAM_URL }
      : { '@type': 'Place', name: e.venue || e.city, address: { '@type': 'PostalAddress', addressLocality: e.city, addressCountry: 'IN' } },
    organizer: { '@id': ORG_ID },
    description: `Pop-up stall with fan-inspired anime merch at ${e.venue || e.city}.`,
  }
}

/** FAQPage — pass only the Q&As visible on that page, with the exact visible text. */
export function faqJsonLd(qa: Array<{ q: string; a: string }>): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }
}

/** ItemList of product URLs (summary list, max 24 by default — no duplicated Product markup). */
export function itemListJsonLd(products: Array<Pick<Product, 'slug' | 'name'>>, opts: { limit?: number; name?: string } = {}): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    ...(opts.name ? { name: opts.name } : {}),
    itemListElement: products.slice(0, opts.limit ?? 24).map((p, i) => ({
      '@type': 'ListItem', position: i + 1, url: absUrl(`/product/${p.slug}`), name: p.name,
    })),
  }
}

/** CollectionPage wrapping an ItemList (shop, categories, arcs, cosplay). */
export function collectionPageJsonLd(name: string, path: string, products: Array<Pick<Product, 'slug' | 'name'>>, description?: string): JsonLdObject {
  const { ['@context']: _ctx, ...list } = itemListJsonLd(products)
  void _ctx
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url: absUrl(path),
    ...(description ? { description } : {}),
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: list,
  }
}

/** Service (Custom Forge / fest partnership). `areaServed` IN, provider = Organization. */
export function serviceJsonLd(opts: { name: string; serviceType: string; path: string; description?: string }): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    serviceType: opts.serviceType,
    url: absUrl(opts.path),
    ...(opts.description ? { description: opts.description } : {}),
    provider: { '@id': ORG_ID },
    areaServed: 'IN',
  }
}

/** Serialise for a <script type="application/ld+json"> (escapes `<` so `</script>` can't break out). */
const LS = String.fromCharCode(0x2028)
const PS = String.fromCharCode(0x2029)
const BS = String.fromCharCode(92) // backslash

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .split('<').join(`${BS}u003c`)
    .split(LS).join(`${BS}u2028`)
    .split(PS).join(`${BS}u2029`)
}
