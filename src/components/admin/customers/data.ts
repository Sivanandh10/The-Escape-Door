// Admin → Customers data (owner: AUTH) — SERVER ONLY. Called after requireAdmin('customers.view') / checkPerm.
// Real rows only: public.profiles (minus team members) joined with auth.users (provider, last sign-in), orders
// (count + spend, non-cancelled), recent_views and mal_accounts — read with the service role so the numbers are
// complete regardless of which RLS policies another migration added. Never returns refresh tokens.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isSyntheticEmail } from '@/lib/auth/shared'
import { getProducts } from '@/lib/data/repo'
import { orderSnapshotFromRow, type OrderSnapshot } from '@/lib/checkout/types'
import { addressFromRow, addressLines, formatPhone } from '@/lib/checkout/schema'
import type { MalAnime, MalSnapshotStats } from '@/lib/recs/types'

export type Provider = 'Google' | 'Email' | 'MyAnimeList'

export interface CustomerRow {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  avatarUrl: string | null
  providers: Provider[]
  malUsername: string | null
  signedUpAt: string
  lastSeenAt: string | null
  orders: number
  spent: number
  views: number
}

export interface CustomersData {
  rows: CustomerRow[]
  loadedAt: string
  /** partial data notes (e.g. checkout migration not applied yet) */
  notes: string[]
  error: string | null
}

const PAGE = 1000
const maxIso = (...xs: Array<string | null | undefined>) => xs.filter((x): x is string => !!x).sort().pop() ?? null

export async function loadCustomers(): Promise<CustomersData> {
  const loadedAt = new Date().toISOString()
  const sa = supabaseAdmin()
  if (!sa) return { rows: [], loadedAt, notes: [], error: 'The service key is missing on the server (SUPABASE_SERVICE_ROLE_KEY).' }
  const notes: string[] = []

  try {
    // profiles (paged)
    const profiles: Array<Record<string, unknown>> = []
    for (let from = 0; from < 20_000; from += PAGE) {
      const { data, error } = await sa
        .from('profiles')
        .select('id, email, name, phone, avatar_url, last_seen_at, created_at')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) {
        if (/relation .*profiles|does not exist/i.test(error.message)) {
          return { rows: [], loadedAt, notes: [], error: 'Run supabase/migrations/0005_customers.sql first — the profiles table is missing.' }
        }
        throw error
      }
      profiles.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }

    const [staffRes, ordersRes, viewsRes, malRes] = await Promise.all([
      sa.from('admins').select('user_id'),
      sa.from('orders').select('user_id, total, status').not('user_id', 'is', null).limit(20_000),
      sa.from('recent_views').select('user_id, viewed_at').limit(50_000),
      sa.from('mal_accounts').select('user_id, mal_username'),
    ])
    const staff = new Set((staffRes.data ?? []).map((r) => r.user_id as string))
    if (ordersRes.error) notes.push('Order totals need supabase/migrations/0006_checkout.sql (orders.user_id).')

    const orderAgg = new Map<string, { n: number; spent: number }>()
    for (const o of ordersRes.data ?? []) {
      const uid = o.user_id as string
      const a = orderAgg.get(uid) ?? { n: 0, spent: 0 }
      a.n += 1
      if (o.status !== 'cancelled' && typeof o.total === 'number') a.spent += o.total
      orderAgg.set(uid, a)
    }
    const viewAgg = new Map<string, { n: number; last: string | null }>()
    for (const v of viewsRes.data ?? []) {
      const uid = v.user_id as string
      const a = viewAgg.get(uid) ?? { n: 0, last: null }
      a.n += 1
      a.last = maxIso(a.last, v.viewed_at as string)
      viewAgg.set(uid, a)
    }
    const mal = new Map((malRes.data ?? []).map((m) => [m.user_id as string, m.mal_username as string]))

    // auth users: providers + last sign-in (paged)
    const authInfo = new Map<string, { providers: string[]; lastSignIn: string | null; email: string | null }>()
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await sa.auth.admin.listUsers({ page, perPage: PAGE })
      if (error) {
        notes.push('Login providers unavailable (auth admin API error).')
        break
      }
      for (const u of data.users) {
        const app = (u.app_metadata ?? {}) as { providers?: string[]; provider?: string }
        authInfo.set(u.id, {
          providers: Array.isArray(app.providers) ? app.providers : app.provider ? [app.provider] : [],
          lastSignIn: u.last_sign_in_at ?? null,
          email: u.email ?? null,
        })
      }
      if (data.users.length < PAGE) break
    }

    const rows: CustomerRow[] = []
    for (const p of profiles) {
      const id = p.id as string
      if (staff.has(id)) continue
      const a = authInfo.get(id)
      const email = (p.email as string | null) ?? a?.email ?? null
      const synthetic = isSyntheticEmail(email)
      const providers = new Set<Provider>()
      if (synthetic || mal.has(id)) providers.add('MyAnimeList')
      for (const pr of a?.providers ?? []) {
        if (pr === 'google') providers.add('Google')
        else if (pr === 'email' && !synthetic) providers.add('Email')
      }
      if (!providers.size) providers.add('Email')
      const o = orderAgg.get(id)
      const v = viewAgg.get(id)
      rows.push({
        id,
        name: (p.name as string | null) ?? null,
        email: synthetic ? null : email,
        phone: (p.phone as string | null) ?? null,
        avatarUrl: (p.avatar_url as string | null) ?? null,
        providers: [...providers],
        malUsername: mal.get(id) ?? null,
        signedUpAt: p.created_at as string,
        lastSeenAt: maxIso(p.last_seen_at as string | null, a?.lastSignIn, v?.last),
        orders: o?.n ?? 0,
        spent: o?.spent ?? 0,
        views: v?.n ?? 0,
      })
    }
    return { rows, loadedAt, notes, error: null }
  } catch (e) {
    return { rows: [], loadedAt, notes, error: e instanceof Error ? e.message : 'Couldn’t load customers.' }
  }
}

