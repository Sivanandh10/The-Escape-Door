// Owner rule (Oct 2026 review): login is OPTIONAL everywhere. Add to cart, buy now, wishlist (saved in this browser),
// cart and checkout all work without an account — checkout asks only for a name + WhatsApp number, the rest is sorted
// in the chat. Logging in is an upgrade (saved cart + addresses, order tracking, anime picks), offered by a subtle,
// dismissible hint — never a pop-up that blocks an action.
// Emergency switch back to "login required for actions" without a code change: set NEXT_PUBLIC_LOGIN_REQUIRED=1 on
// Netlify and redeploy (the action gates, the /wishlist + /checkout link gate and the server's guest refusal return).
export const LOGIN_ALWAYS_REQUIRED = process.env.NEXT_PUBLIC_LOGIN_REQUIRED === '1'

/**
 * Is the login gate on? Only when the owner switched login back to mandatory. The providers answer (which login
 * methods work) no longer turns the gate on by itself; the parameter is kept so existing callers compile.
 */
export function loginGateOn(providers?: { any: boolean } | null): boolean {
  void providers
  return LOGIN_ALWAYS_REQUIRED
}
