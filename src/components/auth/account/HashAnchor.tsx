'use client'
// <HashAnchor ids /> — lands /account#for-you (header menu "Picked for you"), #orders … on the right section.
// Owner: AUTH. Why: /account streams behind <Suspense> (cookie-bound), so the router's hash scroll runs while only the
// skeleton exists and the page stays at the top (profile + address settings) — the picks only showed after a manual
// scroll. And the sections above (address book, orders, MyAnimeList, the picks themselves) load on the client and
// change height after any first jump. This scrolls to the section once it's in the DOM and keeps it anchored while
// the content above settles (≤ 3 s), stopping the moment the shopper scrolls / taps / presses a key themselves.
// Same-page hash links (/account#orders while already on /account) are handled too. Renders nothing.
import { useEffect } from 'react'

type LenisLike = { scrollTo: (target: number, opts?: { immediate?: boolean; force?: boolean }) => void; resize?: () => void }
const lenis = () => (window as unknown as { __lenis?: LenisLike }).__lenis

function topOffset(): number {
  const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72
  const nav = document.querySelector<HTMLElement>('[data-account-nav]')?.offsetHeight ?? 0
  return header + nav + 16
}

export function HashAnchor({ ids }: { ids: string[] }) {
  const key = ids.join(',')
  useEffect(() => {
    const allowed = new Set(key.split(','))
    let cleanup: (() => void) | null = null

    const anchor = () => {
      cleanup?.()
      cleanup = null
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!id || !allowed.has(id)) return
      const el = document.getElementById(id)
      if (!el) return
      let stopped = false
      const settle = () => {
        if (stopped) return
        const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - topOffset())
        if (Math.abs(window.scrollY - y) < 2) return
        const l = lenis()
        l?.resize?.()
        if (l) l.scrollTo(y, { immediate: true, force: true })
        else window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior })
      }
      const ro = new ResizeObserver(settle)
      const stop = () => {
        if (stopped) return
        stopped = true
        ro.disconnect()
        window.clearTimeout(timer)
        window.removeEventListener('wheel', stop)
        window.removeEventListener('touchstart', stop)
        window.removeEventListener('keydown', stop)
      }
      // two frames: let the streamed section lay out first
      requestAnimationFrame(() => requestAnimationFrame(settle))
      ro.observe(document.body)
      const timer = window.setTimeout(stop, 3000)
      window.addEventListener('wheel', stop, { passive: true })
      window.addEventListener('touchstart', stop, { passive: true })
      window.addEventListener('keydown', stop)
      cleanup = stop
    }

    anchor()
    // same-page links: Next pushes the new hash with history.pushState (no hashchange) → watch clicks on #links
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href*="#"]') as HTMLAnchorElement | null
      // bare "#…" links (the sticky section nav) are smooth-scrolled by Lenis' anchors option — leave them be
      if (!a || a.target === '_blank' || a.getAttribute('href')?.startsWith('#')) return
      let url: URL
      try {
        url = new URL(a.href, window.location.href)
      } catch {
        return
      }
      if (url.pathname !== window.location.pathname || !allowed.has(decodeURIComponent(url.hash.slice(1)))) return
      window.setTimeout(anchor, 0)
    }
    window.addEventListener('hashchange', anchor)
    document.addEventListener('click', onClick)
    return () => {
      cleanup?.()
      window.removeEventListener('hashchange', anchor)
      document.removeEventListener('click', onClick)
    }
  }, [key])
  return null
}

export default HashAnchor
