'use client'
// /checkout when signed out. Owner rule: login is mandatory to order once a login method works; until then (GET
// /api/auth/providers → any:false) guests get the SAME full checkout — contact, address, gift, voucher, review —
// and the order is saved before WhatsApp opens. While the providers answer is in flight: the checkout skeleton.
import { useAuthProviders } from '@/lib/auth/providers'
import { CheckoutFlow } from './CheckoutFlow'
import { LoginWall } from './LoginWall'
import { LOGIN_ALWAYS_REQUIRED, loginGateOn } from '@/lib/auth/policy'

export function SignedOutCheckout({ giftWrapFee }: { giftWrapFee: number }) {
  const providers = useAuthProviders()
  if (LOGIN_ALWAYS_REQUIRED) return <LoginWall />
  if (!providers) {
    return (
      <div className="grid gap-6 lg:grid-cols-12" aria-busy="true">
        <span className="sr-only">Opening the order desk…</span>
        <div className="flex flex-col gap-4 lg:col-span-7">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-tone h-24 w-full" />
          ))}
        </div>
        <div className="skeleton-tone hidden h-80 w-full lg:col-span-5 lg:block" />
      </div>
    )
  }
  if (loginGateOn(providers)) return <LoginWall />
  return <CheckoutFlow mode="guest" initialAddresses={[]} giftWrapFee={giftWrapFee} />
}
