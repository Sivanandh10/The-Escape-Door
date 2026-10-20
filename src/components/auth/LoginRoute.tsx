'use client'
// /login client part (owner: AUTH): reads ?next / ?error / ?mode, shows the LoginPanel, and leaves for `next`
// as soon as a session exists (in-page login, or already signed in).
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCustomer } from '@/lib/auth/customer'
import { safeNext } from '@/lib/auth/shared'
import { LoginPanel } from './LoginPanel'

export function LoginRoute() {
  const params = useSearchParams()
  const router = useRouter()
  const { customer } = useCustomer()
  const next = safeNext(params.get('next'), '/account')
  const error = params.get('error')
  const mode = params.get('mode') === 'signup' ? 'signup' : 'signin'

  useEffect(() => {
    if (customer) router.replace(next)
  }, [customer, next, router])

  return <LoginPanel reason={mode === 'signup' ? 'Make your account' : 'Log in or sign up'} next={next} errorCode={error} success={!!customer} initialMode={mode} />
}

export default LoginRoute
