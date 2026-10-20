// /account/reset-password — set a new password after a recovery email (owner: AUTH).
// /auth/callback?flow=recovery signs the shopper in first; this page just sets the new password.
import type { Metadata } from 'next'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export const metadata: Metadata = {
  title: 'Set a new password',
  alternates: { canonical: '/account/reset-password' },
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return (
    <div className="container-x grid items-start gap-10 py-10 md:py-16 lg:grid-cols-[1fr_minmax(0,480px)] lg:gap-16">
      <div className="max-w-xl">
        <p className="label text-[11px] text-volt">Account · new key</p>
        <h1 className="h-display mt-3 text-[clamp(52px,8vw,120px)]">
          New <em>password</em>
        </h1>
        <p lang="ja" className="jp-sub mt-3 text-[13px]">
          パスワード再設定
        </p>
        <p className="mt-6 text-paper/85">Pick a new password (8+ characters). You’ll stay signed in on this device.</p>
      </div>
      <div className="border-4 border-ink bg-paper p-5 text-ink shadow-[8px_8px_0_var(--color-door)] sm:p-7">
        <ResetPasswordForm />
      </div>
    </div>
  )
}
