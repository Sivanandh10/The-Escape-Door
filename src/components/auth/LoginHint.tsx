'use client'
// Subtle, dismissible "log in for extras" hint (owner: COMMERCE / AUTH). Login is OPTIONAL (policy.ts): this never
// blocks anything — it only offers the upgrade. Shown when: signed out, Supabase is configured and at least one login
// method works right now (GET /api/auth/providers). "Not now" hides it for 14 days in this browser (per-viewer
// convenience in localStorage; blocked storage just means it shows again next visit). Renders nothing on the server.
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Sparkles, X } from 'lucide-react'
import { useCustomer } from '@/lib/auth/customer'
import { useAuthProviders } from '@/lib/auth/providers'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const KEY = 'ted-login-hint-hidden'
const HIDE_FOR = 14 * 24 * 60 * 60_000

function hiddenNow(): boolean {
  try {
    const at = Number(window.localStorage.getItem(KEY) ?? 0)
    return Number.isFinite(at) && at > 0 && Date.now() - at < HIDE_FOR
  } catch {
    return false
  }
}

export interface LoginHintProps {
  /** drawer = on paper (cart drawer / cart page) · dark = on the ink success page */
  tone?: 'paper' | 'dark'
  /** analytics-free label of where it sits (also keeps two hints on one page independent in tests) */
  where: 'drawer' | 'cart' | 'success'
  className?: string
}

export function LoginHint({ tone = 'paper', where, className }: LoginHintProps) {
  const { customer, loading, openLogin } = useCustomer()
  const providers = useAuthProviders()
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    // localStorage is client-only: decide after mount so the server HTML stays identical
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser storage
    setHidden(hiddenNow())
  }, [])

  const show = isSupabaseConfigured() && !loading && !customer && !!providers?.any && !hidden
  const dismiss = () => {
    setHidden(true)
    try {
      window.localStorage.setItem(KEY, String(Date.now()))
    } catch {
      /* storage blocked: hidden for this page view only */
    }
  }

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="hint"
          data-login-hint={where}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'flex items-start gap-2 border-2 border-dashed px-3 py-2 text-[12.5px] leading-snug',
            tone === 'dark' ? 'border-paper/50 text-paper/85' : 'border-ink/45 bg-lav/40 text-ink',
            className,
          )}
        >
          <Sparkles aria-hidden="true" className={cn('mt-0.5 size-3.5 shrink-0', tone === 'dark' ? 'text-volt' : 'text-door')} />
          <p className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => openLogin('Log in to save your cart, track orders and get anime picks')}
              className="font-bold underline decoration-2 underline-offset-2 focus-ring"
            >
              Log in
            </button>{' '}
            to save your cart, track orders and get anime picks. Optional — you can order as a guest.
          </p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Hide this tip"
            className={cn('-my-2 -mr-2 grid size-11 shrink-0 place-items-center focus-ring', tone === 'dark' ? 'text-paper/70 hover:text-paper' : 'text-ink/60 hover:text-ink')}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default LoginHint
