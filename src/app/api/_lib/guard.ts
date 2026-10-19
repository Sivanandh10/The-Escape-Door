// Shared helpers for F2 route handlers (private folder — not a route). Owner: F2.
// Naive in-memory rate limiting: per serverless instance only (stack-notes §1.7). It blunts
// bursts from one client; the honeypot + zod + size limits do the rest. IPs are never stored —
// only an in-memory, salted hash for the lifetime of the instance.
import { createHash, randomBytes } from 'node:crypto'
import { PRODUCTION_URL } from '@/lib/seo'

const SALT = randomBytes(16).toString('hex')
const buckets = new Map<string, number[]>()
let lastSweep = 0

/** Sliding-window limiter. true = allowed. */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  if (now - lastSweep > 60_000) {
    lastSweep = now
    for (const [k, hits] of buckets) if (!hits.length || now - hits[hits.length - 1] > 60 * 60_000) buckets.delete(k)
  }
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) { buckets.set(key, hits); return false }
  hits.push(now)
  buckets.set(key, hits)
  return true
}

/** Salted hash of the client IP (never logged or stored). */
export function clientKey(req: Request): string {
  const h = req.headers
  const ip = h.get('x-nf-client-connection-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  return createHash('sha256').update(SALT + ip).digest('hex').slice(0, 24)
}

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...extra },
  })
}

/** Read a JSON body with a hard byte cap. Returns { error } on oversize / bad JSON. */
export async function readJson(req: Request, maxBytes: number): Promise<{ data: unknown } | { error: 'too-large' | 'bad-json' }> {
  const len = Number(req.headers.get('content-length') ?? '0')
  if (len > maxBytes) return { error: 'too-large' }
  let text: string
  try { text = await req.text() } catch { return { error: 'bad-json' } }
  if (new TextEncoder().encode(text).length > maxBytes) return { error: 'too-large' }
  try { return { data: JSON.parse(text) } } catch { return { error: 'bad-json' } }
}

/** Same-site check for browser POSTs (blocks naive cross-site form spam; absent Origin is allowed for curl/server). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    const o = new URL(origin)
    const hosts = new Set<string>()
    for (const h of [req.headers.get('x-forwarded-host'), req.headers.get('host')]) if (h) hosts.add(h.split(',')[0].trim())
    // Netlify: the request host can differ from the public one behind the CDN — also accept the
    // site's configured origins (custom domain, primary URL, deploy previews).
    for (const u of [process.env.NEXT_PUBLIC_SITE_URL, process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL, PRODUCTION_URL]) {
      if (!u) continue
      try { hosts.add(new URL(u).host) } catch { /* ignore malformed */ }
    }
    return hosts.has(o.host)
  } catch { return false }
}
