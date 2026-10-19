'use client'
// S05 interaction layer: #27 expanding accordion (desktop flex-grow tween), Flip reshuffle (mobile grid),
// #26 grayscale on compressed panels, the ONE card peel (#29 hinge + screentone plate + sticker pop-out).
// Mouse: hover expands. Keyboard: focus expands, Enter opens. Touch: first tap expands, second tap opens.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { useGSAP } from '@gsap/react'
import { prefersReducedMotion, registerGsap } from '@/lib/motion'
import { Screentone } from '@/components/fx/Screentone'
import './squad.css'
import { styles } from './classes'

registerGsap()

export interface SquadPanel {
  key: string
  index: string
  href: string
  title: string
  noun: string
  jp: string
  tone: 'volt' | 'lav' | 'pink' | 'door'
  count: number
  from: string | null
  detail: string
  sticker: { big: string; small: string }
  art: ReactNode
}

const TONE: Record<SquadPanel['tone'], { bg: string; fg: string; st: string }> = {
  volt: { bg: 'var(--color-volt)', fg: 'var(--color-ink)', st: 'var(--color-pink)' },
  lav: { bg: 'var(--color-lav)', fg: 'var(--color-ink)', st: 'var(--color-volt)' },
  pink: { bg: 'var(--color-pink)', fg: 'var(--color-ink)', st: 'var(--color-volt)' },
  door: { bg: 'var(--color-door)', fg: 'var(--color-paper)', st: 'var(--color-volt)' },
}

const SHORT: Record<string, string> = { tees: 'Tees', hoodies: 'Hoodies', prints: 'Prints', cosplay: 'Props' }

