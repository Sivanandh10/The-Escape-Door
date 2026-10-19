'use client'
// #53 manga ink-streak between routes — a pure accent that NEVER delays or covers navigation. Owner: F1.
//
// Why not React <ViewTransition> any more: a view transition freezes the page into snapshots and React holds
// the commit until the new tree's images load (up to ~800 ms), so clicks felt slow and could flash blank.
// Now: src/app/template.tsx remounts this on every navigation; after the new page (or its loading.tsx
// skeleton) has committed, a narrow screentone ink strip with volt/door edges streaks right → left in 240 ms
// over the already-visible page. First load: nothing. Reduced motion: nothing. pointer-events: none.
import { useEffect, useRef, useState } from 'react'

let firstInstance: object | null = null

export function PageTransition() {
  const token = useRef({})
  const [play, setPlay] = useState(false)

  useEffect(() => {
    if (firstInstance === null) {
      firstInstance = token.current
      return
    }
    if (firstInstance === token.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setPlay(true)
  }, [])

  if (!play) return null
  return (
    <div aria-hidden="true" className="ted-ink-streak" onAnimationEnd={() => setPlay(false)}>
      <style>{STREAK_CSS}</style>
    </div>
  )
}

const STREAK_CSS = `
.ted-ink-streak{position:fixed;top:0;bottom:0;left:0;width:16vw;min-width:90px;z-index:90;pointer-events:none;
  background-color:var(--color-ink);
  background-image:radial-gradient(circle at center,var(--color-tone-2) 30%,transparent 34%);background-size:7px 7px;
  box-shadow:-8px 0 0 0 var(--color-volt),-12px 0 0 0 var(--color-ink),8px 0 0 0 var(--color-door),12px 0 0 0 var(--color-ink);
  will-change:transform;animation:ted-ink-streak 240ms cubic-bezier(0.65,0,0.35,1) both}
@keyframes ted-ink-streak{from{transform:translateX(calc(100vw + 40px)) skewX(-12deg)}to{transform:translateX(calc(-16vw - 140px)) skewX(-12deg)}}
@media (prefers-reduced-motion: reduce){.ted-ink-streak{display:none}}
`

export default PageTransition
