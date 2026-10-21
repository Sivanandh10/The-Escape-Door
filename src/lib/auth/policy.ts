// Owner rule: login is ALWAYS required for add to cart, buy now, wishlist, product pages and checkout — even before
// Google / MyAnimeList are switched on (customers sign up with email + password). Emergency switch-off without a code
// change: set NEXT_PUBLIC_LOGIN_OPTIONAL=1 on Netlify and redeploy (guests then get the full guest checkout again).
export const LOGIN_ALWAYS_REQUIRED = process.env.NEXT_PUBLIC_LOGIN_OPTIONAL !== '1'

/** Is the login gate on, given what /api/auth/providers reported (null = still checking)? */
export function loginGateOn(p: { any: boolean } | null | undefined): boolean {
  return LOGIN_ALWAYS_REQUIRED || !!p?.any
}