// ---------------------------------------------------------------- detail (drawer)
export interface CustomerDetail {
  addresses: Array<{ id: string; label: string; lines: string[]; phone: string | null; isDefault: boolean }>
  orders: OrderSnapshot[]
  views: Array<{ slug: string; name: string; viewedAt: string; count: number }>
  mal: { username: string; syncedAt: string | null; stats: MalSnapshotStats | null; top: Array<Pick<MalAnime, 'id' | 'title' | 'en' | 'status' | 'score'>> } | null
  notes: string[]
}

export async function loadCustomerDetail(userId: string): Promise<CustomerDetail> {
  const sa = supabaseAdmin()
  const out: CustomerDetail = { addresses: [], orders: [], views: [], mal: null, notes: [] }
  if (!sa) return { ...out, notes: ['The service key is missing on the server.'] }

  const [addr, orders, views, mal, products] = await Promise.all([
    sa.from('addresses').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    sa.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    sa.from('recent_views').select('product_slug, viewed_at, view_count').eq('user_id', userId).order('viewed_at', { ascending: false }).limit(30),
    sa.from('mal_accounts').select('mal_username, synced_at, stats, anime_snapshot').eq('user_id', userId).maybeSingle(),
    getProducts(),
  ])

  if (addr.error) out.notes.push('Addresses need supabase/migrations/0006_checkout.sql.')
  for (const row of (addr.data ?? []) as Array<Record<string, unknown>>) {
    const a = addressFromRow(row)
    out.addresses.push({
      id: a.id,
      label: [a.kind[0].toUpperCase() + a.kind.slice(1), a.name].filter(Boolean).join(' · '),
      lines: addressLines(a),
      phone: a.phone ? formatPhone(a.phone) : null,
      isDefault: a.isDefault,
    })
  }
  if (!orders.error) out.orders = ((orders.data ?? []) as Array<Record<string, unknown>>).map(orderSnapshotFromRow)

  const names = new Map(products.map((p) => [p.slug, p.name]))
  out.views = ((views.data ?? []) as Array<Record<string, unknown>>).map((v) => ({
    slug: v.product_slug as string,
    name: names.get(v.product_slug as string) ?? (v.product_slug as string),
    viewedAt: v.viewed_at as string,
    count: (v.view_count as number) ?? 1,
  }))

  if (mal.data) {
    const list = (Array.isArray(mal.data.anime_snapshot) ? mal.data.anime_snapshot : []) as MalAnime[]
    const rank = (a: MalAnime) => (a.status === 'watching' ? 20 : 0) + a.score * 2
    out.mal = {
      username: mal.data.mal_username as string,
      syncedAt: (mal.data.synced_at as string | null) ?? null,
      stats: (mal.data.stats as MalSnapshotStats | null) ?? null,
      top: [...list]
        .filter((a) => a.status !== 'dropped' && a.status !== 'plan_to_watch')
        .sort((a, b) => rank(b) - rank(a))
        .slice(0, 10)
        .map((a) => ({ id: a.id, title: a.title, en: a.en, status: a.status, score: a.score })),
    }
  }
  return out
}
