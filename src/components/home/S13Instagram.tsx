// S13 INSTAGRAM STRIP (#37 ticker · #28 inner zoom). Owner: s13.
// Admin-managed instaPosts → horizontal strip linking out; empty (default) → designed state:
// six manga panel frames + follow CTA + Kado waving. Never loads Instagram's embed scripts.
import './s13/s13.css'
import { ArrowUpRight } from 'lucide-react'
import type { InstaPost } from '@/lib/types'
import { Ticker } from '@/components/fx/Ticker'
import { Magnetic } from '@/components/motion/Magnetic'
import { Reveal } from '@/components/motion/Reveal'
import { EmptyPanels } from './s13/EmptyPanels'
import { PostStrip } from './s13/PostStrip'

const HANDLE = '@escapedoor.in'
// Instagram bio lines (docs: about/SITEMAP) — the only claims we make here.
const TICKER = [HANDLE, 'Premium fandom collectibles', '最新', 'Custom-made', 'Collabs & pop-up events', 'DM to personalize']

export default function S13Instagram({
  posts = [],
  instagram = 'https://www.instagram.com/escapedoor.in',
}: {
  posts?: InstaPost[]
  instagram?: string
}) {
  const hasPosts = posts.length > 0
  return (
    <section
      id="instagram"
      aria-labelledby="instagram-title"
      className="relative overflow-hidden border-t-4 border-ink bg-ink pb-10 pt-[clamp(72px,9vw,140px)] text-paper"
    >
      <div className="container-x">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-10">
          <Reveal className="lg:col-span-7">
            <p className="label text-tone-4">
              Chapter 14 · {HANDLE}
              {hasPosts ? ` · ${posts.length} ${posts.length === 1 ? 'post' : 'posts'}` : ''}
            </p>
            <h2 id="instagram-title" className="h-display mt-4 max-w-[14ch] text-h2">
              Fresh panels on <em>Instagram</em>
            </h2>
            <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block text-tone-4">
              最新のコマ · インスタ
            </span>
          </Reveal>
          <Reveal className="flex flex-col items-start gap-5 lg:col-span-5 lg:items-end lg:text-right" stagger={0.06}>
            <p className="max-w-[40ch] text-[1.0625rem] leading-relaxed text-paper/85">
              <strong className="font-bold text-paper">Fresh drops land on Instagram first.</strong> New designs, custom
              pieces and the next fest stall or pop-up, posted there before anywhere else.
            </p>
            <Magnetic strength={0.3}>
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor="FOLLOW"
                className="press label group inline-flex min-h-12 items-center gap-3 border-[3px] border-paper bg-volt px-6 py-3 font-bold text-ink shadow-hard-paper focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-volt"
              >
                Follow {HANDLE}
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  strokeWidth={2.75}
                />
                <span className="sr-only"> on Instagram (opens in a new tab)</span>
              </a>
            </Magnetic>
          </Reveal>
        </div>

        <Reveal className="mt-12 lg:mt-14" variant="slam" self>
          {hasPosts ? <PostStrip posts={posts} /> : <EmptyPanels instagram={instagram} />}
        </Reveal>
      </div>

      <Ticker
        items={TICKER}
        tone="volt"
        rotate={-2}
        size="sm"
        speed={55}
        label={`Instagram ${HANDLE}: premium fandom collectibles, custom-made, collabs and pop-up events, DM to personalize`}
        className="mt-16 lg:mt-24"
      />
    </section>
  )
}
