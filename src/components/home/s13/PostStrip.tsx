'use client'
// S13 posts mode: admin-managed instaPosts as a horizontal strip with #28 inner zoom.
// Plain links out (rel noopener) — no Instagram embed scripts. Owner: s13.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import type { InstaPost } from '@/lib/types'
import { Screentone } from '@/components/fx/Screentone'
import { track } from '@/lib/analytics'

export function PostStrip({ posts }: { posts: InstaPost[] }) {
  const strip = useRef<HTMLUListElement>(null)
  const [edge, setEdge] = useState<{ start: boolean; end: boolean }>({ start: true, end: false })
  const sorted = [...posts].sort((a, b) => a.order - b.order)

  const measure = useCallback(() => {
    const el = strip.current
    if (!el) return
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 })
  }, [])

  useEffect(() => {
    measure()
    const el = strip.current
    if (!el) return
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [measure])

  const page = (dir: 1 | -1) => {
    const el = strip.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className="relative">
      <ul
        ref={strip}
        className="s13-strip -mx-[var(--gutter)] flex gap-4 overflow-x-auto px-[var(--gutter)] pb-4 pt-2 md:gap-5"
        aria-label="Latest Instagram posts"
        data-lenis-prevent-horizontal=""
      >
        {sorted.map((p, i) => (
          <li key={p.id} className="w-[72%] shrink-0 sm:w-[42%] lg:w-[23%]">
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('instagram_click', { post: p.id })}
              className="s13-frame group relative block overflow-hidden border-[3px] border-paper bg-tone-1"
            >
              <span className="relative block aspect-square overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded remote images, unknown host */}
                <img
                  src={p.image}
                  alt={p.caption ? `Instagram post: ${p.caption}` : `Instagram post ${i + 1} from @escapedoor.in`}
                  loading="lazy"
                  decoding="async"
                  width={600}
                  height={600}
                  className="s13-zoom absolute inset-0 size-full object-cover"
                />
                <span className="s13-alt absolute inset-0">
                  <Screentone density="mid" color="var(--color-ink)" opacity={0.35} />
                </span>
                <span className="label absolute left-2 top-2 border-2 border-ink bg-volt px-2 py-1 text-ink">
                  #{String(i + 1).padStart(2, '0')}
                </span>
              </span>
              <span className="flex items-start justify-between gap-3 border-t-[3px] border-paper p-3">
                <span className="line-clamp-2 text-[0.875rem] leading-snug text-paper">{p.caption || '@escapedoor.in'}</span>
                <ArrowUpRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-volt" strokeWidth={2.5} />
              </span>
              <span className="sr-only"> (opens Instagram in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      {sorted.length > 3 && (
        <div className="mt-4 hidden justify-end gap-3 md:flex">
          <StripButton label="Previous posts" disabled={edge.start} onClick={() => page(-1)}>
            <ArrowLeft className="size-5" strokeWidth={2.5} aria-hidden="true" />
          </StripButton>
          <StripButton label="Next posts" disabled={edge.end} onClick={() => page(1)}>
            <ArrowRight className="size-5" strokeWidth={2.5} aria-hidden="true" />
          </StripButton>
        </div>
      )}
    </div>
  )
}

function StripButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="press grid size-12 place-items-center border-[3px] border-paper bg-ink text-paper shadow-hard-paper hover:bg-volt hover:text-ink focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  )
}
