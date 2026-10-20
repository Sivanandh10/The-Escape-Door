// Pages CMS — admin read (server only; call inside <Suspense> after requireAdmin('pages.edit')).
// Live: every public.pages row (cookie-bound client, RLS) merged with the four built-in policies that have
// no row yet. Demo (Supabase missing): the built-in texts, read-only.
import { supabaseServer } from '@/lib/supabase/server'
import { POLICIES, policyBySlug } from '@/components/content/policies'
import type { AdminPageRow } from './types'

interface DbRow {
  slug: string
  title: string
  description: string | null
  body_md: string
  updated_at: string | null
  updated_by_name: string | null
}

export const PAGE_COLUMNS = 'slug,title,description,body_md,updated_at,updated_by_name'

export function toAdminRow(r: DbRow): AdminPageRow {
  return {
    slug: r.slug,
    title: r.title,
    description: r.description ?? '',
    body: r.body_md ?? '',
    updatedAt: r.updated_at,
    updatedByName: r.updated_by_name,
    stored: true,
    builtin: !!policyBySlug(r.slug),
  }
}

export function builtinRow(slug: string): AdminPageRow | null {
  const p = policyBySlug(slug)
  if (!p) return null
  return { slug: p.slug, title: p.h1, description: p.description, body: p.body, updatedAt: null, updatedByName: null, stored: false, builtin: true }
}

/** Friendly copy for "table missing" (migration not applied yet) and other read errors. */
export function pagesDbError(e: { code?: string; message?: string } | null): string {
  if (!e) return 'Unknown error'
  if (e.code === '42P01' || e.code === 'PGRST205' || /relation .*pages.* does not exist|could not find the table/i.test(e.message ?? '')) {
    return 'The pages table doesn’t exist yet — run supabase/migrations/0008_pages.sql in the Supabase SQL editor.'
  }
  return e.message ?? 'Unknown error'
}

function sortRows(rows: AdminPageRow[]): AdminPageRow[] {
  const order = new Map(POLICIES.map((p, i) => [p.slug as string, i]))
  return rows.sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99) || a.slug.localeCompare(b.slug))
}

export async function loadAdminPages(demo: boolean): Promise<{ rows: AdminPageRow[]; error: string | null }> {
  const builtins = POLICIES.map((p) => builtinRow(p.slug)!)
  if (demo) return { rows: builtins, error: null }
  const sb = await supabaseServer()
  if (!sb) return { rows: builtins, error: 'Supabase client unavailable' }
  const { data, error } = await sb.from('pages').select(PAGE_COLUMNS).order('slug').limit(200)
  if (error) return { rows: builtins, error: pagesDbError(error) }
  const stored = ((data ?? []) as DbRow[]).map(toAdminRow)
  const have = new Set(stored.map((r) => r.slug))
  return { rows: sortRows([...stored, ...builtins.filter((b) => !have.has(b.slug))]), error: null }
}
