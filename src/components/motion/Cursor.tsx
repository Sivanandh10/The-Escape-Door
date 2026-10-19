'use client'
// #31 custom cursor: volt dot + ink/volt ring; ring becomes a sticker label over [data-cursor]. Owner: F1.
// Fine pointers only (hidden on touch + reduced motion). Per frame: 2 transform writes, no layout reads.
// Labels: data-cursor="OPEN" | "ADD" | "VIEW" | "DRAG" | any short text. data-cursor-jp="開く" adds a JP line.
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { registerGsap, useFinePointer, useIsTouch, useReducedMotion } from '@/lib/motion'

const JP: Record<string, string> = { OPEN: '開く', ADD: '追加', VIEW: '見る', DRAG: 'ドラッグ', PLAY: '再生' }
const INTERACTIVE = 'a, button, [role="button"], input, select, textarea, label, summary, [data-cursor]'

export function Cursor() {
  const touch = useIsTouch()
  const reduced = useReducedMotion()
  const fine = useFinePointer()
  const enabled = fine && !touch && !reduced
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const jpRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!enabled || !dot.current || !ring.current) return
    registerGsap()
    const root = document.documentElement
    const d = dot.current
    const r = ring.current
    const xTo = gsap.quickTo(r, 'x', { duration: 0.42, ease: 'power3' })
    const yTo = gsap.quickTo(r, 'y', { duration: 0.42, ease: 'power3' })
    let shown = false
    let state = ''

    const setState = (next: string, label: string, jp: string) => {
      if (next === state && labelRef.current?.textContent === label) return
      state = next
      r.dataset.state = next
      d.dataset.state = next
      if (labelRef.current) labelRef.current.textContent = label
      if (jpRef.current) jpRef.current.textContent = jp
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      d.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`
      xTo(e.clientX)
      yTo(e.clientY)
      if (!shown) {
        shown = true
        gsap.set(r, { x: e.clientX, y: e.clientY })
        root.classList.add('has-cursor')
        d.dataset.visible = r.dataset.visible = 'true'
      }
    }
    // label lookup on pointerover (delegated; once per element change, not per frame)
    const onOver = (e: PointerEvent) => {
      const t = e.target as Element | null
      const labelled = t?.closest<HTMLElement>('[data-cursor]')
      if (labelled) {
        const label = (labelled.dataset.cursor || '').toUpperCase().slice(0, 10)
        setState('label', label, labelled.dataset.cursorJp ?? JP[label] ?? '')
        return
      }
      if (t?.closest('input, textarea, select')) return setState('text', '', '')
      if (t?.closest(INTERACTIVE)) return setState('hover', '', '')
      setState('', '', '')
    }
    const onDown = () => {
      r.dataset.down = 'true'
    }
    const onUp = () => {
      delete r.dataset.down
    }
    const onLeave = () => {
      shown = false
      d.dataset.visible = r.dataset.visible = 'false'
      root.classList.remove('has-cursor')
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerover', onOver, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerover', onOver)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      root.classList.remove('has-cursor')
    }
  }, [enabled])

  if (!enabled) return null
  return (
    <div aria-hidden="true" className="ted-cursor pointer-events-none fixed inset-0 z-[200]">
      <div ref={ring} className="ted-cursor-ring" data-visible="false">
        <div className="ted-cursor-ring-inner">
          <span ref={labelRef} className="ted-cursor-label" />
          <span ref={jpRef} className="ted-cursor-jp" lang="ja" />
        </div>
      </div>
      <div ref={dot} className="ted-cursor-dot" data-visible="false" />
      <style>{CURSOR_CSS}</style>
    </div>
  )
}

const CURSOR_CSS = `
.ted-cursor-dot,.ted-cursor-ring{position:fixed;left:0;top:0;will-change:transform;opacity:0;transition:opacity 200ms var(--ease-hover)}
.ted-cursor-dot[data-visible="true"],.ted-cursor-ring[data-visible="true"]{opacity:1}
.ted-cursor-dot{width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:var(--color-volt);box-shadow:0 0 0 2px var(--color-ink)}
.ted-cursor-dot[data-state="label"],.ted-cursor-dot[data-state="text"]{opacity:0}
.ted-cursor-ring{width:0;height:0}
.ted-cursor-ring-inner{position:absolute;left:-18px;top:-18px;width:36px;height:36px;border-radius:50%;
  border:2px solid var(--color-volt);box-shadow:0 0 0 1.5px var(--color-ink),inset 0 0 0 1.5px var(--color-ink);
  display:grid;place-content:center;text-align:center;
  transition:transform 260ms var(--ease-slam),background-color 180ms var(--ease-hover),border-color 180ms var(--ease-hover),border-radius 200ms var(--ease-hover),box-shadow 200ms var(--ease-hover)}
.ted-cursor-ring[data-state="hover"] .ted-cursor-ring-inner{transform:scale(1.55);background:color-mix(in oklab,var(--color-volt) 22%,transparent)}
.ted-cursor-ring[data-state="text"] .ted-cursor-ring-inner{transform:scale(.4);opacity:.5}
.ted-cursor-ring[data-state="label"] .ted-cursor-ring-inner{transform:scale(2.6) rotate(-6deg);background:var(--color-volt);border-color:var(--color-ink);border-radius:2px;box-shadow:2px 2px 0 0 var(--color-ink)}
.ted-cursor-ring[data-down="true"] .ted-cursor-ring-inner{transform:scale(.8)}
.ted-cursor-ring[data-state="label"][data-down="true"] .ted-cursor-ring-inner{transform:scale(2.3) rotate(-6deg)}
.ted-cursor-label,.ted-cursor-jp{display:none;color:var(--color-ink);line-height:1;white-space:nowrap}
.ted-cursor-ring[data-state="label"] .ted-cursor-label{display:block;font:400 7px/1 var(--font-sfx);letter-spacing:.06em}
.ted-cursor-ring[data-state="label"] .ted-cursor-jp{display:block;font:700 3.6px/1.3 var(--font-jp);letter-spacing:.1em;opacity:.75}
`

export default Cursor
