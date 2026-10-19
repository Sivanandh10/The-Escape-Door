'use client'
// #37 infinite marquee band. Owner: F1.
// WAAPI loop (compositor transform), speed reacts to Lenis scroll velocity and reverses on scroll-up,
// pauses on hover and while offscreen. Reduced motion → static strip. Duplicates are aria-hidden.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import gsap from 'gsap'
import { useReducedMotion } from '@/lib/motion'
import { useScrollVelocity } from '@/components/motion/SmoothScroll'
import { cn, clamp } from '@/lib/utils'

export type TickerTone = 'volt' | 'ink' | 'lav' | 'paper' | 'door' | 'pink' | 'hype'

const TONES: Record<TickerTone, { band: string; sep: string }> = {
  volt: { band: 'bg-volt text-ink border-ink', sep: 'text-ink' },
  ink: { band: 'bg-ink text-paper border-paper', sep: 'text-volt' },
  lav: { band: 'bg-lav text-ink border-ink', sep: 'text-door' },
  paper: { band: 'bg-paper text-ink border-ink', sep: 'text-hype' },
  door: { band: 'bg-door text-paper border-ink', sep: 'text-volt' },
  pink: { band: 'bg-pink text-ink border-ink', sep: 'text-door' },
  hype: { band: 'bg-hype text-paper border-ink', sep: 'text-volt' },
}
const SIZES = {
  sm: { cls: 'text-[15px] py-2', gap: '1.1em' },
  md: { cls: 'text-[clamp(20px,2.4vw,30px)] py-2.5', gap: '0.9em' },
  lg: { cls: 'text-[clamp(30px,4.4vw,64px)] py-3', gap: '0.7em' },
}

const useIsoLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect

export interface TickerProps {
  items: string[]
  /** px per second. Default 70 */
  speed?: number
  direction?: 'left' | 'right'
  tone?: TickerTone
  /** band rotation in degrees (DESIGN: ±3). Default 0 */
  rotate?: number
  separator?: string
  size?: keyof typeof SIZES
  /** speed up / reverse with scroll velocity. Default true */
  reactToScroll?: boolean
  /** accessible label for the band (defaults to the items joined) */
  label?: string
  className?: string
  style?: CSSProperties
}

export function Ticker({
  items,
  speed = 70,
  direction = 'left',
  tone = 'volt',
  rotate = 0,
  separator = '✦',
  size = 'md',
  reactToScroll = true,
  label,
  className,
  style,
}: TickerProps) {
  const reduced = useReducedMotion()
  const velocity = useScrollVelocity()
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const unit = useRef<HTMLDivElement>(null)
  const [reps, setReps] = useState(2)
  const t = TONES[tone]

  // enough copies inside one half to cover the band
  useIsoLayout(() => {
    const r = root.current
    const u = unit.current
    if (!r || !u) return
    const fit = () => {
      const w = u.getBoundingClientRect().width
      if (!w) return
      setReps(Math.max(2, Math.ceil((r.clientWidth * 1.25) / w)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(r)
    return () => ro.disconnect()
  }, [items.join('|')])

  useEffect(() => {
    const el = track.current
    const r = root.current
    if (!el || !r || reduced) return
    const half = el.scrollWidth / 2
    if (!half) return
    const dir = direction === 'left' ? 1 : -1
    // GSAP-ticker driven (one transform write per frame): eases to a stop on hover, speeds up and
    // reverses with scroll velocity, pauses offscreen. (WAAPI cannot play an infinite animation reversed.)
    let x = 0
    let rate = dir
    let hovering = false
    let visible = true
    const tick = (_time: number, dt: number) => {
      if (!visible) return
      let target = hovering ? 0 : dir
      if (reactToScroll && !hovering) {
        const v = velocity.current
        const boost = 1 + clamp(Math.abs(v) * 0.12, 0, 4)
        target = dir * boost * (v < -0.6 ? -1 : 1)
      }
      rate += (target - rate) * 0.12
      x -= rate * speed * (Math.min(dt, 64) / 1000)
      if (x <= -half) x += half
      else if (x > 0) x -= half
      el.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`
    }
    gsap.ticker.add(tick)
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
    })
    io.observe(r)
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const enter = () => {
      hovering = true
    }
    const leave = () => {
      hovering = false
    }
    if (fine) {
      r.addEventListener('pointerenter', enter)
      r.addEventListener('pointerleave', leave)
    }
    return () => {
      gsap.ticker.remove(tick)
      io.disconnect()
      r.removeEventListener('pointerenter', enter)
      r.removeEventListener('pointerleave', leave)
      el.style.transform = ''
    }
  }, [reduced, reps, speed, direction, reactToScroll, velocity])

  const pad = `${(Math.tan((Math.abs(rotate) * Math.PI) / 180) * 50).toFixed(2)}%`
  const copyProps = { items, separator, sepClass: t.sep }
  const half = Array.from({ length: reps }, (_, i) => (
    <TickerCopy key={`a${i}`} {...copyProps} hidden={i > 0} ref={i === 0 ? unit : undefined} />
  ))
  const half2 = Array.from({ length: reps }, (_, i) => <TickerCopy key={`b${i}`} {...copyProps} hidden />)
  return (
    <div
      ref={root}
      role="marquee"
      aria-label={label ?? items.join(', ')}
      className={cn('relative w-full', className)}
      style={{ overflowX: 'clip', paddingBlock: rotate ? pad : undefined, ...style }}
    >
      <div
        className={cn('relative -mx-[5%] w-[110%] overflow-hidden border-y-[3px]', t.band)}
        style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined }}
      >
        <div
          ref={track}
          className={cn(
            'flex w-max items-center whitespace-nowrap font-display uppercase leading-none tracking-[0.01em]',
            SIZES[size].cls,
          )}
          style={{ '--tk-gap': SIZES[size].gap } as CSSProperties}
        >
          {half}
          {half2}
        </div>
      </div>
    </div>
  )
}

/** One run of the items (the first run is measured; the rest are aria-hidden copies). */
function TickerCopy({
  items,
  separator,
  sepClass,
  hidden,
  ref,
}: {
  items: string[]
  separator: string
  sepClass: string
  hidden: boolean
  ref?: React.Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={ref}
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center"
      style={{ gap: 'var(--tk-gap)', paddingRight: 'var(--tk-gap)' }}
    >
      {items.map((it, i) => (
        <span key={i} className="flex items-center" style={{ gap: 'var(--tk-gap)' }}>
          <span>{it}</span>
          <span aria-hidden="true" className={cn('text-[0.62em]', sepClass)}>
            {separator}
          </span>
        </span>
      ))}
    </div>
  )
}

export default Ticker
