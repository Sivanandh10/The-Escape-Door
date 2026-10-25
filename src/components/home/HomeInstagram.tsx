// HOME · Instagram, compact (review feedback #4): one row. Desktop/tablet only — on phones the footer already
// links Instagram, so the strip is skipped there. Admin posts → the existing single-row PostStrip; none → just the
// follow line. Never loads Instagram's embed scripts. Owner: HOME.
import '@/components/home/s13/s13.css'
import { ArrowUpRight } from 'lucide-react'
import type { InstaPost } from '@/lib/types'
import { PostStrip } from './s13/PostStrip'

const HANDLE = '@escapedoor.in'

export default function HomeInstagram({ posts = [], instagram = 'https://www.instagram.com/escapedoor.in' }: { posts?: InstaPost[]; instagram?: string }) {
  return (
    <section id="instagram" aria-labelledby="instagram-title" className="hidden border-t-4 border-ink bg-ink py-10 text-paper md:block">
      <div className="container-x">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <h2 id="instagram-title" className="h-display text-[clamp(32px,3.4vw,48px)] leading-[0.9]">
              Fresh panels on <em>Instagram</em>
            </h2>
            <p className="text-[16px] text-tone-4">New drops, custom pieces and the next fest stall land there first.</p>
          </div>
          <a
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="FOLLOW"
            className="press label group inline-flex min-h-12 items-center gap-3 border-[3px] border-paper bg-volt px-6 py-3 font-bold text-ink shadow-hard-paper focus-ring"
          >
            Follow {HANDLE}
            <ArrowUpRight aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2.75} />
            <span className="sr-only"> on Instagram (opens in a new tab)</span>
          </a>
        </div>
        {posts.length > 0 && (
          <div className="mt-8">
            <PostStrip posts={posts} />
          </div>
        )}
      </div>
    </section>
  )
}