/** deterministic starburst (die-cut sticker outline) */
function burst(spikes: number, seed: number): string {
  const pts: string[] = []
  for (let i = 0; i < spikes * 2; i++) {
    const a = (Math.PI * i) / spikes - Math.PI / 2
    const jitter = ((Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1) * 0.06
    const r = i % 2 === 0 ? 96 - Math.abs(jitter) * 60 : 74 + jitter * 40
    pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`)
  }
  return pts.join(' ')
}

const isWide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

export default function SquadGrid({ panels }: { panels: SquadPanel[] }) {
  const [active, setActive] = useState<number | null>(null)
  const activeRef = useRef<number | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const itemsRef = useRef<(HTMLLIElement | null)[]>([])
  const flipState = useRef<ReturnType<typeof Flip.getState> | null>(null)
  const pointerType = useRef<string>('mouse')

  const items = () => itemsRef.current.filter((el): el is HTMLLIElement => !!el)

  const activate = useCallback((i: number | null) => {
    if (activeRef.current === i) return
    if (!isWide() && !prefersReducedMotion()) flipState.current = Flip.getState(items())
    activeRef.current = i
    setActive(i)
  }, [])

  // #27 desktop flex-grow / mobile Flip reshuffle — runs after React commits the new data-state
  useLayoutEffect(() => {
    const els = items()
    const reduced = prefersReducedMotion()
    if (isWide()) {
      flipState.current = null
      els.forEach((el, j) => {
        const grow = active === null ? 1 : j === active ? 3.2 : 0.62
        if (reduced) gsap.set(el, { flexGrow: grow })
        else gsap.to(el, { flexGrow: grow, duration: 0.7, ease: 'power3.inOut', overwrite: 'auto' })
      })
    } else {
      els.forEach((el) => gsap.set(el, { clearProps: 'flexGrow' }))
      if (flipState.current) {
        Flip.from(flipState.current, { duration: 0.6, ease: 'power3.inOut', simple: true })
        flipState.current = null
      }
    }
  }, [active])

  // touch: tap outside collapses · Esc collapses
  useEffect(() => {
    if (active === null) return
    const onDown = (e: PointerEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) activate(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') activate(null)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [active, activate])

  // entrance: panels slam up through an ink wipe (#08) · exit: the strip tilts away like a turned page
  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      const els = items()
      gsap.from(els, {
        yPercent: 16,
        rotate: (i: number) => (i % 2 ? 2.5 : -2.5),
        clipPath: 'inset(100% 0% 0% 0%)',
        duration: 0.95,
        ease: 'power4.out',
        stagger: 0.09,
        clearProps: 'transform,clipPath',
        scrollTrigger: { trigger: listRef.current, start: 'top 85%', once: true },
      })
      gsap.to(listRef.current, {
        yPercent: -5,
        rotate: -1,
        scale: 0.97,
        ease: 'none',
        scrollTrigger: { trigger: listRef.current, start: 'bottom 45%', end: 'bottom top', scrub: 0.4 },
      })
    },
    { scope: listRef },
  )

  return (
    <ul
      ref={listRef}
      className={styles.list}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') activate(null)
      }}
      onBlur={(e) => {
        if (!listRef.current?.contains(e.relatedTarget as Node | null)) activate(null)
      }}
    >
      {panels.map((p, i) => {
        const t = TONE[p.tone]
        const state = active === null ? 'rest' : active === i ? 'active' : 'compressed'
        return (
          <li
            key={p.key}
            ref={(el) => {
              itemsRef.current[i] = el
            }}
            className={styles.item}
            data-state={state}
            style={{ '--bg': t.bg, '--fg': t.fg, '--float-delay': `${-i * 1.3}s` } as CSSProperties}
          >
            <Link
              href={p.href}
              className={styles.link}
              data-cursor="OPEN"
              data-cursor-jp={p.jp}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') activate(i)
              }}
              onPointerDown={(e) => {
                pointerType.current = e.pointerType
              }}
              onFocus={(e) => {
                // keyboard focus only — a tap also focuses, and must not count as the "first tap"
                if (e.currentTarget.matches(':focus-visible')) activate(i)
              }}
              onClick={(e) => {
                if (pointerType.current !== 'mouse' && activeRef.current !== i) {
                  e.preventDefault()
                  activate(i)
                }
                pointerType.current = 'mouse'
              }}
            >
              <span className={styles.plate} aria-hidden="true">
                <Screentone density="mid" color={t.bg} opacity={0.55} drift />
                <span className={styles.plateJp}>{p.jp}</span>
              </span>

              <span className={styles.face}>
                <span className={styles.shade} aria-hidden="true">
                  <Screentone density="dense" color="var(--color-ink)" opacity={0.3} fade="top" />
                </span>
                <span className={styles.top} aria-hidden="true">
                  <span>{p.index}</span>
                  <span lang="ja" className={styles.topJp}>
                    {p.jp}
                  </span>
                </span>
                <span className={styles.titleH}>{p.title}</span>
                <span className={styles.titleShort} aria-hidden="true">
                  {SHORT[p.key] ?? p.title}
                </span>
                <span className={styles.titleV} aria-hidden="true">
                  {p.title}
                </span>
                <span className={styles.art} aria-hidden="true">
                  <span className={styles.artFloat}>{p.art}</span>
                </span>
                <span className={styles.meta}>
                  <span className={styles.count}>
                    {p.count} {p.count === 1 ? 'design' : 'designs'}
                  </span>
                  {p.from ? <span className={styles.from}>From {p.from}</span> : null}
                  {p.detail ? <span className={styles.detail}>{p.detail}</span> : null}
                  <span className={styles.cta}>
                    <span className={styles.ctaMouse}>Shop {p.noun}</span>
                    <span className={styles.ctaTouch}>Tap again · shop {p.noun}</span>
                    <span className={styles.ctaArrow} aria-hidden="true">
                      →
                    </span>
                  </span>
                </span>
              </span>

              <span className={styles.sticker} aria-hidden="true">
                <svg viewBox="-110 -110 220 220" className={styles.stickerSvg}>
                  <polygon points={burst(13, i + 1)} fill="var(--color-ink)" transform="translate(7 7)" />
                  <polygon points={burst(13, i + 1)} fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="5" strokeLinejoin="round" />
                  <polygon points={burst(13, i + 1)} fill={t.st} transform="scale(0.84)" />
                </svg>
                <span className={styles.stickerText}>
                  <span className={styles.stickerBig}>{p.sticker.big}</span>
                  <span className={styles.stickerSmall}>{p.sticker.small}</span>
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
