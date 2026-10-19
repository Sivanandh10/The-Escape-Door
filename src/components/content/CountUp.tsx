'use client'
// #17 counter: SSR renders the real number (crawlable, no-JS safe); on the client, a number still below
// the fold resets to 0 and counts up (expo-out, 1.1 s) when it scrolls in. Reduced motion: static.
// Owner: P5.
import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

export function CountUp({ value, suffix = '', className }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const fmt = (n: number) => `${Math.round(n).toLocaleString('en-IN')}${suffix}`
    if (el.getBoundingClientRect().top < window.innerHeight) return
    el.textContent = fmt(0)
    let raf = 0
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        const t0 = performance.now()
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / 1100)
          el.textContent = fmt(value * (1 - Math.pow(2, -10 * p)))
          if (p < 1) raf = requestAnimationFrame(tick)
          else el.textContent = fmt(value)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      el.textContent = fmt(value)
    }
  }, [value, suffix])

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString('en-IN')}
      {suffix}
    </span>
  )
}

export default CountUp
