'use client'
// ArcThemeSetter — recolours the page (--arc-a / --arc-b) for one arc while mounted (owner: P1 shop).
// Providers resets the theme on every route change; we re-apply after that reset ('ted:navigate')
// and reset to the brand default on unmount.
import { useEffect } from 'react'
import { useArcTheme } from '@/components/Providers'

export function ArcThemeSetter({ slug }: { slug: string }) {
  const { set } = useArcTheme()
  useEffect(() => {
    set(slug)
    const again = () => set(slug)
    const raf = requestAnimationFrame(again)
    window.addEventListener('ted:navigate', again)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('ted:navigate', again)
      set(null)
    }
  }, [slug, set])
  return null
}

export default ArcThemeSetter
