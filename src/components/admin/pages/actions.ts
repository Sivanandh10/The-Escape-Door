'use server'
// Pages CMS — server actions. Every call re-checks the session + permission server-side, validates with zod,
// writes on the caller's cookie-bound client (RLS: has_perm('pages.edit'); DELETE superadmin only).
//   savePage      = PUBLISH: writes public.pages, closes the open draft (status 'published'), updateTag('pages')
//                   so /policies/* shows the change on the next request.
//   saveDraft     = writes public.page_drafts only (status 'draft', migration 0014). The site never reads drafts.
//   discardDraft  = status 'discarded' (an update, not a delete — editors may do it); restoreDraft undoes it.
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { ROLE_META } from '@/lib/admin/permissions'
import { PAGES_TAG, PAGE_SLUG_RE } from '@/app/policies/_lib/data'
import { checkDelete, checkPerm } from '../server'
import { DRAFT_COLUMNS, PAGE_COLUMNS, builtinRow, isMissingTable, loadAdminPage, pagesDbError, toAdminRow, type DraftDbRow } from './data'
import { PAGE_LIMITS, type AdminPageRow, type PageResult } from './types'

const PageFields = {
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
  /** true = overwrite even if someone else saved in between (after the editor showed the conflict) */
  force: z.boolean().optional(),
}

const SaveSchema = z.object({
  ...PageFields,
  /** live updated_at the editor started from (null = not in the database yet) → stale-tab guard */
  base: z.string().nullable(),
  /** draft updated_at the editor started from, when it opened a draft (null/absent = no draft) */
  draftBase: z.string().nullable().optional(),
})

const DraftSchema = z.object({
  ...PageFields,
  /** draft updated_at the editor started from (null = there was no open draft) */
  base: z.string().nullable(),
})

type FieldKey = 'slug' | 'title' | 'description' | 'body'
const FIELD_KEYS: FieldKey[] = ['slug', 'title', 'description', 'body']

function invalid(error: z.ZodError): { ok: false; error: string; field?: FieldKey } {
  const issue = error.issues[0]
  const field = String(issue?.path[0] ?? '') as FieldKey
  return { ok: false, error: issue?.message ?? 'Check the form.', field: FIELD_KEYS.includes(field) ? field : undefined }
}

const sameStamp = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? null) === (b ?? null) || (!!a && !!b && Date.parse(a) === Date.parse(b))

function editorName(s: { displayName?: string | null; role?: keyof typeof ROLE_META | null }): string {
  return (s.displayName?.trim() || (s.role ? ROLE_META[s.role].label : '') || 'Team member').slice(0, 80)
}

const SLUG_TAKEN = 'A page with this address already exists — pick another one.'

/** PUBLISH — the text goes live on /policies/<slug> and the open draft (if any) is closed. */
export async function savePage(input: unknown): Promise<PageResult<AdminPageRow>> {
  const auth = await checkPerm('pages.edit')
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = SaveSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const v = parsed.data
  const sb = await supabaseServer()
  if (!sb) return { ok: false, error: 'Demo mode — connect Supabase to save changes.' }

  const [{ data: cur, error: readErr }, draftRead] = await Promise.all([
    sb.from('pages').select(PAGE_COLUMNS).eq('slug', v.slug).maybeSingle(),
    sb.from('page_drafts').select(DRAFT_COLUMNS).eq('slug', v.slug).maybeSingle(),
  ])
  if (readErr) return { ok: false, error: pagesDbError(readErr) }
  // drafts table missing (0014 not run yet) → publishing works exactly as before
  const draftsOn = !(draftRead.error && isMissingTable(draftRead.error))
  const openDraft = draftsOn && (draftRead.data as DraftDbRow | null)?.status === 'draft' ? (draftRead.data as DraftDbRow) : null

  if (v.isNew && (cur || builtinRow(v.slug) || openDraft)) {
    return { ok: false, error: SLUG_TAKEN, field: 'slug' }
  }
  if (!v.force) {
    const liveMoved = cur && v.base !== cur.updated_at
    const draftMoved = openDraft && v.draftBase !== undefined && !sameStamp(v.draftBase, openDraft.updated_at)
    if (liveMoved || draftMoved) {
      const who = liveMoved ? cur!.updated_by_name : openDraft!.updated_by_name
      const conflict = (await loadAdminPage(sb, v.slug).catch(() => null)) ?? undefined
      return {
        ok: false,
        error: `${who || 'Someone'} saved this page after you opened it. Load their version, or publish yours over it.`,
        conflict,
      }
    }
  }

  const s = auth.session
  const who = editorName(s)
  const row = { title: v.title, description: v.description, body_md: v.body, updated_by: s.userId, updated_by_name: who }

  const q = cur
    ? sb.from('pages').update(row).eq('slug', v.slug).select(PAGE_COLUMNS).single()
    : sb.from('pages').insert({ slug: v.slug, ...row }).select(PAGE_COLUMNS).single()
  const { data, error } = await q
  if (error) {
    if (error.code === '42501') return { ok: false, error: 'The database refused: your role can’t edit pages.' }
    if (error.code === '23505') return { ok: false, error: SLUG_TAKEN, field: 'slug' }
    return { ok: false, error: pagesDbError(error) }
  }
  updateTag(PAGES_TAG)

  // the draft this text came from is now live → close it (best effort: the page itself is already published)
  if (openDraft) {
    const { error: closeErr } = await sb
      .from('page_drafts')
      .update({ status: 'published', updated_by: s.userId, updated_by_name: who })
      .eq('slug', v.slug)
      .eq('status', 'draft')
    if (closeErr) {
      return { ok: true, data: toAdminRow(data, { title: openDraft.title, description: openDraft.description ?? '', body: openDraft.body_md, note: openDraft.note ?? '', updatedAt: openDraft.updated_at, updatedByName: openDraft.updated_by_name }) }
    }
  }
  return { ok: true, data: toAdminRow(data, null) }
}

