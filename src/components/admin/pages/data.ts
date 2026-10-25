// Pages CMS — admin read (server only; call inside <Suspense> after requireAdmin('pages.edit')).
// Live: every public.pages row (cookie-bound client, RLS) merged with the four built-in policies that have
// no row yet, plus the open drafts from public.page_drafts (migration 0014; RLS: pages.edit only).
// Demo (Supabase missing): the built-in texts with the seeded drafts, read-only.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabase/server'
import { POLICIES, policyBySlug } from '@/components/content/policies'
import { DRAFT_SEEDS } from './draftSeeds'
import type { AdminPageDraft, AdminPageRow } from './types'

interface DbRow {
  slug: string
  title: string
  description: string | null
  body_md: string
  updated_at: string | null
  updated_by_name: string | null
}

export interface DraftDbRow {
  slug: string
  title: string
  description: string | null
  body_md: string
  note: string | null
  status: string
  updated_at: string | null
  updated_by_name: string | null
}

export const PAGE_COLUMNS = 'slug,title,description,body_md,updated_at,updated_by_name'
export const DRAFT_COLUMNS = 'slug,title,description,body_md,note,status,updated_at,updated_by_name'

export function toAdminDraft(d: DraftDbRow | null | undefined): AdminPageDraft | null {
  if (!d || d.status !== 'draft') return null
  return {
    title: d.title,
    description: d.description ?? '',
    body: d.body_md ?? '',
    note: d.note ?? '',
    updatedAt: d.updated_at,
    updatedByName: d.updated_by_name,
  }
}

export function toAdminRow(r: DbRow, draft: AdminPageDraft | null = null): AdminPageRow {
  return {
    slug: r.slug,
    title: r.title,
    description: r.description ?? '',
    body: r.body_md ?? '',
    updatedAt: r.updated_at,
    updatedByName: r.updated_by_name,
    stored: true,
    builtin: !!policyBySlug(r.slug),
    live: true,
    draft,
  }
}

export function builtinRow(slug: string, draft: AdminPageDraft | null = null): AdminPageRow | null {
  const p = policyBySlug(slug)
  if (!p) return null
  return {
    slug: p.slug, title: p.h1, description: p.description, body: p.body, updatedAt: null, updatedByName: null,
    stored: false, builtin: true, live: true, draft,
  }
}

/** A page that exists only as a draft (never published → /policies/<slug> is a 404). */
export function draftOnlyRow(slug: string, draft: AdminPageDraft): AdminPageRow {
  return {
    slug, title: draft.title, description: draft.description, body: '', updatedAt: null, updatedByName: null,
    stored: false, builtin: false, live: false, draft,
  }
}

/** Friendly copy for "table missing" (migration not applied yet) and other read errors. */
export function pagesDbError(e: { code?: string; message?: string } | null): string {
  if (!e) return 'Unknown error'
  if (isMissingTable(e)) {
    if (/page_drafts/i.test(e.message ?? '')) {
      return 'The drafts table doesn’t exist yet — run supabase/migrations/0014_size_charts.sql in the Supabase SQL editor.'
    }
    return 'The pages table doesn’t exist yet — run supabase/migrations/0008_pages.sql in the Supabase SQL editor.'
  }
  return e.message ?? 'Unknown error'
}

export function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  return !!e && (e.code === '42P01' || e.code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(e.message ?? ''))
}

function sortRows(rows: AdminPageRow[]): AdminPageRow[] {
  const order = new Map(POLICIES.map((p, i) => [p.slug as string, i]))
  return rows.sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99) || a.slug.localeCompare(b.slug))
}

function mergeRows(stored: DbRow[], drafts: Map<string, AdminPageDraft>): AdminPageRow[] {
  const out = stored.map((r) => toAdminRow(r, drafts.get(r.slug) ?? null))
  const have = new Set(out.map((r) => r.slug))
  for (const p of POLICIES) {
    if (have.has(p.slug)) continue
    out.push(builtinRow(p.slug, drafts.get(p.slug) ?? null)!)
    have.add(p.slug)
  }
  for (const [slug, d] of drafts) if (!have.has(slug)) out.push(draftOnlyRow(slug, d))
  return sortRows(out)
}

/** One page, merged (live row or built-in + its open draft). null = no such page or draft. */
export async function loadAdminPage(sb: SupabaseClient, slug: string): Promise<AdminPageRow | null> {
  const [{ data: row }, { data: d }] = await Promise.all([
    sb.from('pages').select(PAGE_COLUMNS).eq('slug', slug).maybeSingle(),
    sb.from('page_drafts').select(DRAFT_COLUMNS).eq('slug', slug).maybeSingle(),
  ])
  const draft = toAdminDraft(d as DraftDbRow | null)
  if (row) return toAdminRow(row as DbRow, draft)
  return builtinRow(slug, draft) ?? (draft ? draftOnlyRow(slug, draft) : null)
}

export interface AdminPagesLoad {
  rows: AdminPageRow[]
  /** pages could not be read → the editor is read-only */
  error: string | null
  /** drafts could not be read (e.g. 0014 not applied) → publishing still works, "Save draft" is off */
  draftError: string | null
}

export async function loadAdminPages(demo: boolean): Promise<AdminPagesLoad> {
  if (demo) {
    const seeded = new Map<string, AdminPageDraft>(
      DRAFT_SEEDS.map((d) => [d.slug, { title: d.title, description: d.description, body: d.body, note: d.note, updatedAt: null, updatedByName: null }]),
    )
    return { rows: mergeRows([], seeded), error: null, draftError: null }
  }
  const builtins = POLICIES.map((p) => builtinRow(p.slug)!)
  const sb = await supabaseServer()
  if (!sb) return { rows: builtins, error: 'Supabase client unavailable', draftError: null }
  const [pages, drafts] = await Promise.all([
    sb.from('pages').select(PAGE_COLUMNS).order('slug').limit(200),
    sb.from('page_drafts').select(DRAFT_COLUMNS).eq('status', 'draft').limit(200),
  ])
  if (pages.error) return { rows: builtins, error: pagesDbError(pages.error), draftError: null }
  const draftMap = new Map<string, AdminPageDraft>()
  let draftError: string | null = null
  if (drafts.error) {
    draftError = isMissingTable(drafts.error)
      ? 'Drafts are off until supabase/migrations/0014_size_charts.sql is run in the Supabase SQL editor. Publishing still works.'
      : `Drafts didn’t load: ${drafts.error.message}`
  } else {
    for (const d of (drafts.data ?? []) as DraftDbRow[]) {
      const ad = toAdminDraft(d)
      if (ad) draftMap.set(d.slug, ad)
    }
  }
  return { rows: mergeRows((pages.data ?? []) as DbRow[], draftMap), error: null, draftError }
}
