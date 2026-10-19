'use client'
// Mobile menu: full-screen manga-panel sheet with staggered chapter links and Kado peeking. Owner: F1.
// Dialog semantics (role=dialog, aria-modal), focus trap, Escape, scroll lock (Lenis stop), restores focus.
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X, ArrowUpRight } from 'lucide-react'
import { Mascot } from '@/components/brand/Mascot'
import { SPRING, useIsClient } from '@/lib/motion'
import { MAIN_NAV, INSTAGRAM_URL, INSTAGRAM_HANDLE, type NavArc } from './nav'

export interface MobileMenuProps {
  open: boolean
  onClose: () => void
  arcs: NavArc[]
}

const SHEET_EASE = [0.65, 0, 0.35, 1] as const

export function MobileMenu({ open, onClose, arcs }: MobileMenuProps) {
  const panel = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const mounted = useIsClient()

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    window.__lenis?.stop()
    document.documentElement.style.overflow = 'hidden'
    requestAnimationFrame(() => {
      closeBtn.current?.focus()
      // aria-current for the sheet's links (they mount after RouteEffects ran)
      const path = window.location.pathname
      panel.current?.querySelectorAll<HTMLAnchorElement>('a[data-nav]').forEach((a) => {
        const href = a.getAttribute('href') || ''
        if (path === href || path.startsWith(href + '/')) a.setAttribute('aria-current', 'page')
      })
    })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !panel.current) return
      const f = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = ''
      window.__lenis?.start()
      prev?.focus?.()
    }
  }, [open, onClose])

  if (!mounted) return null
  const links = MAIN_NAV.filter((n) => !('mega' in n && n.mega))

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-menu"
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-[150] overflow-y-auto bg-ink lg:hidden"
          data-lenis-prevent=""
          initial={{ clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)' }}
          animate={{ clipPath: 'polygon(-20% 0, 100% 0, 100% 100%, 0% 100%)' }}
          exit={{ clipPath: 'polygon(100% 0, 100% 0, 120% 100%, 100% 100%)', transition: { duration: 0.28, ease: SHEET_EASE } }}
          transition={{ duration: 0.42, ease: SHEET_EASE }}
        >
          <div className="relative flex min-h-full flex-col p-3">
            {/* the manga page */}
            <div className="relative flex flex-1 flex-col overflow-hidden border-4 border-ink bg-paper text-ink shadow-hard-volt grain">
              <div className="flex items-center justify-between border-b-4 border-ink px-4 py-3">
                <span className="label">Contents · 目次</span>
                <button
                  ref={closeBtn}
                  type="button"
                  onClick={onClose}
                  className="press flex size-11 items-center justify-center border-[3px] border-ink bg-volt shadow-hard-sm"
                  aria-label="Close menu"
                >
                  <X aria-hidden="true" className="size-6" />
                </button>
              </div>

              <nav aria-label="Mobile" className="px-4 pt-4">
                <ul className="divide-y-[3px] divide-ink border-b-[3px] border-ink">
                  {links.map((item, i) => (
                    <motion.li
                      key={item.href}
                      initial={{ x: 60, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ ...SPRING, delay: 0.12 + i * 0.05 }}
                    >
                      <Link href={item.href} data-nav="" onClick={onClose} className="ted-mm-link group">
                        <span className="label w-8 text-tone-3">{String(i + 1).padStart(2, '0')}</span>
                        <span className="flex-1 font-display text-[44px] uppercase leading-[0.95] xs:text-[52px]">{item.label}</span>
                        <span lang="ja" className="jp-sub hidden text-[11px] xs:block">
                          {item.jp}
                        </span>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </nav>

              <motion.div
                className="px-4 pb-40 pt-5"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING, delay: 0.38 }}
              >
                <p className="label text-tone-3">Pick your arc · アーク</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {arcs.map((a) => (
                    <li key={a.slug}>
                      <Link
                        href={`/arc/${a.slug}`}
                        onClick={onClose}
                        className="press inline-flex min-h-11 items-center gap-2 border-[3px] border-ink bg-paper px-3 py-2 text-[14px] font-bold shadow-hard-sm"
                      >
                        <span aria-hidden="true" className="block size-3 border-2 border-ink" style={{ background: a.accentA }} />
                        {a.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/wishlist" onClick={onClose} className="label inline-flex min-h-11 items-center underline decoration-2 underline-offset-4">
                    Wishlist
                  </Link>
                  <a
                    href={INSTAGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="label inline-flex min-h-11 items-center gap-1 underline decoration-2 underline-offset-4"
                  >
                    Instagram {INSTAGRAM_HANDLE}
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </a>
                </div>
              </motion.div>

              {/* Kado peeks from the bottom-right corner */}
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-6 right-2 w-32"
                initial={{ y: 120, rotate: 8 }}
                animate={{ y: 0, rotate: -6 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.45 }}
              >
                <Mascot mood="peek" title="" animate />
              </motion.div>
              <span aria-hidden="true" className="sfx font-sfx-jp pointer-events-none absolute bottom-24 left-4 text-[44px]" style={{ ['--sfx-rot' as string]: '-10deg' }}>
                ガチャ
              </span>
            </div>
          </div>
          <style>{`@layer components{.ted-mm-link{display:flex;align-items:center;gap:12px;padding:14px 0;min-height:64px;transition:background-color 180ms,padding 260ms var(--ease-expo)}
.ted-mm-link:active{background:var(--color-volt);padding-left:10px}
.ted-mm-link[aria-current="page"]{background:var(--color-volt);padding-left:10px}}`}</style>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default MobileMenu