/** SAVE DRAFT — nothing on the site changes. */
export async function saveDraft(input: unknown): Promise<PageResult<AdminPageRow>> {
  const auth = await checkPerm('pages.edit')
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = DraftSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const v = parsed.data
  const sb = await supabaseServer()
  if (!sb) return { ok: false, error: 'Demo mode — connect Supabase to save drafts.' }

  const [{ data: cur, error: readErr }, { data: dRow, error: dErr }] = await Promise.all([
    sb.from('pages').select('slug').eq('slug', v.slug).maybeSingle(),
    sb.from('page_drafts').select(DRAFT_COLUMNS).eq('slug', v.slug).maybeSingle(),
  ])
  if (readErr) return { ok: false, error: pagesDbError(readErr) }
  if (dErr) return { ok: false, error: pagesDbError(dErr) }
  const existing = dRow as DraftDbRow | null
  const open = existing?.status === 'draft' ? existing : null

  if (v.isNew && (cur || builtinRow(v.slug) || open)) return { ok: false, error: SLUG_TAKEN, field: 'slug' }
  if (open && !v.force && !sameStamp(v.base, open.updated_at)) {
    const conflict = (await loadAdminPage(sb, v.slug).catch(() => null)) ?? undefined
    return {
      ok: false,
      error: `${open.updated_by_name || 'Someone'} saved a newer draft after you opened it. Load their draft, or save yours over it.`,
      conflict,
    }
  }

  const s = auth.session
  const row = {
    title: v.title,
    description: v.description,
    body_md: v.body,
    status: 'draft',
    updated_by: s.userId,
    updated_by_name: editorName(s),
    // a seeded note ("DRAFT — typical terms…") stays on an open draft until it is published; an old closed draft
    // that is being reopened starts clean
    ...(open ? {} : { note: '' }),
  }
  const { error } = existing
    ? await sb.from('page_drafts').update(row).eq('slug', v.slug)
    : await sb.from('page_drafts').insert({ slug: v.slug, ...row })
  if (error) {
    if (error.code === '42501') return { ok: false, error: 'The database refused: your role can’t edit pages.' }
    if (error.code === '23505') return { ok: false, error: 'Someone saved a draft for this page at the same moment — reload and try again.' }
    return { ok: false, error: pagesDbError(error) }
  }
  const merged = await loadAdminPage(sb, v.slug).catch(() => null)
  if (!merged) return { ok: false, error: 'The draft was saved, but reading it back failed — reload the page.' }
  return { ok: true, data: merged }
}

const SlugOnly = z.object({ slug: z.string().regex(PAGE_SLUG_RE) })

/** DISCARD DRAFT — the live page stays exactly as it is. Reversible with restoreDraft(). */
export async function discardDraft(input: unknown): Promise<PageResult<AdminPageRow | null>> {
  const auth = await checkPerm('pages.edit')
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = SlugOnly.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Unknown page.' }
  const sb = await supabaseServer()
  if (!sb) return { ok: false, error: 'Demo mode — connect Supabase to change drafts.' }
  const { data, error } = await sb
    .from('page_drafts')
    .update({ status: 'discarded', updated_by: auth.session.userId, updated_by_name: editorName(auth.session) })
    .eq('slug', parsed.data.slug)
    .eq('status', 'draft')
    .select('slug')
  if (error) return { ok: false, error: pagesDbError(error) }
  if (!data?.length) return { ok: false, error: 'There is no open draft for this page any more. Reload to see the latest.' }
  return { ok: true, data: await loadAdminPage(sb, parsed.data.slug).catch(() => null) }
}

/** Undo for discardDraft — reopens the same draft (text and note unchanged). */
export async function restoreDraft(input: unknown): Promise<PageResult<AdminPageRow | null>> {
  const auth = await checkPerm('pages.edit')
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = SlugOnly.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Unknown page.' }
  const sb = await supabaseServer()
  if (!sb) return { ok: false, error: 'Demo mode — connect Supabase to change drafts.' }
  const { data, error } = await sb
    .from('page_drafts')
    .update({ status: 'draft' })
    .eq('slug', parsed.data.slug)
    .eq('status', 'discarded')
    .select('slug')
  if (error) return { ok: false, error: pagesDbError(error) }
  if (!data?.length) return { ok: false, error: 'That draft can’t be restored any more.' }
  return { ok: true, data: await loadAdminPage(sb, parsed.data.slug).catch(() => null) }
}

/**
 * Superadmin only (hierarchy rule; RLS enforces it too). For a built-in policy this removes the edited copy
 * and the site goes back to the built-in text; any other page disappears (404). An open draft is kept.
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
  const restored = (await loadAdminPage(sb, slug).catch(() => null)) ?? builtinRow(slug)
  return { ok: true, data: { slug, restored } }
}
