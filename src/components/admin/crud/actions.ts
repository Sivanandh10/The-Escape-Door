'use server'
// P4b — server side of the admin CRUD pages.
// - revalidateCatalog(): cache invalidation after browser writes (RLS: has_perm()). Re-checks the caller's
//   permission server-side: catalogue tags need catalog.edit, settings needs settings.edit.
// - deleteRows(): the ONLY delete path the admin UI uses. Hierarchy rule: superadmin only (checkDelete()),
//   then the delete runs on the caller's cookie-bound client, so RLS (0003_superadmin_delete.sql) still
//   applies. Table + key column come from a fixed server-side list, never from the browser.
import { updateTag } from 'next/cache'
import { TAGS } from '@/lib/data/repo'
import { getAdminSession, supabaseServer } from '@/lib/supabase/server'
import { SUPERADMIN_DELETE_NOTE, can, type Perm } from '@/lib/admin/permissions'
import { checkDelete } from '../server'

type TagKey = keyof typeof TAGS

const TAG_PERM: Record<TagKey, Perm> = {
  collections: 'catalog.edit',
  products: 'catalog.edit',
  events: 'catalog.edit',
  partnerships: 'catalog.edit',
  insta: 'catalog.edit',
  rules: 'catalog.edit',
  settings: 'settings.edit',
}

export async function revalidateCatalog(keys: TagKey[]): Promise<{ ok: boolean }> {
  const session = await getAdminSession()
  if (!session?.isAdmin || !Array.isArray(keys)) return { ok: false }
  let ok = true
  for (const k of new Set(keys)) {
    const tag = TAGS[k]
    if (!tag) continue
    if (!can(session.perms, TAG_PERM[k])) {
      ok = false
      continue
    }
    updateTag(tag)
  }
  return { ok }
}

// ---------------------------------------------------------------- delete (superadmin only)
const DELETABLE = {
  products: { pk: 'id', tags: ['products'] },
  collections: { pk: 'slug', tags: ['collections', 'products'] },
  events: { pk: 'id', tags: ['events'] },
  partnerships: { pk: 'id', tags: ['partnerships'] },
  insta_posts: { pk: 'id', tags: ['insta'] },
  bundle_rules: { pk: 'id', tags: ['rules'] },
  custom_rules: { pk: 'type', tags: ['rules'] },
  leads: { pk: 'id', tags: [] },
  orders: { pk: 'id', tags: [] },
  // checkout (0006_checkout.sql) — vouchers aren't cached anywhere, nothing to revalidate
  vouchers: { pk: 'id', tags: [] },
  // careers (0007_careers.sql) — the caller refreshes the 'careers' cache tag itself (revalidateCareers)
  jobs: { pk: 'id', tags: [] },
  job_applications: { pk: 'id', tags: [] },
} as const satisfies Record<string, { pk: string; tags: readonly TagKey[] }>
export type DeletableTable = keyof typeof DELETABLE

export type DeleteResult = { ok: true; deleted: number } | { ok: false; error: string }

const MAX_KEYS = 200

export async function deleteRows(table: DeletableTable, keys: string[]): Promise<DeleteResult> {
  const cfg = Object.prototype.hasOwnProperty.call(DELETABLE, table) ? DELETABLE[table] : null
  if (!cfg) return { ok: false, error: 'This list can’t be deleted from the admin.' }
  const ids = Array.isArray(keys) ? [...new Set(keys.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 200))] : []
  if (!ids.length || ids.length > MAX_KEYS) return { ok: false, error: 'Nothing to delete.' }

  const auth = await checkDelete()
  if (!auth.ok) return { ok: false, error: auth.error }

  const sb = await supabaseServer()
  if (!sb) return { ok: false, error: 'Demo mode — connect Supabase to delete for real.' }

  const { data, error } = await sb.from(table).delete().in(cfg.pk, ids).select(cfg.pk)
  if (error) {
    // 23503 = foreign key (e.g. an arc that still has products: products.collection is ON DELETE RESTRICT)
    if (error.code === '23503') return { ok: false, error: 'Other items still use this (e.g. products in this arc). Move or delete those first.' }
    return { ok: false, error: `The database refused: ${error.message}` }
  }

  const deleted = Array.isArray(data) ? data.length : 0
  if (deleted < ids.length) {
    // RLS turns a refused delete into "0 rows", not an error → tell refused from already-gone.
    const { data: left } = await sb.from(table).select(cfg.pk).in(cfg.pk, ids)
    if (Array.isArray(left) && left.length > 0) {
      return { ok: false, error: `The database kept ${left.length === 1 ? 'it' : `${left.length} items`}: ${SUPERADMIN_DELETE_NOTE.toLowerCase()}.` }
    }
  }

  for (const k of cfg.tags) updateTag(TAGS[k])
  return { ok: true, deleted }
}
