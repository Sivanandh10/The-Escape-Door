'use client'
// #34 Locomotive-style "Collections index": rows fill bottom→top with the arc accent; on fine
// pointers a mockup thumbnail follows the cursor (quickTo); on touch the row nearest the
// viewport centre lights up and its thumbnail slides in. Hover/focus also recolours the page.
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { registerGsap, useFinePointer, useReducedMotion } from '@/lib/motion'
import type { ArcDoorData } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function CollectionsIndex({
  doors,
  onArc,
}: {
  doors: ArcDoorData[]
  onArc: (slug: string | null) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLDivElement>(null)
  const fine = useFinePointer()
  const reduced = useReducedMotion()
  const [hover, setHover] = useState<number>(-1)
  const [centre, setCentre] = useState<number>(-1)
  const quick = useRef<{ x: gsap.QuickToFunc; y: gsap.QuickToFunc; r: gsap.QuickToFunc } | null>(null)

  useGSAP(
    () => {
      if (!fine || !thumb.current) return
      registerGsap()
      const t = thumb.current
      gsap.set(t, { xPercent: -50, yPercent: -50 })
      quick.current = {
        x: gsap.quickTo(t, 'x', { duration: reduced ? 0 : 0.5, ease: 'power3' }),
        y: gsap.quickTo(t, 'y', { duration: reduced ? 0 : 0.5, ease: 'power3' }),
        r: gsap.quickTo(t, 'rotation', { duration: 0.6, ease: 'power3' }),
      }
    },
    { scope: root, dependencies: [fine, reduced] },
  )

  // touch: highlight the row crossing the middle of the viewport
  useEffect(() => {
    if (fine || !root.current) return
    const rows = Array.from(root.current.querySelectorAll<HTMLElement>('[data-row]'))
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCentre(Number((e.target as HTMLElement).dataset.row))
      },
      { rootMargin: '-46% 0px -46% 0px' },
    )
    rows.forEach((r) => io.observe(r))
    return () => io.disconnect()
  }, [fine])

  const onMove = (e: React.PointerEvent) => {
    if (!quick.current || !root.current) return
    const box = root.current.getBoundingClientRect()
    const x = e.clientX - box.left
    quick.current.x(x)
    quick.current.y(e.clientY - box.top)
    quick.current.r(gsap.utils.clamp(-8, 8, (x / box.width - 0.5) * 16))
  }

  const current = hover >= 0 ? doors[hover] : null

  return (
    <div
      ref={root}
      className="s02-index relative"
      onPointerMove={onMove}
      onPointerLeave={() => {
        setHover(-1)
        onArc(null)
      }}
    >
      <div className="flex items-end justify-between gap-4 border-b-4 border-paper/90 pb-3">
        <h3 className="h-display text-[28px] sm:text-[36px]">Collections index</h3>
        <span lang="ja" aria-hidden="true" className="jp-sub hidden sm:block">
          索引
        </span>
        <span className="label text-paper/70">{pad(doors.length)} doors</span>
      </div>
      <ul>
        {doors.map((d, i) => {
          const lit = hover === i || (!fine && centre === i)
          return (
            <li key={d.slug} data-row={i}>
              <Link
                href={`/arc/${d.slug}`}
                className="s02-row focus-ring"
                data-lit={lit ? '' : undefined}
                data-cursor="OPEN"
                data-cursor-jp="開く"
                style={
                  {
                    '--row-a': d.accentA,
                    '--row-fg': d.fgA === 'ink' ? 'var(--color-ink)' : 'var(--color-paper)',
                  } as CSSProperties
                }
                onPointerEnter={() => {
                  if (!fine) return
                  setHover(i)
                  onArc(d.slug)
                }}
                onFocus={() => {
                  setHover(i)
                  onArc(d.slug)
                }}
                onBlur={() => setHover(-1)}
              >
                <span className="s02-row-num font-mono">{pad(i + 1)}</span>
                <span className="s02-row-name h-display">{d.name}</span>
                <span lang="ja" className="s02-row-jp font-jp">
                  {d.jp}
                </span>
                <span className="s02-row-meta font-mono">
                  {d.count} pcs{d.fromLabel ? ` · ${d.fromLabel}` : ''}
                </span>
                {!fine && d.peek ? (
                  <span className="s02-row-thumb" aria-hidden="true">
                    <Image src={d.peek.src} alt="" width={120} height={150} sizes="72px" />
                  </span>
                ) : null}
                <span className="s02-row-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {fine ? (
        <div ref={thumb} className="s02-float" data-show={current ? '' : undefined} aria-hidden="true">
          {doors.map((d, i) =>
            d.peek ? (
              <Image
                key={d.slug}
                src={d.peek.src}
                alt=""
                width={600}
                height={750}
                sizes="240px"
                data-on={hover === i ? '' : undefined}
              />
            ) : null,
          )}
          <span className="s02-float-tag font-mono">
            {current?.peek?.name ?? ''}
          </span>
        </div>
      ) : null}
    </div>
  )
}
