'use client'
// One collection door: accent frame, leaf painted with the arc's original motif, a product
// peeking from behind. Leaf creaks open on hover/focus (CSS 3D), wider when "active" (centred).
import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ArcMotif } from '@/components/fx/ArcMotif'
import type { ArcDoorData } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function ArcDoor({
  door,
  total,
  active,
  priority = false,
}: {
  door: ArcDoorData
  total: number
  active: boolean
  priority?: boolean
}) {
  const words = door.name.toUpperCase().split(' ')
  // keep short words with their neighbour ("ON TITAN") so the stack stays tall and tight
  const lines: string[] = []
  for (const w of words) {
    const last = lines[lines.length - 1]
    if (last !== undefined && (w.length <= 2 || last.length <= 2)) lines[lines.length - 1] = `${last} ${w}`
    else lines.push(w)
  }
  const style = {
    '--door-a': door.accentA,
    '--door-b': door.accentB,
    '--door-fg': door.fgA === 'ink' ? 'var(--color-ink)' : 'var(--color-paper)',
  } as CSSProperties
  const meta = [`${door.count} ${door.count === 1 ? 'piece' : 'pieces'}`, door.fromLabel].filter(Boolean).join(' · ')

  return (
    <Link
      href={`/arc/${door.slug}`}
      className="s02-door focus-ring"
      data-active={active ? '' : undefined}
      data-cursor="OPEN"
      data-cursor-jp="開く"
      style={style}
      aria-label={`${door.name} arc: ${meta}. ${door.tagline}`}
    >
      <span className="s02-frame" aria-hidden="true">
        <span className="s02-lintel">
          <span className="font-mono">ARC {pad(door.index + 1)}</span>
          <span className="font-mono opacity-70">/{pad(total)}</span>
        </span>
        <span className="s02-opening">
          <span className="s02-spill" />
          {door.peek ? (
            <Image
              src={door.peek.src}
              alt=""
              width={600}
              height={750}
              sizes="(min-width: 1024px) 340px, 70vw"
              className="s02-peek"
              priority={priority}
            />
          ) : null}
          <span className="s02-enter">
            ENTER <span lang="ja">入る</span> →
          </span>
        </span>
        <span className="s02-leaf">
          <span className="s02-leaf-face">
            <ArcMotif
              motif={door.motif}
              colorA={door.accentA}
              colorB={door.accentB}
              animated
              width={360}
              height={640}
              density={0.55}
              seed={`${door.slug}-door`}
              className="s02-motif"
              loading="eager"
            />
            <span className="s02-shade" />
            <span className="s02-knob" />
            <span className="s02-jp-v" lang="ja">
              {door.jp}
            </span>
            <span className="s02-nameplate">
              <span className="s02-name">
                {lines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </span>
              <span className="s02-jp" lang="ja">
                {door.jp}
              </span>
            </span>
          </span>
          <span className="s02-leaf-back" />
        </span>
      </span>
      <span className="s02-plaque" aria-hidden="true">
        <span className="s02-meta">{meta}</span>
        <span className="s02-tagline">{door.tagline}</span>
      </span>
    </Link>
  )
}
