'use client'
// Login modal (owner: AUTH) — opened by useCustomer().openLogin / useRequireLogin(). Lazy-loaded by CustomerProvider.
// The panel swings in like a door on its hinge (spring, 300 ms feel); reduced motion → a plain fade.
// Focus is trapped, Escape / backdrop / ✕ close it, Lenis pauses while open, focus returns to the trigger.
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useReducedMotion } from '@/lib/motion'
import { LoginPanel } from './LoginPanel'

export interface LoginModalProps {
  open: boolean
  reason?: string
  success?: boolean
  onClose: () => void
  onBeforeRedirect?: () => void
}

export function LoginModal({ open, reason, success, onClose, onBeforeRedirect }: LoginModalProps) {
  const reduced = useReducedMotion()
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const lastFocus = useRef<Element | null>(null)
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client mount flag for the portal
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    lastFocus.current = document.activeElement
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis
    lenis?.stop()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => {
      panel.current?.querySelector<HTMLElement>('button, input')?.focus()
    }, 80)
    return () => {
      window.clearTimeout(t)
      document.body.style.overflow = prev
      lenis?.start()
      if (lastFocus.current instanceof HTMLElement && document.contains(lastFocus.current)) lastFocus.current.focus()
    }
  }, [open])

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panel.current) return
    const f = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')
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

  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6" onKeyDown={onKey}>
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-ink/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={onClose}
          >
            <div className="screentone screentone-dense absolute inset-0 text-door [--tone-opacity:0.2]" />
          </motion.div>
          <div className="relative w-full max-w-[480px] [perspective:1600px]">
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              data-lenis-prevent=""
              className="relative max-h-[92dvh] overflow-y-auto overscroll-contain border-4 border-ink bg-paper text-ink shadow-[8px_8px_0_var(--color-door)] sm:max-h-[88dvh]"
              style={{ transformOrigin: '0% 50%' }}
              initial={reduced ? { opacity: 0 } : { rotateY: -72, opacity: 0.3, x: -24 }}
              animate={reduced ? { opacity: 1 } : { rotateY: 0, opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { rotateY: -60, opacity: 0, x: -20, transition: { duration: 0.2 } }}
              transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 260, damping: 26 }}
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="Close login"
                className="press focus-ring absolute right-3 top-3 z-[2] grid size-11 place-items-center border-[3px] border-ink bg-paper text-ink shadow-hard-sm"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
              <LoginPanel reason={reason} success={success} onBeforeRedirect={onBeforeRedirect} titleId={titleId} />
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default LoginModal
