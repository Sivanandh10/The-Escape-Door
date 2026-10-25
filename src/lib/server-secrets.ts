// Server-only secrets (owner: COMMERCE). NEVER import this from a 'use client' file or anything the browser loads.
//   getServerSecret(name)   → the environment variable when it is set, else public.app_secrets (migration 0013)
//                             read with the service-role client, cached 5 minutes per server instance.
//   getServerSecrets(names) → same, several names in ONE query.
// Values are never logged, never returned by an API route and never sent to the browser. A missing table (0013 not
// run yet) or an unreachable database answers null (cached briefly) — callers treat that as "not configured".
import { supabaseAdmin } from '@/lib/supabase/admin'

if (typeof window !== 'undefined') throw new Error('server-secrets is server-only')

const HIT_TTL = 5 * 60_000
/** a name that isn't stored yet is re-checked sooner, so an inserted secret goes live within a minute */
const MISS_TTL = 60_000

const cache = new Map<string, { value: string | null; at: number }>()
let inflight: Promise<void> | null = null
let inflightNames = new Set<string>()

const fromEnv = (name: string): string | null => {
  const v = (process.env[name] ?? '').trim()
  return v ? v : null
}

function fresh(name: string, now: number): boolean {
  const c = cache.get(name)
  return !!c && now - c.at < (c.value ? HIT_TTL : MISS_TTL)
}

async function loadFromDb(names: string[]): Promise<void> {
  const now = Date.now()
  const sb = supabaseAdmin()
  if (!sb) {
    for (const n of names) cache.set(n, { value: null, at: now })
    return
  }
  try {
    const { data, error } = await sb.from('app_secrets').select('name, value').in('name', names)
    if (error) {
      for (const n of names) if (!cache.get(n)?.value) cache.set(n, { value: null, at: now })
      return
    }
    const got = new Map<string, string>()
    for (const r of (data ?? []) as Array<{ name?: unknown; value?: unknown }>) {
      if (typeof r.name === 'string' && typeof r.value === 'string' && r.value.trim()) got.set(r.name, r.value.trim())
    }
    for (const n of names) cache.set(n, { value: got.get(n) ?? null, at: now })
  } catch {
    // network hiccup: keep a previously known value, else remember the miss briefly
    for (const n of names) if (!cache.get(n)?.value) cache.set(n, { value: null, at: now })
  }
}

/** Several secrets at once (env first, then one DB round trip for the rest). */
export async function getServerSecrets<N extends string>(names: readonly N[]): Promise<Record<N, string | null>> {
  const out = {} as Record<N, string | null>
  const now = Date.now()
  const need: string[] = []
  for (const n of names) {
    const env = fromEnv(n)
    if (env) out[n] = env
    else if (!fresh(n, now)) need.push(n)
  }
  if (need.length) {
    // share one in-flight read when it already covers these names
    if (inflight && need.every((n) => inflightNames.has(n))) await inflight
    else {
      const names = new Set(need)
      const p = loadFromDb(need).finally(() => {
        if (inflight === p) {
          inflight = null
          inflightNames = new Set()
        }
      })
      inflight = p
      inflightNames = names
      await p
    }
  }
  for (const n of names) if (!(n in out)) out[n] = cache.get(n)?.value ?? null
  return out
}

/** One secret: env var first, else public.app_secrets (service role, cached). null when absent. */
export async function getServerSecret(name: string): Promise<string | null> {
  return (await getServerSecrets([name]))[name]
}

/** Drop the cache (tests / after rotating a value in the same instance). */
export function clearServerSecretCache(): void {
  cache.clear()
}
