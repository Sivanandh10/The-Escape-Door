'use client'
// Forge stage: the garment (or flat-item stack) with to-scale print zones. The artwork can be dragged,
// pinched (scale + rotate) and nudged with the keyboard inside the zone. Signature: the design SLAMS
// onto the garment when it is placed (impact frame + ink splat + BAM!). Owner: P3 forge.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import { useGSAP } from '@gsap/react'
import { registerGsap, useReducedMotion } from '@/lib/motion'
import { clamp, cn } from '@/lib/utils'
import { InkSplat } from '@/components/fx/InkSplat'
import { Sfx } from '@/components/fx/Sfx'
import { BlankGarment, zoneRect, zoneStyle } from './BlankGarment'
import { isApparel, KIND_META, type ForgeData, type ForgeKind, type Placement, type Side } from './model'

const gsap = registerGsap()

export type Art = { kind: 'image'; url: string; name: string } | { kind: 'pdf'; name: string } | { kind: 'brief' } | null

export interface StageProps {
  kind: ForgeKind | null
  data: ForgeData
  side: Side
  onSide: (s: Side) => void
  place: Record<Side, Placement>
  onPlace: (side: Side, p: Partial<Placement>) => void
  /** art for each side (already resolved from files / mode) */
  art: Record<Side, Art>
  /** bump to replay the slam */
  slamKey: number
  /** true on the Place step: guides flash, artwork is interactive */
  editing: boolean
  qty: number
  bookmark: 'plain' | 'magnetic'
  /** files dropped onto the stage */
  onDropFiles?: (files: File[]) => void
}

