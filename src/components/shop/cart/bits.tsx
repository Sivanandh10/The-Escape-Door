'use client'
// Small cart building blocks: animated rupee counter, thumbnail, skeleton rows. Owner: P2.
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { DoorIcon } from '@/components/brand/DoorIcon'
import { formatINR } from '@/lib/pricing'
import { useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'

/** Rupee value that counts to its new value in ~280 ms (instant for reduced motion). */
export function Rupees({ value, className }: { value: number; className?: string }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (reduced || from.current === value) {
      from.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 280)
      const e = 1 - Math.pow(1 - k, 4)
      setShown(Math.round(a + (value - a) * e))
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      from.current = value
    }
  }, [value, reduced])
  return <span className={cn('tabular-nums', className)}>{formatINR(shown)}</span>
}

/** 600px mockup for a 1200px one (all seed mockups ship a -600 sibling). */
export function thumbOf(src: string | undefined): string {
  if (!src) return ''
  return /^\/mockups\/.+-(front|back)\.webp$/.test(src) ? src.replace(/\.webp$/, '-600.webp') : src
}

export function Thumb({ src, alt = '', className, sizes = '88px' }: { src?: string; alt?: string; className?: string; sizes?: string }) {
  const [broken, setBroken] = useState(false)
  const url = thumbOf(src)
  return (
    <span className={cn('relative block aspect-[4/5] shrink-0 overflow-hidden border-[3px] border-ink bg-lav', className)}>
      {url && !broken ? (
        <Image src={url} alt={alt} fill sizes={sizes} className="object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="screentone screentone-light absolute inset-0 grid place-items-center text-ink [--tone-opacity:0.25]">
          <DoorIcon open={0.3} size={28} />
        </span>
      )}
    </span>
  )
}

export function SkeletonLines({ rows = 2 }: { rows?: number }) {
  return (
    <ul aria-hidden="true" className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex gap-3 border-[3px] border-ink/15 p-3">
          <span className="skeleton-tone block aspect-[4/5] w-[72px]" />
          <span className="flex flex-1 flex-col gap-2 pt-1">
            <span className="skeleton-tone block h-4 w-3/4" />
            <span className="skeleton-tone block h-3 w-1/3" />
            <span className="skeleton-tone mt-auto block h-9 w-28" />
          </span>
        </li>
      ))}
    </ul>
  )
}
