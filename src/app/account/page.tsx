// /account — the shopper's room (owner: AUTH): profile, saved addresses (CHECKOUT's AddressBook), orders,
// MyAnimeList link + import, recently viewed and picks. Cookie-bound → everything inside <Suspense>; the shell is static.
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getAuthUser, getCustomer } from '@/lib/auth/customer-server'
import { isSyntheticEmail } from '@/lib/auth/shared'
import { loadMal } from '@/lib/recs/server'
import { getMyOrders } from '@/lib/checkout/orders-server'
import { AddressBook } from '@/components/checkout/AddressBook'
import { ForYou } from '@/components/recs/ForYou'
import { ProfileForm } from '@/components/auth/account/ProfileForm'
import { MalPanel, type MalPanelData } from '@/components/auth/account/MalPanel'
import { OrdersList } from '@/components/auth/account/OrdersList'
import { SignedOutAccount, SignOutButton } from '@/components/auth/account/SignedOut'
import type { MalAnime } from '@/lib/recs/types'

export const metadata: Metadata = {
  title: 'Your account',
  description: 'Your Escape Door account: orders, saved addresses, wishlist picks and MyAnimeList link.',
  alternates: { canonical: '/account' },
  robots: { index: false, follow: false },
}

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountContent />
    </Suspense>
  )
}

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'orders', label: 'Orders' },
  { id: 'myanimelist', label: 'MyAnimeList' },
  { id: 'for-you', label: 'For you' },
]

function topAnime(list: MalAnime[]): MalAnime[] {
  const rank = (a: MalAnime) => (a.status === 'watching' ? 20 : 0) + a.score * 2 + (a.status === 'completed' ? 3 : 0)
  return [...list].filter((a) => a.status !== 'dropped' && a.status !== 'plan_to_watch').sort((a, b) => rank(b) - rank(a)).slice(0, 8)
}

async function AccountContent() {
  const auth = await getAuthUser()
  if (!auth) return <SignedOutAccount />
  const [customer, orders, mal] = await Promise.all([getCustomer(), getMyOrders(50), loadMal(auth.sb, auth.user.id)])
  if (!customer) return <SignedOutAccount />

  const synthetic = isSyntheticEmail(customer.email)
  const malData: MalPanelData | null = mal
    ? {
        username: mal.mal_username,
        picture: mal.picture,
        syncedAt: mal.synced_at,
        stats: mal.stats,
        top: topAnime(Array.isArray(mal.anime_snapshot) ? mal.anime_snapshot : []),
      }
    : null
  const first = (customer.name ?? '').split(/\s+/)[0] || (synthetic ? customer.malUsername : customer.email.split('@')[0]) || 'friend'
  const joined = auth.user.created_at ? new Date(auth.user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : null

  return (
    <div className="relative overflow-hidden pb-24">
      <header className="relative border-b-4 border-paper/10 pb-8 pt-10 md:pb-12 md:pt-16">
        <p
          aria-hidden="true"
          className="outline-text pointer-events-none absolute -right-4 top-2 select-none whitespace-nowrap font-display text-[clamp(120px,22vw,320px)] uppercase leading-none opacity-[0.14] [--stroke-w:1.5px]"
        >
          Member
        </p>
        <div className="container-x relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="label text-[11px] text-volt">Your room{joined ? ` · member since ${joined}` : ''}</p>
            <h1 className="h-display mt-3 text-[clamp(56px,9vw,132px)]">
              Hey, <em>{first}</em>
            </h1>
            <p lang="ja" className="jp-sub mt-3 text-[13px]">
              マイページ
            </p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <nav aria-label="Account sections" className="sticky top-[var(--header-h)] z-[5] border-b-4 border-ink bg-ink/95">
        <ul className="container-x flex gap-2 overflow-x-auto py-3 [scrollbar-width:none]">
          {SECTIONS.map((s) => (
            <li key={s.id} className="shrink-0">
              <a href={`#${s.id}`} className="focus-ring label inline-flex min-h-11 items-center border-[3px] border-paper/25 px-3.5 text-[11px] text-paper hover:border-volt hover:text-volt">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="container-x mt-12 grid gap-16">
        <section id="profile" aria-labelledby="profile-h" className="scroll-mt-40">
          <SectionTitle id="profile-h" before="Your " accent="details" jp="プロフィール" />
          <ProfileForm initial={{ name: customer.name ?? '', phone: customer.phone ?? '' }} email={customer.email} synthetic={synthetic} provider={providerOf(auth.user.app_metadata, synthetic)} />
        </section>

        <section id="addresses" aria-labelledby="addresses-h" className="scroll-mt-40">
          <SectionTitle id="addresses-h" before="Saved " accent="addresses" jp="お届け先" />
          <div className="mt-6 border-4 border-ink bg-paper p-4 text-ink shadow-hard-volt sm:p-6">
            <AddressBook seed={{ name: customer.name, phone: customer.phone }} />
          </div>
        </section>

        <section id="orders" aria-labelledby="orders-h" className="scroll-mt-40">
          <SectionTitle id="orders-h" before="Your " accent="orders" jp="注文履歴" />
          <OrdersList orders={orders} />
        </section>

        <section id="myanimelist" aria-labelledby="mal-h" className="scroll-mt-40">
          <SectionTitle id="mal-h" before="My" accent="AnimeList" jp="アニメリスト" />
          <MalPanel data={malData} canUnlink={!synthetic} />
        </section>

        <section id="for-you" aria-labelledby="for-you-h" className="scroll-mt-40">
          <SectionTitle id="for-you-h" before="Picked for " accent="you" jp="あなたへ" />
          <ForYou variant="account" className="mt-8" />
        </section>
      </div>
    </div>
  )
}

function providerOf(meta: Record<string, unknown> | undefined, synthetic: boolean): string {
  if (synthetic) return 'MyAnimeList'
  const list = Array.isArray(meta?.providers) ? (meta!.providers as string[]) : typeof meta?.provider === 'string' ? [meta.provider as string] : []
  const names = list.map((p) => (p === 'google' ? 'Google' : p === 'email' ? 'Email' : p))
  return names.length ? names.join(' + ') : 'Email'
}

function SectionTitle({ id, before, accent, jp }: { id: string; before: string; accent: string; jp: string }) {
  return (
    <div>
      <h2 id={id} className="h-display text-[clamp(2.25rem,5vw,4.25rem)]">
        {before}
        <em>{accent}</em>
      </h2>
      <p lang="ja" className="jp-sub mt-2">
        {jp}
      </p>
    </div>
  )
}

function AccountSkeleton() {
  return (
    <div role="status" aria-live="polite" className="container-x pb-16 pt-10 md:pt-16">
      <span className="sr-only">Opening your account…</span>
      <div aria-hidden="true">
        <div className="skeleton-tone mb-3 h-3 w-28" />
        <div className="skeleton-tone mb-10 h-14 w-[min(72%,520px)] md:h-24" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="skeleton-tone h-64 border-[3px] border-ink" />
          <div className="skeleton-tone h-64 border-[3px] border-ink" />
        </div>
      </div>
    </div>
  )
}
