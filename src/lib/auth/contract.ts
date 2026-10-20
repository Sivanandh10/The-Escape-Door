// Customer-auth CONTRACT — types only (no runtime code), safe to import from server and client.
// Implemented by the AUTH owner in:
//   src/lib/auth/customer-server.ts  → getCustomer: GetCustomer
//   src/lib/auth/customer.tsx        → CustomerProvider, useCustomer: UseCustomer, useRequireLogin: UseRequireLogin
// Customers are shop shoppers (auth.users + public.profiles). Admin/staff accounts live in public.admins and are
// NOT customers: a staff login must never create a profile automatically.

import type { ReactNode } from 'react'

/** A signed-in shopper (public.profiles row joined with the auth user). */
export interface Customer {
  /** auth.users.id = public.profiles.id */
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  phone: string | null
  /** MyAnimeList username when the customer linked MAL, else null */
  malUsername: string | null
}

/** Shape of public.profiles (created by the AUTH migration). */
export interface ProfileRow {
  id: string
  email: string | null
  name: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

/** Server: current customer from the Supabase session cookies (via supabaseServer()), or null. */
export type GetCustomer = () => Promise<Customer | null>

/** Props of <CustomerProvider> (mounted once in src/components/Providers.tsx). */
export interface CustomerProviderProps {
  /** customer resolved on the server, to avoid a signed-out flash */
  initial?: Customer | null
  children?: ReactNode
}

/** Value of useCustomer(). */
export interface CustomerContextValue {
  customer: Customer | null
  /** true until the client session has been checked */
  loading: boolean
  /**
   * Open the login modal. `reason` is shown as the headline (e.g. "Log in to add this to your cart");
   * `then` runs once the customer has signed in successfully.
   */
  openLogin: (reason?: string, then?: () => void, replay?: LoginReplay) => void
  signOut: () => void | Promise<void>
  /** AUTH extension: re-read the profile (after editing name/phone, linking MAL …) */
  refresh?: () => Promise<void>
}

/**
 * AUTH extension. Google / MyAnimeList / magic-link logins leave the page, so a `then` closure can't survive them.
 * Pass a serialisable replay and the provider performs it when the shopper comes back signed in:
 *   cart-add → adds the item to the cart (+ toast) · wishlist → saves the product · none → "welcome back" toast only.
 */
export type LoginReplay =
  | { type: 'cart-add'; item: import('@/lib/cart').AddInput }
  | { type: 'wishlist'; productId: string; name?: string }
  | { type: 'none' }
export type UseCustomer = () => CustomerContextValue

/**
 * useRequireLogin() → gate(reason, action): runs `action` immediately when signed in, otherwise opens the
 * login modal with `reason` and runs `action` after a successful login.
 *   const requireLogin = useRequireLogin()
 *   onClick={() => requireLogin('Log in to add to cart', () => add(item))}
 */
export type RequireLogin = (reason: string, action: () => void, replay?: LoginReplay) => void
export type UseRequireLogin = () => RequireLogin
