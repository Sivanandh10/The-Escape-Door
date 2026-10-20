'use server'
// Pages CMS — server actions. Every call re-checks the session + permission server-side, validates with zod,
// writes on the caller's cookie-bound client (RLS: has_perm('pages.edit'); DELETE superadmin only), then
// updateTag('pages') so /policies/* shows the change on the next request.
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { ROLE_META } from '@/lib/admin/permissions'
import { PAGES_TAG, PAGE_SLUG_RE } from '@/app/policies/_lib/data'
import { checkDelete, checkPerm } from '../server'
import { PAGE_COLUMNS, builtinRow, pagesDbError, toAdminRow } from './data'
import { PAGE_LIMITS, type AdminPageRow, type PageResult } from './types'

const SaveSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(PAGE_SLUG_RE, 'Use 1–40 lowercase letters, numbers or dashes (no dash at the start or end).'),
  title: z.string().trim().min(1, 'Give the page a title.').max(PAGE_LIMITS.title, `Keep the title under ${PAGE_LIMITS.title} characters.`),
  description: z.string().trim().max(PAGE_LIMITS.description, `Keep the description under ${PAGE_LIMITS.description} characters.`),
  body: z
    .string()
    .max(PAGE_LIMITS.body, `The page is too long (max ${PAGE_LIMITS.body.toLocaleString('en-IN')} characters).`)
    .refine((s) => s.trim().length > 0, 'The page is empty — write something first.'),
  isNew: z.boolean(),
  /** updated_at the editor started from (null = not in the database yet) → stale-tab guard */
  base: z.string().nullable(),
  /** true = overwrite even if someone else saved in between (after the editor showed the conflict) */
  force: z.boolean().optional(),
})

export async function savePage(input: unknown): Promise<PageResult<AdminPageRow>> {
  const auth = await checkPerm('pages.edit')
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = SaveSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = String(issue?.path[0] ?? '') as 'slug' | 'title' | 'description' | 'body'
    return { ok: false, error: issue?.message ?? 'Check the form.', field: ['slug', 'title', 'description', 'body'].includes(field) ? field : undefined }
  }
  const v = parsed.data
  const sb = await supabaseServer()
  if (!sb) return { ok: false, error: 'Demo mode — connect Supabase to save changes.' }

  const { data: cur, error: readErr } = await sb.from('pages').select(PAGE_COLUMNS).eq('slug', v.slug).maybeSingle()
  if (readErr) return { ok: false, error: pagesDbError(readErr) }

  if (v.isNew && (cur || builtinRow(v.slug))) {
    return { ok: false, error: 'A page with this address already exists — pick another one.', field: 'slug' }
  }
  if (cur && !v.force && v.base !== cur.updated_at) {
    return {
      ok: false,
      error: `${cur.updated_by_name || 'Someone'} saved this page after you opened it. Load their version, or save yours over it.`,
      conflict: toAdminRow(cur),
    }
  }

  const s = auth.session
  const who = (s.displayName?.trim() || (s.role ? ROLE_META[s.role].label : '') || 'Team member').slice(0, 80)
  const row = { title: v.title, description: v.description, body_md: v.body, updated_by: s.userId, updated_by_name: who }

  const q = cur
    ? sb.from('pages').update(row).eq('slug', v.slug).select(PAGE_COLUMNS).single()
    : sb.from('pages').insert({ slug: v.slug, ...row }).select(PAGE_COLUMNS).single()
  const { data, error } = await q
  if (error) {
    if (error.code === '42501') return { ok: false, error: 'The database refused: your role can’t edit pages.' }
    if (error.code === '23505') return { ok: false, error: 'A page with this address already exists — pick another one.', field: 'slug' }
    return { ok: false, error: pagesDbError(error) }
  }
  updateTag(PAGES_TAG)
  return { ok: true, data: toAdminRow(data) }
}

/**
 * Superadmin only (hierarchy rule; RLS enforces it too). For a built-in policy this removes the edited copy
 * and the site goes back to the built-in text; any other page disappears (404).
 */
export async function deletePage(slug: unknown): Promise<PageResult<{ slug: string; restored: AdminPageRow | null }>> {
  const auth = await checkDelete()
  if (!auth.ok) return { ok: false, error: auth.error }
  if (typeof slug !== 'string' || !PAGE_SLUG_RE.test(slug)) return { ok: false, error: 'Unknown page.' }
  const sb = await supabaseServer()
  if (!sb) return { ok: false, error: 'Demo mode — connect Supabase to delete for real.' }
  const { data, error } = await sb.from('pages').delete().eq('slug', slug).select('slug')
  if (error) return { ok: false, error: `The database refused: ${pagesDbError(error)}` }
  if (!data?.length) return { ok: false, error: 'Nothing was deleted (already gone, or the database refused). Refresh and try again.' }
  updateTag(PAGES_TAG)
  return { ok: true, data: { slug, restored: builtinRow(slug) } }
}
