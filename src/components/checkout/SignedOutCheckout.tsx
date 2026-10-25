'use client'
// /checkout when signed out. Login is OPTIONAL (src/lib/auth/policy.ts): guests get the fast checkout straight away —
// name + WhatsApp number, address now or "I'll share it on WhatsApp", optional gift + voucher — and the order is saved
// before WhatsApp opens. Only with NEXT_PUBLIC_LOGIN_REQUIRED=1 does the login wall come back.
import { CheckoutFlow } from './CheckoutFlow'
import { LoginWall } from './LoginWall'
import { LOGIN_ALWAYS_REQUIRED } from '@/lib/auth/policy'

export function SignedOutCheckout({ giftWrapFee }: { giftWrapFee: number }) {
  if (LOGIN_ALWAYS_REQUIRED) return <LoginWall />
  return <CheckoutFlow mode="guest" initialAddresses={[]} giftWrapFee={giftWrapFee} />
}