export function Stage(props: StageProps) {
  const { kind, side, onSide, slamKey } = props
  const root = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [dragOver, setDragOver] = useState(false)

  // the slam: artwork drops from above, impact frame shakes the stage, splat + BAM pop
  useGSAP(
    () => {
      if (!slamKey || !root.current) return
      const q = gsap.utils.selector(root)
      const art = q('[data-slam-art]')
      if (!art.length) return
      if (reduced) {
        gsap.fromTo(art, { opacity: 0 }, { opacity: 1, duration: 0.18 })
        return
      }
      const tl = gsap.timeline()
      tl.fromTo(art, { yPercent: -140, scale: 1.9, rotate: -14, opacity: 0 }, { yPercent: 0, scale: 1, rotate: 0, opacity: 1, duration: 0.34, ease: 'expo.in' })
        .fromTo(q('[data-slam-shake]'), { x: 0, y: 0 }, { keyframes: [{ x: -7, y: 4 }, { x: 6, y: -3 }, { x: -3, y: 2 }, { x: 0, y: 0 }], duration: 0.16, ease: 'none' })
        .fromTo(art, { scale: 1.08 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, '<')
        .fromTo(q('[data-slam-splat]'), { scale: 0.2, opacity: 0.95 }, { scale: 1.25, opacity: 0, duration: 0.6, ease: 'expo.out' }, '<')
        .fromTo(q('[data-slam-bam]'), { scale: 0.3, opacity: 0, rotate: -18 }, { scale: 1, opacity: 1, rotate: -8, duration: 0.32, ease: 'back.out(2.4)' }, '<')
        .fromTo(q('[data-slam-lines]'), { opacity: 0.9, scale: 0.7 }, { opacity: 0, scale: 1.3, duration: 0.45, ease: 'expo.out' }, '<')
        .to(q('[data-slam-bam]'), { opacity: 0, y: -16, duration: 0.3, ease: 'power2.in' }, '+=0.5')
    },
    { scope: root, dependencies: [slamKey], revertOnUpdate: false },
  )

  // garment swap: quick panel pop
  useGSAP(
    () => {
      if (reduced || !root.current) return
      gsap.fromTo(root.current.querySelector('[data-garment]'), { scale: 0.94, opacity: 0.4 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.8)' })
    },
    { scope: root, dependencies: [kind, side] },
  )

  const apparel = isApparel(kind)
  const zone = props.data.apparel.zones[side]

  return (
    <div
      ref={root}
      className={cn('relative flex h-full flex-col', dragOver && 'outline-4 outline-offset-[-10px] outline-door outline-dashed')}
      onDragOver={(e) => {
        if (!props.onDropFiles || !e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!props.onDropFiles) return
        e.preventDefault()
        setDragOver(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length) props.onDropFiles(files)
      }}
    >
      {/* stage header */}
      <div className="relative z-10 flex items-center justify-between gap-3 border-b-4 border-ink bg-ink px-3 py-2 text-paper sm:px-4">
        <p className="label truncate">
          <span className="text-volt">Preview</span>
          {kind ? (
            <>
              {' · '}
              {apparel ? `${side} · ${zone.w}×${zone.h} in` : `${KIND_META[kind].plural} × ${props.qty}`}
            </>
          ) : (
            ' · waiting'
          )}
        </p>
        {apparel ? (
          <div role="group" aria-label="Garment side" className="flex shrink-0 border-2 border-paper">
            {(['front', 'back'] as Side[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={side === s}
                onClick={() => onSide(s)}
                className={cn(
                  'label focus-ring min-h-11 px-3 transition-colors duration-150',
                  side === s ? 'bg-volt text-ink' : 'text-paper can-hover:hover:bg-tone-2',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div data-slam-shake className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-6 sm:px-8">
        {/* speed lines burst behind (decorative) */}
        <svg data-slam-lines aria-hidden="true" viewBox="-100 -100 200 200" className="pointer-events-none absolute inset-0 m-auto h-[140%] w-[140%] opacity-0" preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 36 }, (_, i) => {
            const a = (i / 36) * Math.PI * 2
            const r1 = 34 + (i % 3) * 6
            return (
              <line key={i} x1={Math.cos(a) * r1} y1={Math.sin(a) * r1} x2={Math.cos(a) * 140} y2={Math.sin(a) * 140} stroke="#0B0B0F" strokeWidth={i % 2 ? 1.2 : 2.6} />
            )
          })}
        </svg>

        {apparel ? (
          <GarmentView {...props} kind={kind} />
        ) : kind ? (
          <FlatView {...props} kind={kind} />
        ) : (
          <EmptyView />
        )}

        <span data-slam-bam aria-hidden="true" className="pointer-events-none absolute right-[6%] top-[8%] opacity-0">
          <Sfx text="BAM!" size="md" tone="volt" rotate={-8} />
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- garment
function GarmentView(props: StageProps & { kind: 'tshirt' | 'hoodie' }) {
  const { kind, side, data, place, art, editing } = props
  const rect = zoneRect(kind, side, data.apparel.zones[side])
  const p = place[side]
  const a = art[side]
  const zoneDim = data.apparel.zones[side]

  return (
    <div data-garment className="relative w-full max-w-[min(520px,100%)]" style={{ aspectRatio: '1000 / 1100' }}>
      <BlankGarment kind={kind} side={side} id={`forge-${kind}-${side}`} />
      {/* print zone */}
      <div className="absolute" style={zoneStyle(rect)}>
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -inset-px border-2 border-dashed transition-[border-color,opacity] duration-200',
            p.on ? (editing ? 'border-volt opacity-100' : 'border-volt/60 opacity-80') : 'border-tone-3 opacity-60',
          )}
        />
        {/* dimension label */}
        <span aria-hidden="true" className="label pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-volt px-1.5 py-0.5 text-[10px] text-ink">
          {zoneDim.w}×{zoneDim.h} in
        </span>
        {/* corner ticks */}
        {editing ? (
          <span aria-hidden="true" className="pointer-events-none absolute inset-0">
            {['left-0 top-0 border-l-4 border-t-4', 'right-0 top-0 border-r-4 border-t-4', 'bottom-0 left-0 border-b-4 border-l-4', 'bottom-0 right-0 border-b-4 border-r-4'].map((c) => (
              <span key={c} className={cn('absolute size-3 border-volt', c)} />
            ))}
          </span>
        ) : null}
        <div className="absolute inset-0 overflow-hidden">
          <span data-slam-splat aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 w-[160%] -translate-x-1/2 -translate-y-1/2 opacity-0">
            <InkSplat variant={3} className="w-full text-volt" />
          </span>
          {p.on && a ? (
            <Artwork side={side} placement={p} art={a} editing={editing} onPlace={(np) => props.onPlace(side, np)} aspect={zoneDim.w / zoneDim.h} />
          ) : p.on ? (
            <span className="label absolute inset-0 flex items-center justify-center p-1 text-center text-[9px] leading-tight text-volt/80 sm:text-[10px]">
              {side === 'back' ? 'Your art lands here' : 'Art'}
            </span>
          ) : (
            <span className="label absolute inset-0 flex items-center justify-center text-center text-[9px] text-tone-3 sm:text-[10px]">No print</span>
          )}
        </div>
      </div>
    </div>
  )
}

function Artwork({
  side,
  placement,
  art,
  editing,
  onPlace,
  aspect,
}: {
  side: Side
  placement: Placement
  art: NonNullable<Art>
  editing: boolean
  onPlace: (p: Partial<Placement>) => void
  aspect: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const live = useRef(placement)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ dist: number; angle: number; scale: number; rotate: number } | null>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    live.current = placement
  }, [placement])

  const apply = (p: Placement) => {
    const el = box.current
    if (!el) return
    el.style.left = `${p.x * 100}%`
    el.style.top = `${p.y * 100}%`
    el.style.width = `${p.scale * 100}%`
    el.style.transform = `translate(-50%, -50%) rotate(${p.rotate}deg)`
  }
  const commit = () => onPlace({ x: live.current.x, y: live.current.y, scale: live.current.scale, rotate: live.current.rotate })

  const zoneSize = () => box.current?.parentElement?.getBoundingClientRect() ?? { width: 1, height: 1 }

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!editing) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setActive(true)
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      gesture.current = { dist: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x), scale: live.current.scale, rotate: live.current.rotate }
    }
  }
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, cur)
    const z = zoneSize()
    if (pointers.current.size >= 2 && gesture.current) {
      const [a, b] = Array.from(pointers.current.values())
      const dist = Math.hypot(b.x - a.x, b.y - a.y)
      const angle = Math.atan2(b.y - a.y, b.x - a.x)
      live.current = {
        ...live.current,
        scale: clamp(gesture.current.scale * (dist / Math.max(1, gesture.current.dist)), 0.2, 1),
        rotate: clamp(gesture.current.rotate + ((angle - gesture.current.angle) * 180) / Math.PI, -45, 45),
      }
    } else {
      live.current = {
        ...live.current,
        x: clamp(live.current.x + (cur.x - prev.x) / z.width, 0, 1),
        y: clamp(live.current.y + (cur.y - prev.y) / z.height, 0, 1),
      }
    }
    apply(live.current)
  }
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) gesture.current = null
    if (pointers.current.size === 0) {
      setActive(false)
      commit()
    }
  }
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!editing) return
    const step = e.shiftKey ? 0.05 : 0.01
    const p = { ...live.current }
    switch (e.key) {
      case 'ArrowLeft': p.x = clamp(p.x - step); break
      case 'ArrowRight': p.x = clamp(p.x + step); break
      case 'ArrowUp': p.y = clamp(p.y - step); break
      case 'ArrowDown': p.y = clamp(p.y + step); break
      case '+': case '=': p.scale = clamp(p.scale + 0.04, 0.2, 1); break
      case '-': case '_': p.scale = clamp(p.scale - 0.04, 0.2, 1); break
      case '[': p.rotate = clamp(p.rotate - 5, -45, 45); break
      case ']': p.rotate = clamp(p.rotate + 5, -45, 45); break
      case '0': p.x = 0.5; p.y = 0.5; p.rotate = 0; break
      default: return
    }
    e.preventDefault()
    live.current = p
    apply(p)
    onPlace(p)
  }

  const style: CSSProperties = {
    left: `${placement.x * 100}%`,
    top: `${placement.y * 100}%`,
    width: `${placement.scale * 100}%`,
    aspectRatio: String(aspect),
    transform: `translate(-50%, -50%) rotate(${placement.rotate}deg)`,
    touchAction: editing ? 'none' : undefined,
  }

  return (
    <div
      ref={box}
      className={cn('absolute', editing ? 'cursor-grab focus-ring active:cursor-grabbing' : 'pointer-events-none')}
      style={style}
      tabIndex={editing ? 0 : -1}
      role={editing ? 'group' : undefined}
      aria-roledescription={editing ? 'movable artwork' : undefined}
      aria-label={editing ? `${side} artwork: ${Math.round(placement.scale * 100)}% of zone, rotated ${Math.round(placement.rotate)} degrees. Arrow keys move, plus and minus resize, square brackets rotate, 0 centres.` : undefined}
      data-cursor={editing ? 'DRAG' : undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={onKey}
    >
      <div data-slam-art className={cn('h-full w-full', active && 'outline-2 outline-offset-2 outline-door')}>
        <ArtFace art={art} />
      </div>
    </div>
  )
}

