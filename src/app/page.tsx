// Home: a SHORT manga volume (review feedback #4 — was 20+ phone screens). Owner: HOME.
//   hero door → fast shop (categories + arcs + honest library line) → fest credibility (moved high)
//   → drop of the week with the back-print flip → 4 FAQs → one-row Instagram (desktop).
// Everything cut from the old 15-section home still lives on its own page:
//   squad grid → /shop · polaroid & sticker wall → /shop/polaroids · GSM power levels → /shop/hoodies
//   cosplay stage → /cosplay · custom forge → /custom · beyond anime → /arc/beyond-anime
//   arc corridor → /arc/<slug> (arc chips in the fast-shop block) · partner timeline + stalls → /fests.
// Every read is a 'use cache' repo function (cookie-less), so the page stays fully static.
import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import {
  getBundleRules,
  getCollections,
  getDropOfWeek,
  getEvents,
  getHoodieTiers,
  getInstaPosts,
  getPartnerships,
  getProducts,
  getSettings,
} from '@/lib/data/repo'
import { whatsappNumber } from '@/lib/whatsapp'
import { isoDay, splitUpcoming } from '@/components/content/events'
import S00Preloader from '@/components/home/S00Preloader'
import S01Hero from '@/components/home/S01Hero'
import HomeQuickShop from '@/components/home/HomeQuickShop'
import HomeFests from '@/components/home/HomeFests'
import HomeDrop from '@/components/home/HomeDrop'
import S14Faq from '@/components/home/S14Faq'
import HomeInstagram from '@/components/home/HomeInstagram'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: 'The Escape Door', locale: 'en_IN', url: '/' },
}

const CV = { contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' } as const

/** Today's date, cached for an hour so the page stays static (confirmed stalls drop off once they end). */
async function today() {
  'use cache'
  cacheLife('hours')
  return isoDay()
}

export default async function HomePage() {
  const [collections, products, drop, events, partnerships, settings, posts, tiers, rules, day] = await Promise.all([
    getCollections(),
    getProducts(),
    getDropOfWeek(),
    getEvents(),
    getPartnerships(),
    getSettings(),
    getInstaPosts(),
    getHoodieTiers(),
    getBundleRules(),
    today(),
  ])
  // feedback #6: only confirmed + dated stalls reach the home page; "next season" ones live on /fests
  const { dated } = splitUpcoming(events, day)

  return (
    <>
      <S00Preloader />
      <S01Hero settings={settings} products={products} />
      <HomeQuickShop products={products} collections={collections} tiers={tiers} rules={rules} whatsapp={whatsappNumber(settings.whatsapp)} />
      <HomeFests partnerships={partnerships} dated={dated} />
      <HomeDrop product={drop} />
      <div style={CV}>
        <S14Faq />
      </div>
      <div style={CV}>
        <HomeInstagram posts={posts} instagram={settings.instagram} />
      </div>
    </>
  )
}
