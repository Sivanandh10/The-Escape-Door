'use client'
// ImageCarousel — reusable, accessible product image carousel (owner: P1 shop). Arrows avoid translate
// centering: the `press` :active translate would override it and drop the click.
// Native horizontal scroller + CSS scroll-snap (swipe/trackpad for free, compositor-driven = 60fps),
// prev/next panels, story-style progress pips, ←/→ keys, "2 of 5" slide labels.
// Autoplay: >1 image, pauses on hover/focus/touch, offscreen (IntersectionObserver ≥50%), hidden tab,
// zoom; never under prefers-reduced-motion.
//   variant 'card'    → hover-capable devices: plays only while hovered (first step is quick, like the old
//                       back-print flip) and returns to slide 1 on leave; touch devices: gentle auto-advance
//                       while ≥50% in view. Arrows appear on hover/focus. Slides link to `href`.
//   variant 'gallery' → big main slider + thumbnail strip (Front / Back print / Detail shortcuts),
//                       always-visible arrows, zoom toggle with pointer-follow origin.
// One image → a plain next/image, no controls.
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import type { ProductImage } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useFinePointer, useReducedMotion } from '@/lib/motion'

export interface ImageCarouselProps {
  images: ProductImage[]
  /** CSS aspect-ratio, e.g. '4/5' */
  aspect?: string
  sizes: string
  priority?: boolean
  /** default: true when images.length > 1 */
  autoPlay?: boolean
  /** ms between slides (default 3500) */
  interval?: number
  variant?: 'card' | 'gallery'
  className?: string
  /** stage background (colour block behind transparent art) */
  background?: string
  /** accessible name for the carousel, e.g. the product name */
  label?: string
  /** card: every slide links here */
  href?: string
  quality?: number
  /** gallery: ref to the main stage (fly-to-cart origin) */
  stageRef?: Ref<HTMLDivElement>
  /** gallery: decorative overlay inside the stage (badges); keep it pointer-events-none */
  overlay?: ReactNode
  /** extra classes for the main stage box */
  stageClassName?: string
  /** fires when the visible slide changes */
  onIndexChange?: (i: number, img: ProductImage) => void
}

export const sideLabel = (img: ProductImage, i: number) =>
  img.side === 'back' ? 'Back print' : img.side === 'detail' ? 'Detail' : i === 0 || img.side === 'front' ? 'Front' : `View ${i + 1}`