function ArtFace({ art, compact = false }: { art: NonNullable<Art>; compact?: boolean }) {
  if (art.kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
    return <img src={art.url} alt="" draggable={false} className="h-full w-full select-none object-contain" />
  }
  if (art.kind === 'pdf') {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 border-2 border-ink bg-paper p-1 text-ink">
        <span className="font-display text-[clamp(14px,3vw,28px)] leading-none">PDF</span>
        {!compact ? <span className="label max-w-full truncate text-[8px]">{art.name}</span> : null}
      </span>
    )
  }
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-1 border-2 border-dashed border-volt bg-volt/10 p-1 text-center text-volt">
      <span className="font-sfx text-[clamp(12px,2.6vw,26px)] leading-none">WE DRAW IT</span>
      <span className="font-jp text-[clamp(8px,1.4vw,12px)] font-bold" lang="ja" aria-hidden="true">
        描きます
      </span>
    </span>
  )
}

// ---------------------------------------------------------------- flat items (polaroids, bookmarks, stickers, badges)
function FlatView(props: StageProps & { kind: ForgeKind }) {
  const { kind, art, qty, bookmark } = props
  const a = art.front ?? art.back
  const cards = 5
  return (
    <div data-garment className="relative flex aspect-square w-full max-w-[460px] items-center justify-center">
      {Array.from({ length: cards }, (_, i) => {
        const t = i - (cards - 1) / 2
        const top = i === cards - 1
        const style: CSSProperties = {
          transform: `translate(${t * 13}%, ${Math.abs(t) * 3}%) rotate(${t * 7}deg)`,
          zIndex: i,
        }
        return (
          <div key={i} className="absolute" style={style}>
            <div {...(top ? { 'data-slam-art': '' } : {})}>
              <FlatItem kind={kind} art={a} dim={!top} bookmark={bookmark} />
            </div>
          </div>
        )
      })}
      <span data-slam-splat aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 w-[90%] -translate-x-1/2 -translate-y-1/2 opacity-0">
        <InkSplat variant={5} className="w-full text-volt" />
      </span>
      <span className="absolute bottom-0 right-0 z-10 border-4 border-ink bg-volt px-3 py-1 font-display text-4xl leading-none text-ink shadow-hard sm:text-5xl">
        ×{qty}
      </span>
    </div>
  )
}

function FlatItem({ kind, art, dim, bookmark }: { kind: ForgeKind; art: Art; dim: boolean; bookmark: 'plain' | 'magnetic' }) {
  const face = art ? <ArtFace art={art} compact /> : <span className="block h-full w-full screentone-mid" style={{ color: '#6E6E78' }} />
  const shade = dim ? 'brightness-[.82]' : ''
  if (kind === 'polaroid')
    return (
      <div className={cn('w-[clamp(120px,30vw,190px)] border-[3px] border-ink bg-paper p-2 pb-8 shadow-hard-sm', shade)}>
        <div className="aspect-square overflow-hidden border-2 border-ink bg-tone-1">{face}</div>
      </div>
    )
  if (kind === 'bookmark')
    return (
      <div className={cn('relative h-[clamp(200px,48vw,300px)] w-[clamp(64px,15vw,92px)] overflow-hidden border-[3px] border-ink bg-paper p-1.5 shadow-hard-sm', shade)}>
        <span aria-hidden="true" className="absolute left-1/2 top-2 z-10 size-3 -translate-x-1/2 rounded-full border-2 border-ink bg-ink" />
        <div className="h-full overflow-hidden border-2 border-ink bg-tone-1">{face}</div>
        {bookmark === 'magnetic' ? <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1 bg-door/80" /> : null}
      </div>
    )
  if (kind === 'badge')
    return (
      <div className={cn('size-[clamp(120px,30vw,180px)] overflow-hidden rounded-full border-[5px] border-ink bg-tone-1 shadow-hard-sm', shade)}>
        <div className="h-full w-full scale-90 overflow-hidden rounded-full">{face}</div>
      </div>
    )
  return (
    <div className={cn('size-[clamp(120px,30vw,180px)] overflow-hidden rounded-[22%] border-[3px] border-ink bg-paper p-2 shadow-hard-sm', shade)}>
      <div className="h-full w-full overflow-hidden rounded-[18%] bg-tone-1">{face}</div>
    </div>
  )
}

function EmptyView() {
  return (
    <div data-garment className="relative w-full max-w-[460px]" style={{ aspectRatio: '1000 / 1100' }}>
      <div className="opacity-35">
        <BlankGarment kind="tshirt" side="back" id="forge-empty" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
        <span className="border-4 border-ink bg-paper px-4 py-2 font-display text-3xl uppercase leading-none text-ink shadow-hard sm:text-4xl">
          Pick a product
        </span>
        <span className="label text-ink">The press is warm</span>
      </div>
    </div>
  )
}

export default Stage
