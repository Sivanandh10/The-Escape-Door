// /admin/login (P4a) — owner sign-in. useSearchParams lives in a client child inside <Suspense>.
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginForm } from '@/components/admin/LoginForm'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink" />}>
      <LoginForm demo={!isSupabaseConfigured()} />
    </Suspense>
  )
}
