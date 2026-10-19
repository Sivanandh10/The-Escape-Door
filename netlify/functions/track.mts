// Netlify Function v2 — first-party analytics ingest. Owner: F2. CONTRACTS §10.4 / §10.5.
// Endpoint: /.netlify/functions/track (default path; the client uses NEXT_PUBLIC_TRACK_ENDPOINT).
// - Adds country / region / city from context.geo. NEVER stores context.ip or the user agent.
// - Validates the batch, responds 204 immediately and writes in waitUntil (service role).
// - Unconfigured Supabase → accepted and dropped (still 204).
// - Drops (204, nothing stored): bots / headless browsers by user agent (UA is only tested, never
//   stored) and events on /admin, /lab or /api paths (staff and internal pages are not traffic).
import type { Config, Context } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const MAX_BODY = 64 * 1024
const MAX_EVENTS = 50
const DAY = 24 * 60 * 60 * 1000
const BOT_UA = /bot|crawler|spider|headless|lighthouse|playwright/i
const EXCLUDED_PATH = /^\/(admin|lab|api)(\/|$)/

type Props = Record<string, string | number | boolean | null>

interface Incoming {
  v?: unknown
  s?: unknown
  attr?: unknown
  device?: unknown
  events?: unknown
}

const idOk = (x: unknown): x is string => typeof x === 'string' && /^[\w-]{6,64}$/.test(x)
const txt = (x: unknown, max: number): string | null => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : null)

function cleanProps(x: unknown): Props | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null
  const out: Props = {}
  for (const [k, v] of Object.entries(x as Record<string, unknown>).slice(0, 20)) {
    if (!/^[\w-]{1,40}$/.test(k)) continue
    if (typeof v === 'string') out[k] = v.slice(0, 200)
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'boolean' || v === null) out[k] = v
  }
  return Object.keys(out).length ? out : null
}

function env(name: string): string {
  try {
    const n = (globalThis as { Netlify?: { env?: { get(k: string): string | undefined } } }).Netlify
    return (n?.env?.get(name) ?? process.env[name] ?? '').trim()
  } catch {
    return (process.env[name] ?? '').trim()
  }
}

export default async (req: Request, context: Context): Promise<Response> => {
  const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, allow: 'POST' } })
  if (BOT_UA.test(req.headers.get('user-agent') ?? '')) return new Response(null, { status: 204, headers })

  let raw: string
  try { raw = await req.text() } catch { return new Response(null, { status: 400, headers }) }
  if (raw.length > MAX_BODY) return new Response(null, { status: 413, headers })

  let body: Incoming
  try { body = JSON.parse(raw) as Incoming } catch { return new Response(null, { status: 400, headers }) }
  if (!idOk(body.v) || !idOk(body.s) || !Array.isArray(body.events) || body.events.length === 0) {
    return new Response(null, { status: 400, headers })
  }

  const attr = (body.attr && typeof body.attr === 'object' ? body.attr : {}) as Record<string, unknown>
  const device = body.device === 'mobile' || body.device === 'tablet' || body.device === 'desktop' ? body.device : null
  const geo = context.geo ?? {}
  const now = Date.now()

  let excluded = 0
  const rows = (body.events as unknown[]).slice(0, MAX_EVENTS).flatMap((e) => {
    if (!e || typeof e !== 'object') return []
    const ev = e as Record<string, unknown>
    const name = typeof ev.name === 'string' && /^[a-z0-9_]{2,40}$/.test(ev.name) ? ev.name : null
    const path = typeof ev.path === 'string' && ev.path.startsWith('/') ? ev.path.slice(0, 300) : null
    if (!name || !path) return []
    if (EXCLUDED_PATH.test(path)) { excluded++; return [] }
    const ts = typeof ev.ts === 'number' && Math.abs(ev.ts - now) < DAY ? ev.ts : now
    return [{
      ts: new Date(ts).toISOString(),
      visitor_id: body.v as string,
      session_id: body.s as string,
      name,
      path,
      props: cleanProps(ev.props),
      src: txt(attr.src, 64),
      utm_source: txt(attr.utm_source, 100),
      utm_medium: txt(attr.utm_medium, 100),
      utm_campaign: txt(attr.utm_campaign, 100),
      referrer: txt(attr.referrer, 200),
      landing: txt(attr.landing, 200),
      device,
      country: geo.country?.code ?? null,
      region: geo.subdivision?.name ?? geo.subdivision?.code ?? null,
      city: geo.city ?? null,
    }]
  })
  if (!rows.length) return new Response(null, { status: excluded ? 204 : 400, headers })

  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY')
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    context.waitUntil(
      (async () => {
        try {
          const { error } = await sb.from('analytics_events').insert(rows)
          if (error) console.error('[track] insert failed', error.message)
        } catch (err) {
          console.error('[track] insert threw', err instanceof Error ? err.message : err)
        }
      })(),
    )
  }
  return new Response(null, { status: 204, headers })
}

export const config: Config = {
  method: ['POST', 'OPTIONS'],
  // Netlify native rate limiting (per IP + domain). UNVERIFIED on a default-path function —
  // confirm on the first deploy preview; harmless if ignored.
  rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}
