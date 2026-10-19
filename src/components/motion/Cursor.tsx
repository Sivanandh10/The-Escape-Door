'use client'
// #31 custom cursor — a small accent, never a cover. Owner: F1.
// Fine pointers only: nothing renders on touch or under reduced motion, and the native cursor is never hidden there.
// - 8 px volt dot + 26 px hollow ring (1.5 px), both mix-blend-mode: difference so text underneath stays readable.
// - Native cursor is hidden only over plain content; links/buttons keep the native pointer (ring is the accent).
// - [data-cursor] labels render as a tiny mono pill offset to the bottom-right of the pointer, never centred on content.
// - Hidden entirely over inputs, textareas, selects, contenteditable and on /admin (native cursor shown).
// Per frame: transform writes only, no layout reads.
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { registerGsap, useFinePointer, useIsTouch, useReducedMotion } from '@/lib/motion'

const JP: Record<string, string> = { OPEN: '開く', ADD: '追加', VIEW: '見る', DRAG: 'ドラッグ', PLAY: '再生' }
const INTERACTIVE = 'a, button, [role="button"], label, summary, [data-cursor]'
const FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
const isAdmin = () => window.location.pathname.startsWith('/admin')

export function Cursor() {
  const touch = useIsTouch()
  const reduced = useReducedMotion()
  const fine = useFinePointer()
  const enabled = fine && !touch && !reduced
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const jpRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!enabled || !dot.current || !ring.current || !pill.current) return
    registerGsap()
    const root = document.documentElement
    const d = dot.current
    const r = ring.current
    const p = pill.current
    const xTo = gsap.quickTo(r, 'x', { duration: 0.18, ease: 'power3' })
    const yTo = gsap.quickTo(r, 'y', { duration: 0.18, ease: 'power3' })
    let shown = false
    let hidden = false
    let state = ''

    const setVisible = (v: boolean) => {
      d.dataset.visible = r.dataset.visible = String(v)
      p.dataset.visible = String(v && state === 'label')
    }
    const setHidden = (h: boolean) => {
      if (h === hidden) return
      hidden = h
      root.classList.toggle('has-cursor', shown && !h)
      setVisible(shown && !h)
    }
    const setState = (next: string, label = '', jp = '') => {
      if (next === state && labelRef.current?.textContent === label) return
      state = next
      r.dataset.state = d.dataset.state = next
      if (labelRef.current) labelRef.current.textContent = label
      if (jpRef.current) jpRef.current.textContent = jp
      p.dataset.visible = String(shown && !hidden && next === 'label')
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const x = e.clientX
      const y = e.clientY
      d.style.transform = `translate3d(${x}px, ${y}px, 0)`
      p.style.transform = `translate3d(${x + 14}px, ${y + 16}px, 0)`
      xTo(x)
      yTo(y)
      if (!shown) {
        shown = true
        if (isAdmin()) hidden = true
        gsap.set(r, { x, y })
        root.classList.toggle('has-cursor', !hidden)
        setVisible(!hidden)
      }
    }
    // state lookup on pointerover (delegated; once per element change, not per frame)
    const onOver = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      const t = e.target as Element | null
      if (isAdmin() || t?.closest(FIELD)) {
        setHidden(true)
        return
      }
      setHidden(false)
      const labelled = t?.closest<HTMLElement>('[data-cursor]')
      if (labelled) {
        const label = (labelled.dataset.cursor || '').toUpperCase().slice(0, 10)
        return setState('label', label, labelled.dataset.cursorJp ?? JP[label] ?? '')
      }
      if (t?.closest(INTERACTIVE)) return setState('hover')
      setState('')
    }
    const onDown = () => {
      r.dataset.down = 'true'
    }
    const onUp = () => {
      delete r.dataset.down
    }
    const onLeave = () => {
      shown = false
      setVisible(false)
      root.classList.remove('has-cursor')
    }
    const onNavigate = () => setHidden(isAdmin())

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerover', onOver, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('ted:navigate', onNavigate)
    root.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerover', onOver)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('ted:navigate', onNavigate)
      root.removeEventListener('pointerleave', onLeave)
      root.classList.remove('has-cursor')
    }
  }, [enabled])

  if (!enabled) return null
  return (
    <>
      <div aria-hidden="true" className="ted-cursor pointer-events-none fixed inset-0 z-[200]">
        <div ref={ring} className="ted-cursor-ring" data-visible="false">
          <div className="ted-cursor-ring-inner" />
        </div>
        <div ref={dot} className="ted-cursor-dot" data-visible="false" />
      </div>
      <div ref={pill} aria-hidden="true" className="ted-cursor-pill pointer-events-none" data-visible="false">
        <span ref={labelRef} className="ted-cursor-label" />
        <span ref={jpRef} className="ted-cursor-jp" lang="ja" />
      </div>
      <style>{CURSOR_CSS}</style>
    </>
  )
}

const CURSOR_CSS = `
.ted-cursor{mix-blend-mode:difference}
.ted-cursor-dot,.ted-cursor-ring,.ted-cursor-pill{position:fixed;left:0;top:0;will-change:transform;opacity:0;transition:opacity 150ms var(--ease-hover)}
.ted-cursor-dot[data-visible="true"],.ted-cursor-ring[data-visible="true"],.ted-cursor-pill[data-visible="true"]{opacity:1}
.ted-cursor-dot{width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:var(--color-volt)}
.ted-cursor-dot[data-visible="true"][data-state="hover"]{opacity:0}
.ted-cursor-ring{width:0;height:0}
.ted-cursor-ring-inner{position:absolute;left:-13px;top:-13px;width:26px;height:26px;border-radius:50%;
  border:1.5px solid var(--color-volt);transition:transform 180ms var(--ease-hover),opacity 150ms var(--ease-hover)}
.ted-cursor-ring[data-state="hover"] .ted-cursor-ring-inner{transform:scale(1.3)}
.ted-cursor-ring[data-state="label"] .ted-cursor-ring-inner{transform:scale(.7);opacity:.7}
.ted-cursor-ring[data-down="true"] .ted-cursor-ring-inner{transform:scale(.75)}
.ted-cursor-pill{z-index:201;display:flex;align-items:baseline;gap:4px;padding:3px 7px;border-radius:999px;
  background:var(--color-volt);color:var(--color-ink);border:1px solid var(--color-ink);box-shadow:1px 1px 0 0 var(--color-ink);
  white-space:nowrap;line-height:1}
.ted-cursor-label{font:600 10px/1 var(--font-mono);letter-spacing:.08em}
.ted-cursor-jp{font:700 9px/1 var(--font-jp);opacity:.7}
.ted-cursor-jp:empty{display:none}
`

export default Cursor
