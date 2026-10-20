'use client'
// Header account control (owner: AUTH). Signed out → user icon that opens the login modal.
// Signed in → avatar (photo or initial on volt) with a small manga-panel menu: Account · Orders · Picked for you ·
// Sign out. Closes on outside click, Escape and route change.
import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { LogOut, Package, Sparkles, UserRound } from 'lucide-react'
import { useCustomer } from '@/lib/auth/customer'
import { firstName, initialOf } from '@/lib/auth/shared'
import { cn } from '@/lib/utils'

export function AccountButton({ className }: { className?: string }) {
  const { customer, loading, openLogin, signOut } = useCustomer()
  const [open, setOpen] = useState(false)
  const [imgOk, setImgOk] = useState(true)
  const wrap = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onNav = () => setOpen(false)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('ted:navigate', onNav)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('ted:navigate', onNav)
    }
  }, [open])

  if (!customer) {
    return (
      <button
        type="button"
        className={cn('ted-icon-btn', loading && 'opacity-60', className)}
        aria-label="Log in or create an account"
        title="Log in"
        onClick={() => openLogin()}
      >
        <UserRound aria-hidden="true" className="size-5" />
      </button>
    )
  }

  const items = [
    { href: '/account', label: 'My account', icon: UserRound },
    { href: '/account#orders', label: 'Orders', icon: Package },
    { href: '/account#for-you', label: 'Picked for you', icon: Sparkles },
  ]

  return (
    <div ref={wrap} className={cn('relative', className)}>
      <button
        type="button"
        className="ted-icon-btn"
        aria-label={`Account menu for ${firstName(customer)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="grid size-8 place-items-center overflow-hidden border-2 border-paper bg-volt font-display text-[17px] leading-none text-ink">
          {customer.avatarUrl && imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element -- third-party avatar (Google / MAL), tiny
            <img src={customer.avatarUrl} alt="" width={32} height={32} referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="size-full object-cover" />
          ) : (
            initialOf(customer)
          )}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            aria-label="Account"
            className="absolute right-0 top-[calc(100%+10px)] z-[90] w-60 border-[3px] border-ink bg-paper text-ink shadow-[5px_5px_0_var(--color-door)]"
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)' }}
            exit={{ clipPath: 'inset(0 0 100% 0)', transition: { duration: 0.14 } }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="border-b-[3px] border-ink bg-volt px-3.5 py-2.5">
              <p className="label text-[10px] text-ink/70">Signed in</p>
              <p className="truncate font-display text-[20px] uppercase leading-tight">{customer.name || firstName(customer)}</p>
              {customer.malUsername && <p className="truncate text-[12px] font-bold text-ink/70">MAL · {customer.malUsername}</p>}
            </div>
            <ul className="py-1">
              {items.map((it) => (
                <li key={it.href}>
                  <Link
                    role="menuitem"
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className="focus-ring flex min-h-11 items-center gap-2.5 px-3.5 font-bold transition-colors duration-150 hover:bg-lav"
                  >
                    <it.icon aria-hidden="true" className="size-4" /> {it.label}
                  </Link>
                </li>
              ))}
              <li className="mt-1 border-t-2 border-ink/15">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    void signOut()
                  }}
                  className="focus-ring flex min-h-11 w-full items-center gap-2.5 px-3.5 font-bold transition-colors duration-150 hover:bg-hype hover:text-paper"
                >
                  <LogOut aria-hidden="true" className="size-4" /> Sign out
                </button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AccountButton
