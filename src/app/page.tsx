// Home: composes the manga volume S00 → S13 (CONTRACTS §7 + §10.8). Owner: F1.
// Every read is a 'use cache' repo function (cookie-less), so the page stays fully static.
import type { Metadata } from 'next'
import {
  getCollections,
  getDropOfWeek,
  getEvents,
  getHoodieTiers,
  getInstaPosts,
  getPartnerships,
  getProducts,
  getSettings,
} from '@/lib/data/repo'
import S00Preloader from '@/components/home/S00Preloader'
import S01Hero from '@/components/home/S01Hero'
import S02ChooseArc from '@/components/home/S02ChooseArc'
import S03Drop from '@/components/home/S03Drop'
import S04BackPrint from '@/components/home/S04BackPrint'
import S05Squad from '@/components/home/S05Squad'
import S06Wall from '@/components/home/S06Wall'
import S07Gsm from '@/components/home/S07Gsm'
import S08Cosplay from '@/components/home/S08Cosplay'
import S09ForgeTeaser from '@/components/home/S09ForgeTeaser'
import S10Partners from '@/components/home/S10Partners'
import S11Live from '@/components/home/S11Live'
import S12Beyond from '@/components/home/S12Beyond'
import S14Faq from '@/components/home/S14Faq'
import S13Instagram from '@/components/home/S13Instagram'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: '/' },
}

const CV = { contentVisibility: 'auto', containIntrinsicSize: 'auto 900px' } as const

const WALL_TYPES = new Set(['polaroid', 'sticker', 'poster', 'bookmark', 'badge'])
const COSPLAY_TYPES = new Set(['cosplay', 'katana', 'cape', 'figurine', 'accessory'])

export default async function HomePage() {
  const [collections, products, drop, events, partnerships, settings, posts, tiers] = await Promise.all([
    getCollections(),
    getProducts(),
    getDropOfWeek(),
    getEvents(),
    getPartnerships(),
    getSettings(),
    getInstaPosts(),
    getHoodieTiers(),
  ])

  const featured = products.filter((p) => p.featured)
  const wall = products.filter((p) => WALL_TYPES.has(p.type))
  const cosplay = products.filter((p) => COSPLAY_TYPES.has(p.type))
  const beyond = collections.find((c) => c.group === 'beyond') ?? null

  return (
    <>
      <S00Preloader />
      <S01Hero settings={settings} />
      <S02ChooseArc collections={collections} />
      <S03Drop product={drop} />
      <S04BackPrint product={drop} />
      <S05Squad products={featured} />
      <S06Wall products={wall} />
      <S07Gsm tiers={tiers} />
      {/* perf: below the last pinned section (S07) the browser may skip layout/paint until near view.
          contain-intrinsic-size 'auto' remembers the real height after first render (no ScrollTrigger drift above). */}
      <div style={CV}>
        <S08Cosplay products={cosplay} />
      </div>
      <div style={CV}>
        <S09ForgeTeaser />
      </div>
      <div style={CV}>
        <S10Partners partnerships={partnerships} />
      </div>
      <div style={CV}>
        <S11Live events={events} />
      </div>
      <div style={CV}>
        <S12Beyond collection={beyond} />
      </div>
      <div style={CV}>
        <S14Faq />
      </div>
      <div style={CV}>
        <S13Instagram posts={posts} instagram={settings.instagram} />
      </div>
    </>
  )
}
