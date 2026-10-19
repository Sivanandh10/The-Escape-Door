// Root layout: fonts, metadata, providers and the app shell. Owner: F1.
// Static under Cache Components: getCollections() is a 'use cache' read (cookie-less); nothing else is async.
import type { Metadata, Viewport } from 'next'
import { Anton, Bangers, DM_Sans, Dela_Gothic_One, JetBrains_Mono, Noto_Sans_JP } from 'next/font/google'
import { Providers } from '@/components/Providers'
import { SkipLink } from '@/components/layout/SkipLink'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { toNavArcs } from '@/components/layout/nav'
import JsonLd from '@/components/seo/JsonLd'
import { orgJsonLd, websiteJsonLd } from '@/lib/seo'
import { getCollections } from '@/lib/data/repo'
import './globals.css'

// DESIGN §3. JP faces + secondary faces use preload:false (JP glyphs arrive as unicode-range slices).
const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--nf-anton', display: 'swap' })
const bangers = Bangers({ weight: '400', subsets: ['latin'], variable: '--nf-bangers', display: 'swap', preload: false })
const dela = Dela_Gothic_One({ weight: '400', subsets: ['latin'], variable: '--nf-dela', display: 'swap', preload: false })
const dm = DM_Sans({ subsets: ['latin'], variable: '--nf-dm', display: 'swap' })
const jbm = JetBrains_Mono({ subsets: ['latin'], variable: '--nf-jbm', display: 'swap', preload: false })
const jp = Noto_Sans_JP({ weight: ['500', '900'], subsets: ['latin'], variable: '--nf-noto-jp', display: 'swap', preload: false })

// CONTRACTS §10.13 — localhost only in `next dev` with nothing else set.
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3100' : 'https://the-escape-door.netlify.app')
).replace(/\/+$/, '')

// SITEMAP §2.1
const DEFAULT_TITLE = 'Anime Merch India: Tees, Hoodies & Props | The Escape Door'
const DEFAULT_DESC =
  'Fan-inspired anime merch: oversized tees ₹800, hoodies from ₹1200, polaroids ₹50, posters, badges and cosplay katanas. Custom orders open.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: DEFAULT_TITLE, template: '%s | The Escape Door' },
  description: DEFAULT_DESC,
  applicationName: 'The Escape Door',
  openGraph: {
    type: 'website',
    siteName: 'The Escape Door',
    locale: 'en_IN',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
  },
  twitter: { card: 'summary_large_image', title: DEFAULT_TITLE, description: DEFAULT_DESC },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = {
  themeColor: '#0b0b0f',
  colorScheme: 'dark',
}

// Adds .js before first paint so reveal pre-states only hide content when JS will run them.
const JS_FLAG = "document.documentElement.classList.add('js')"

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const collections = await getCollections()
  const arcs = toNavArcs(collections)
  const swatches = collections.map(({ slug, accentA, accentB }) => ({ slug, accentA, accentB }))

  return (
    <html
      lang="en-IN"
      suppressHydrationWarning
      className={`${anton.variable} ${bangers.variable} ${dela.variable} ${dm.variable} ${jbm.variable} ${jp.variable}`}
      style={{ viewTransitionName: 'root' }}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
      </head>
      <body className="bg-ink font-body text-paper">
        <Providers arcs={swatches}>
          <SkipLink />
          <Header arcs={arcs} />
          <main id="main" tabIndex={-1} className="relative outline-none">
            {children}
          </main>
          <Footer arcs={arcs} />
        </Providers>
        <JsonLd id="ld-site" data={[orgJsonLd(), websiteJsonLd()]} />
      </body>
    </html>
  )
}
