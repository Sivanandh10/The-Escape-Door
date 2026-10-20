// Recently viewed — browser side (owner: AUTH). Every product page view is remembered locally (newest first, max 20)
// so it can be merged into the shopper's account the moment they log in; signed-in views also go to the server.
// localStorage can be missing/blocked → every access is guarded and the site works without it.
const KEY = 'ted-recent-v1'
const MAX = 20

export function readLocalViews(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && /^[a-z0-9-]{1,120}$/.test(s)).slice(0, MAX) : []
  } catch {
    return []
  }
}

export function pushLocalView(slug: string): void {
  try {
    const next = [slug, ...readLocalViews().filter((s) => s !== slug)].slice(0, MAX)
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage blocked — fine */
  }
}

export function clearLocalViews(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** POST a view for the signed-in shopper (fire-and-forget; never throws). */
export function sendView(slug: string): void {
  try {
    void fetch('/api/auth/me/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* ignore */
  }
}
