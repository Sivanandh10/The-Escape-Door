'use client'
// S01 — decides whether the WebGL door may mount (DESIGN §7b gate) and mounts it after idle.
// Owner: S01. Gate: ≥1024px, fine pointer, no reduced motion, deviceMemory ≥ 4 (or unknown), WebGL available.
// The CSS door stays the first paint (and the LCP never depends on the canvas); when the first WebGL frame
// renders, the portal host gets data-3d="on" and the CSS door hides. Any failure → stays CSS.
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const DoorPortal3D = dynamic(() => import('./DoorPortal3D'), { ssr: false, loading: () => null })

const GATE_MQ = '(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

function capable(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia(GATE_MQ).matches) return false
  if (new URLSearchParams(location.search).has('no3d')) return false
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (typeof mem === 'number' && mem < 4) return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function Portal3DGate() {
  const host = useRef<HTMLDivElement>(null)
  const [mount, setMount] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!capable()) return
    let cancelled = false
    let idleId = 0
    const go = () => {
      if (cancelled) return
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
      if (w.requestIdleCallback) idleId = w.requestIdleCallback(() => !cancelled && setMount(true), { timeout: 2500 })
      else idleId = window.setTimeout(() => !cancelled && setMount(true), 900)
    }
    // after first paint + load (and after the preloader, which delays 'load' anyway)
    if (document.readyState === 'complete') go()
    else window.addEventListener('load', go, { once: true })
    const mq = window.matchMedia(GATE_MQ)
    const onChange = () => {
      if (!mq.matches) {
        setMount(false)
        setShown(false)
      }
    }
    mq.addEventListener('change', onChange)
    return () => {
      cancelled = true
      window.removeEventListener('load', go)
      mq.removeEventListener('change', onChange)
      const w = window as Window & { cancelIdleCallback?: (id: number) => void }
      w.cancelIdleCallback?.(idleId)
      clearTimeout(idleId)
    }
  }, [])

  // flag the portal panel so the CSS door hides only once WebGL is actually painting
  useEffect(() => {
    const panel = host.current?.closest<HTMLElement>('[data-portal]')
    if (!panel) return
    panel.dataset['3d'] = shown ? 'on' : 'off'
  }, [shown])

  return (
    <div
      ref={host}
      aria-hidden="true"
      className="absolute inset-0 transition-opacity duration-500 ease-[var(--ease-expo)]"
      style={{ opacity: shown ? 1 : 0 }}
    >
      {mount && (
        <DoorPortal3D
          onReady={() => setShown(true)}
          onFail={() => {
            setShown(false)
            setMount(false)
          }}
        />
      )}
    </div>
  )
}

export default Portal3DGate
