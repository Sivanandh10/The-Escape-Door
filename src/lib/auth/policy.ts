// Owner rule (25 Oct 2026, final): without an account shoppers can only VIEW and SHARE. Add to cart, buy now,
// wishlist (♥), remind me, custom orders and checkout need a login (Google, MyAnimeList or email) — the login pop-up
// opens and the action continues right after login. The server also refuses guest orders.
// Emergency switch to "login optional" without a code change: set NEXT_PUBLIC_LOGIN_OPTIONAL=1 on Netlify and redeploy
// (guests then get the 2-field WhatsApp checkout again).
export const LOGIN_ALWAYS_REQUIRED = process.env.NEXT_PUBLIC_LOGIN_OPTIONAL !== '1'

/** Is the login gate on? The providers answer is kept as a parameter so existing callers compile. */
export function loginGateOn(providers?: { any: boolean } | null): boolean {
  void providers
  return LOGIN_ALWAYS_REQUIRED
}