export function ImageCarousel({
  images,
  aspect = '4/5',
  sizes,
  priority,
  autoPlay,
  interval = 3500,
  variant = 'card',
  className,
  background,
  label = 'Product images',
  href,
  quality,
  stageRef,
  overlay,
  stageClassName,
  onIndexChange,
}: ImageCarouselProps) {
  const n = images.length
  const card = variant === 'card'
  const q = quality ?? (card ? 75 : 85)
  const id = useId()
  const scroller = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const fine = useFinePointer()
  const [index, setIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [touching, setTouching] = useState(false)
  const [inView, setInView] = useState(false)
  const [tabVisible, setTabVisible] = useState(true)
  const [zoom, setZoom] = useState(false)
  const [origin, setOrigin] = useState('50% 50%')
  const [step, setStep] = useState(0) // steps since playback (re)started
  const touchTimer = useRef<number | undefined>(undefined)
  const indexRef = useRef(0)

  const wantsAuto = (autoPlay ?? n > 1) && n > 1 && !reduced
  // card on a mouse/trackpad device: play only while hovered. Touch: play while in view.
  const hoverMode = card && fine
  const playing =
    wantsAuto && inView && tabVisible && !touching && !zoom && !focused && (hoverMode ? hovered : !hovered)

  // ---- index sync from native scroll (swipe, trackpad, programmatic) — rAF-throttled
  useEffect(() => {
    const el = scroller.current
    if (!el || n < 2) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth || 1
        const i = Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / w)))
        if (i !== indexRef.current) {
          indexRef.current = i
          setIndex(i)
        }
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [n])

  useEffect(() => {
    if (n > 1) onIndexChange?.(index, images[index])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const goTo = useCallback(
    (i: number, smooth = true) => {
      const el = scroller.current
      if (!el || n < 2) return
      const t = ((i % n) + n) % n
      el.scrollTo({ left: t * el.clientWidth, behavior: smooth && !reduced ? 'smooth' : 'auto' })
      indexRef.current = t
      setIndex(t)
    },
    [n, reduced],
  )
  const next = useCallback(() => goTo(indexRef.current + 1), [goTo])
  const prev = useCallback(() => goTo(indexRef.current - 1), [goTo])

  // ---- visibility: offscreen + hidden tab
  useEffect(() => {
    const el = root.current
    if (!el || n < 2) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting && e.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] })
    io.observe(el)
    const onVis = () => setTabVisible(!document.hidden)
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [n])

  // ---- autoplay: one timeout per step; any manual move restarts the clock
  useEffect(() => {
    if (!playing) return
    const delay = hoverMode && step === 0 ? 420 : card && !hoverMode ? interval * 1.25 : interval
    const t = window.setTimeout(() => { setStep((s) => s + 1); next() }, delay)
    return () => window.clearTimeout(t)
  }, [playing, index, step, interval, hoverMode, card, next])

  useEffect(() => { if (!playing) setStep(0) }, [playing])
  useEffect(() => () => window.clearTimeout(touchTimer.current), [])

  // card on desktop: back to the first slide when the pointer leaves (old crossfade equivalent)
  const onLeave = () => {
    setHovered(false)
    if (hoverMode && !focused) goTo(0)
    if (zoom) setZoom(false)
  }

  const onKey = (e: KeyboardEvent) => {
    if (n < 2) return
    if (e.key === 'ArrowRight') { e.preventDefault(); next() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0) }
    else if (e.key === 'End') { e.preventDefault(); goTo(n - 1) }
  }

  const onTouchStart = () => { window.clearTimeout(touchTimer.current); setTouching(true) }
  const onTouchEnd = () => {
    window.clearTimeout(touchTimer.current)
    touchTimer.current = window.setTimeout(() => setTouching(false), 4000)
  }

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!zoom) return
    const r = e.currentTarget.getBoundingClientRect()
    setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
  }

  const ratio: CSSProperties = { aspectRatio: aspect, backgroundColor: background }

  // ------------------------------------------------------------ single image
  if (n < 2) {
    const img = images[0]
    if (!img) return null
    return (
      <div className={cn('relative overflow-hidden', className)} style={ratio}>
        <Image src={img.src} alt={img.alt} fill sizes={sizes} preload={priority} quality={q} className={cn('object-cover', card && 'ted-card-img ted-card-front')} />
        {overlay}
      </div>
    )
  }

  const arrowBase = cn(
    'press absolute top-[calc(50%-22px)] z-[3] grid h-11 w-11 place-items-center border-[3px] border-ink bg-ink text-paper focus-ring',
    'can-hover:hover:bg-volt can-hover:hover:text-ink transition-[opacity,background-color,color] duration-150',
    card && 'opacity-0 group-hover/car:opacity-100 group-focus-within/car:opacity-100 [@media(hover:none)]:hidden',
  )
  const ctrlTab = card ? -1 : undefined

  const stage = (
    <div
      ref={card ? undefined : stageRef}
      className={cn('relative overflow-hidden', !card && stageClassName)}
      style={ratio}
      onPointerMove={card ? undefined : onMove}
    >
      <div
        ref={scroller}
        id={`${id}-track`}
        tabIndex={0}
        onKeyDown={onKey}
        aria-label={`${label}: use left and right arrow keys`}
        className={cn(
          'ted-car-track absolute inset-0 flex focus-ring',
          zoom ? 'overflow-hidden' : 'snap-x snap-mandatory overflow-x-auto overscroll-x-contain',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {images.map((img, i) => {
          const pic = (
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes={sizes}
              preload={priority && i === 0}
              loading={i === 0 ? undefined : 'lazy'}
              quality={q}
              draggable={false}
              className={cn(
                'object-cover',
                card ? 'ted-card-img' : 'transition-transform duration-[420ms] ease-[var(--ease-hover)] motion-reduce:transition-none',
              )}
              style={!card ? { transform: zoom && i === index ? 'scale(1.9)' : 'scale(1)', transformOrigin: origin } : undefined}
            />
          )
          return (
            <div
              key={`${img.src}-${i}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}: ${sideLabel(img, i)}`}
              aria-hidden={i !== index || undefined}
              className="relative h-full w-full shrink-0 snap-start snap-always"
            >
              {card && href ? (
                <Link href={href} tabIndex={-1} aria-hidden="true" className="absolute inset-0" data-cursor="VIEW" draggable={false}>
                  {pic}
                </Link>
              ) : !card ? (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setZoom((z) => !z)}
                  aria-hidden="true"
                  className={cn('absolute inset-0', zoom ? 'cursor-zoom-out' : 'cursor-zoom-in')}
                  data-cursor={zoom ? 'OUT' : 'ZOOM'}
                >
                  {pic}
                </button>
              ) : (
                pic
              )}
            </div>
          )
        })}
      </div>

      {/* story-style progress pips (clickable) */}
      <div className={cn('absolute inset-x-0 top-0 z-[3] flex gap-1', card ? 'px-1.5 pt-1' : 'px-3 pt-2')} role="group" aria-label="Choose image">
        {images.map((img, i) => (
          <button
            key={`pip-${i}`}
            type="button"
            tabIndex={ctrlTab}
            onClick={() => goTo(i)}
            aria-label={`Show image ${i + 1} of ${n}: ${sideLabel(img, i)}`}
            aria-current={i === index ? 'true' : undefined}
            aria-controls={`${id}-track`}
            className={cn('group/pip relative flex-1 focus-ring', card ? 'h-4' : 'h-6')}
          >
            <span className={cn('absolute inset-x-0 top-0 block overflow-hidden border border-ink bg-paper/45', card ? 'h-[5px]' : 'h-[7px]')}>
              <span
                key={i === index ? `fill-${index}-${playing ? step : 'p'}` : 'idle'}
                className={cn(
                  'ted-car-fill absolute inset-0 origin-left bg-volt',
                  i < index && 'scale-x-100',
                  i > index && 'scale-x-0',
                  i === index && (playing ? 'ted-car-fill-run' : 'scale-x-100'),
                )}
                style={i === index && playing ? { animationDuration: `${hoverMode && step === 0 ? 420 : card && !hoverMode ? interval * 1.25 : interval}ms` } : undefined}
              />
            </span>
          </button>
        ))}
      </div>

      <button type="button" tabIndex={ctrlTab} onClick={prev} aria-label="Previous image" aria-controls={`${id}-track`} className={cn(arrowBase, 'left-2', card && 'shadow-hard-sm')}>
        <ChevronLeft aria-hidden="true" className="h-5 w-5" strokeWidth={3} />
      </button>
      <button type="button" tabIndex={ctrlTab} onClick={next} aria-label="Next image" aria-controls={`${id}-track`} className={cn(arrowBase, 'right-2', card ? 'shadow-hard-sm' : 'bg-volt text-ink can-hover:hover:bg-paper')}>
        <ChevronRight aria-hidden="true" className="h-5 w-5" strokeWidth={3} />
      </button>

      {!card && (
        <button
          type="button"
          onClick={() => setZoom((z) => !z)}
          aria-pressed={zoom}
          aria-label={zoom ? 'Zoom out' : 'Zoom in on the print'}
          className="press absolute right-3 top-9 z-[3] grid h-11 w-11 place-items-center border-[3px] border-ink bg-paper text-ink focus-ring can-hover:hover:bg-volt"
        >
          {zoom ? <ZoomOut aria-hidden="true" className="h-5 w-5" strokeWidth={2.6} /> : <ZoomIn aria-hidden="true" className="h-5 w-5" strokeWidth={2.6} />}
        </button>
      )}

      <p className="sr-only" aria-live={playing ? 'off' : 'polite'} aria-atomic="true">
        Image {index + 1} of {n}: {sideLabel(images[index], index)}
      </p>
      {overlay}
    </div>
  )

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={cn('group/car relative', card && 'z-[2] h-full', className)}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true) }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') onLeave() }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false) }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {card ? stage : (
        <div className="flex flex-col gap-3">
          {stage}
          {/* thumbnail strip — Front / Back print / Detail shortcuts */}
          <div role="group" aria-label="Choose view" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onKeyDown={onKey}>
            {images.map((img, i) => (
              <button
                key={`thumb-${img.src}-${i}`}
                type="button"
                aria-pressed={i === index}
                aria-controls={`${id}-track`}
                onClick={() => goTo(i)}
                className={cn(
                  'press label relative flex min-h-12 shrink-0 items-center gap-3 border-[3px] px-2 py-1.5 text-[0.6875rem] focus-ring',
                  i === index ? 'border-ink bg-volt text-ink shadow-[3px_3px_0_0_var(--color-paper)]' : 'border-paper bg-ink text-paper hover:bg-tone-2',
                )}
              >
                <span className="relative h-12 w-10 overflow-hidden border-2 border-current" style={{ background }}>
                  <Image src={img.src} alt="" fill sizes="40px" quality={60} className="object-cover" />
                </span>
                {sideLabel(img, i)}
              </button>
            ))}
            <span className="label ml-auto shrink-0 self-center text-[0.5625rem] text-paper/50 max-sm:hidden">← → or swipe</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageCarousel
