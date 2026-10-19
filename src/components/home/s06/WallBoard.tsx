'use client'
// S06 interaction layer: draggable polaroids / stickers / badges (#45) with constraints, inertia,
// z-raise on grab, keyboard nudge (arrows, Shift = bigger steps), reset. Entrance = items get
// slapped onto the wall (GSAP, once); idle = CSS float; exit = the layer drifts up as the board leaves.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { animate, motion, useMotionValue } from 'motion/react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { RotateCcw } from 'lucide-react'
import { prefersReducedMotion, registerGsap } from '@/lib/motion'
import { clamp } from '@/lib/utils'
import './wall.css'
import { styles } from './classes'

registerGsap()

export interface WallItem {
  id: string
  /** accessible description, e.g. "Polaroid: Talisman Strip (Jujutsu Kaisen)" */
  label: string
  node: ReactNode
  /** desktop/tablet slot: left %, top %, rotation deg */
  d: [number, number, number]
  /** mobile slot (null = hidden on phones) */
  m: [number, number, number] | null
}

const SNAP = { type: 'spring', stiffness: 420, damping: 32 } as const

function Item({
  item,
  index,
  boardRef,
  z,
  onGrab,
  resetNonce,
}: {
  item: WallItem
  index: number
  boardRef: RefObject<HTMLDivElement | null>
  z: number
  onGrab: (id: string) => void
  resetNonce: number
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!resetNonce) return
    const opts = prefersReducedMotion() ? { duration: 0 } : SNAP
    animate(x, 0, opts)
    animate(y, 0, opts)
  }, [resetNonce, x, y])

  const nudge = (dx: number, dy: number) => {
    const board = boardRef.current?.getBoundingClientRect()
    const r = ref.current?.getBoundingClientRect()
    if (!board || !r) return
    const cdx = clamp(dx, board.left + 4 - r.left, board.right - 4 - r.right)
    const cdy = clamp(dy, board.top + 4 - r.top, board.bottom - 4 - r.bottom)
    const opts = prefersReducedMotion() ? { duration: 0 } : { type: 'spring' as const, stiffness: 600, damping: 36 }
    animate(x, x.get() + cdx, opts)
    animate(y, y.get() + cdy, opts)
    onGrab(item.id)
  }

  const [dl, dt, dr] = item.d
  const [ml, mt, mr] = item.m ?? item.d
  return (
    <div
      className={styles.slot}
      data-wall-slot=""
      data-mobile={item.m ? 'show' : 'hide'}
      style={
        {
          '--x': `${dl}%`,
          '--y': `${dt}%`,
          '--xs': `${ml}%`,
          '--ys': `${mt}%`,
          zIndex: z,
        } as CSSProperties
      }
    >
      <motion.div
        ref={ref}
        className={styles.drag}
        style={{ x, y }}
        drag
        dragConstraints={boardRef}
        dragElastic={0.12}
        dragMomentum
        dragTransition={{ power: 0.3, timeConstant: 260, bounceStiffness: 420, bounceDamping: 26 }}
        whileDrag={{ scale: 1.07, rotate: index % 2 ? 4 : -4 }}
        onPointerDown={() => onGrab(item.id)}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => setDragging(false)}
        data-dragging={dragging}
        data-cursor="DRAG"
        tabIndex={0}
        role="group"
        aria-roledescription="draggable item"
        aria-label={`${item.label}. Arrow keys move it.`}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 48 : 16
          const map: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
          }
          const d = map[e.key]
          if (!d) return
          e.preventDefault()
          nudge(d[0], d[1])
        }}
      >
        <div
          className={styles.rot}
          style={{ '--r': `${dr}deg`, '--rs': `${mr}deg` } as CSSProperties}
        >
          <div className={styles.float} style={{ '--fd': `${3.6 + (index % 5) * 0.45}s`, '--fdl': `${-index * 0.7}s` } as CSSProperties}>
            {item.node}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function WallBoard({ items, hint, hintJp }: { items: WallItem[]; hint: string; hintJp: string }) {
  const boardRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id))
  const [moved, setMoved] = useState(false)
  const [resetNonce, setResetNonce] = useState(0)
  const [status, setStatus] = useState('')

  const grab = useCallback((id: string) => {
    setMoved(true)
    setStatus('')
    setOrder((o) => (o[o.length - 1] === id ? o : [...o.filter((x) => x !== id), id]))
  }, [])

  const reset = () => {
    if (!moved) return
    setResetNonce((n) => n + 1)
    setOrder(items.map((i) => i.id))
    setMoved(false)
    setStatus('Wall tidied — everything is back on its pin.')
  }

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      const slots = gsap.utils.toArray<HTMLElement>('[data-wall-slot]', layerRef.current)
      gsap.from(slots, {
        autoAlpha: 0,
        scale: 1.45,
        y: -36,
        duration: 0.55,
        ease: 'back.out(2.2)',
        stagger: 0.07,
        clearProps: 'transform,opacity,visibility',
        scrollTrigger: { trigger: boardRef.current, start: 'top 72%', once: true },
      })
      gsap.to(layerRef.current, {
        y: -36,
        ease: 'none',
        scrollTrigger: { trigger: boardRef.current, start: 'bottom 55%', end: 'bottom top', scrub: 0.4 },
      })
    },
    { scope: boardRef },
  )

  return (
    <div ref={boardRef} className={styles.board}>
      <span className={styles.hint} aria-hidden="true">
        <span className={styles.hintDrag}>{hint}</span>
        <span className={styles.hintKeys}>Arrow keys move · Shift = faster</span>
        <span lang="ja" className={styles.hintJp}>
          {hintJp}
        </span>
      </span>
      <div ref={layerRef} className={styles.layer}>
        {items.map((it, i) => (
          <Item
            key={it.id}
            item={it}
            index={i}
            boardRef={boardRef}
            z={order.indexOf(it.id) + 1}
            onGrab={grab}
            resetNonce={resetNonce}
          />
        ))}
      </div>
      <button type="button" className={styles.reset} onClick={reset} aria-disabled={!moved}>
        <RotateCcw aria-hidden="true" size={16} strokeWidth={2.5} className={styles.resetIcon} />
        Reset wall
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
    </div>
  )
}
