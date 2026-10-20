// /login — customer login page (owner: AUTH). Landing spot for auth callback errors, "log in" deep links and
// visitors without JS for the modal. Static shell; the panel reads ?next / ?error on the client.
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginRoute } from '@/components/auth/LoginRoute'

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to The Escape Door with Google, MyAnimeList or email to order, save your wishlist and get picks for the anime you watch.',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: true },
}

export default function LoginPage() {
  return (
    <div className="relative overflow-hidden">
      <p
        aria-hidden="true"
        className="outline-text pointer-events-none absolute -left-6 top-4 select-none whitespace-nowrap font-display text-[clamp(120px,24vw,340px)] uppercase leading-none opacity-[0.12] [--stroke-w:1.5px]"
      >
        Open the door
      </p>
      <div className="container-x relative grid items-start gap-10 py-10 md:py-16 lg:grid-cols-[1fr_minmax(0,480px)] lg:gap-16">
        <div className="max-w-xl">
          <p className="label text-[11px] text-volt">Members · Chapter 00</p>
          <h1 className="h-display mt-3 text-[clamp(56px,9vw,128px)]">
            Step through the <em>door</em>
          </h1>
          <p lang="ja" className="jp-sub mt-3 text-[13px]">
            ログイン
          </p>
          <ul className="mt-8 grid gap-3 text-paper/85">
            <li className="flex gap-3"><span aria-hidden="true" className="mt-1.5 size-3 shrink-0 border-2 border-paper bg-volt" />Order, track your orders and save addresses for checkout.</li>
            <li className="flex gap-3"><span aria-hidden="true" className="mt-1.5 size-3 shrink-0 border-2 border-paper bg-lav" />Keep your wishlist and recently viewed on every device.</li>
            <li className="flex gap-3"><span aria-hidden="true" className="mt-1.5 size-3 shrink-0 border-2 border-paper bg-pink" />Link MyAnimeList and get drops matched to the shows you watch.</li>
          </ul>
        </div>
        <div className="border-4 border-ink bg-paper text-ink shadow-[8px_8px_0_var(--color-door)]">
          <Suspense fallback={<div aria-hidden="true" className="skeleton-tone h-[560px]" />}>
            <LoginRoute />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
