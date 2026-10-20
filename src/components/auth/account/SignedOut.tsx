'use client'
// /account helpers (owner: AUTH): the signed-out state (inline login panel; the page refreshes itself on login)
// and the Sign out button.
import { LogOut } from 'lucide-react'
import { useCustomer } from '@/lib/auth/customer'
import { LoginPanel } from '../LoginPanel'

export function SignedOutAccount() {
  return (
    <div className="container-x grid items-start gap-10 py-10 md:py-16 lg:grid-cols-[1fr_minmax(0,480px)] lg:gap-16">
      <div className="max-w-xl">
        <p className="label text-[11px] text-volt">Your room · locked</p>
        <h1 className="h-display mt-3 text-[clamp(56px,9vw,128px)]">
          Your <em>account</em>
        </h1>
        <p lang="ja" className="jp-sub relative z-[1] mt-5 text-[13px] lg:mt-8">
          マイページ
        </p>
        <p className="mt-6 text-paper/85">Log in to see your orders, saved addresses, recently viewed drops and picks matched to the anime you watch.</p>
      </div>
      <div className="border-4 border-ink bg-paper text-ink shadow-[8px_8px_0_var(--color-door)]">
        <LoginPanel reason="Log in to open your account" next="/account" />
      </div>
    </div>
  )
}

export function SignOutButton() {
  const { signOut } = useCustomer()
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="press focus-ring inline-flex min-h-11 items-center gap-2 border-[3px] border-paper/40 px-4 font-bold text-paper hover:border-hype hover:bg-hype"
    >
      <LogOut aria-hidden="true" className="size-4" /> Sign out
    </button>
  )
}
