// robots.txt (SITEMAP §1). Owner: P5.
// Private, transactional and dev-only routes are disallowed; /lab/* (QA previews) never gets crawled.
// Site search (/shop?q=) stays crawlable but is noindex,follow at the page level (addenda fix 2).
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api/', '/lab', '/lab/', '/cart', '/wishlist', '/checkout-success'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
