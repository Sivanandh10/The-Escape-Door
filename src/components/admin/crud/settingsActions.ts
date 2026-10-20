'use server'
// Server side of the settings-stored admin lists (hoodie tiers, tee fits, apparel custom, saved QR links).
// public.settings RLS only lets `settings.edit` write, but these keys belong to other rooms (catalog.edit /
// qr.use). So the action re-checks the caller's permission for THAT key, validates with zod, then writes
// with the service role (falls back to the caller's cookie client when the service key is missing).
// Hierarchy rule: a list delete must be declared (`opts.remove`) and is superadmin only (checkDelete()).
// Stored items the caller's list silently lacks (a stale tab, a teammate's new item, a hand-crafted call)
// are merged back instead of being dropped — so nobody can delete by omission, and no update is lost.
// After a write: updateTag('settings') so /, /custom, /fests and S05/S07/S09 update immediately.
import { revalidatePath, updateTag } from 'next/cache'
import { TAGS } from '@/lib/data/repo'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import { checkDelete, checkPerm } from '../server'
import { SETTING_KEYS, isSettingKey, type SettingKey } from './settingsSchemas'

export type SettingSaveResult = { ok: true; value: unknown; updatedAt: string } | { ok: false; error: string; conflict?: boolean }

export interface SettingSaveOptions {
  /** list keys: ids the caller means to delete (superadmin only). Anything else missing is kept. */
  remove?: string[]
  /** single-value keys ('site'): the row's updated_at the form was loaded with. If the row changed since (a teammate
   *  saved), the write is refused instead of silently overwriting their newer values. null = row didn't exist. */
  expectedUpdatedAt?: string | null
}

function idsOf(v: unknown): string[] {
  return Array.isArray(v)
    ? v.map((x) => (x && typeof x === 'object' ? (x as { id?: unknown }).id : null)).filter((id): id is string => typeof id === 'string')
    : []
}

export async function saveSettingValue(key: SettingKey, value: unknown, opts?: SettingSaveOptions): Promise<SettingSaveResult> {
  if (!isSettingKey(key)) return { ok: false, error: 'This setting can’t be edited from the admin.' }
  const cfg = SETTING_KEYS[key]

  const auth = await checkPerm(cfg.perm)
  if (!auth.ok) return { ok: false, error: auth.error }

  const parsed = cfg.schema.safeParse(value)
  if (!parsed.success) {
    const i = parsed.error.issues[0]
    return { ok: false, error: i ? `${i.path.length ? `${i.path.join('.')}: ` : ''}${i.message}` : 'Invalid data' }
  }

  const sb = supabaseAdmin() ?? (await supabaseServer())
  if (!sb) return { ok: false, error: 'Demo mode — connect Supabase to save changes.' }

  if (!cfg.list && opts && 'expectedUpdatedAt' in opts) {
    const { data, error } = await sb.from('settings').select('updated_at').eq('key', key).maybeSingle()
    if (error) return { ok: false, error: `Could not read the current settings: ${error.message}` }
    const cur = (data as { updated_at?: string } | null)?.updated_at ?? null
    const exp = opts.expectedUpdatedAt ?? null
    if (cur !== exp && !(cur && exp && Date.parse(cur) === Date.parse(exp))) {
      return { ok: false, conflict: true, error: 'Someone saved these settings after you opened this page. Reload to see their version, then make your change again.' }
    }
  }

  let stored: unknown = parsed.data
  if (cfg.list) {
    const { data, error } = await sb.from('settings').select('value').eq('key', key).maybeSingle()
    if (error) return { ok: false, error: `Could not read the current list: ${error.message}` }
    // nothing stored yet → the site shows the built-in defaults, so those count as "existing"
    const cur = (data as { value?: unknown } | null)?.value
    const before: unknown[] = Array.isArray(cur) && cur.length ? cur : Array.isArray(cfg.fallback) ? cfg.fallback : []
    const next = parsed.data as Array<{ id: string }>
    const nextIds = new Set(next.map((x) => x.id))
    const remove = new Set(Array.isArray(opts?.remove) ? opts.remove.filter((id): id is string => typeof id === 'string') : [])
    const removing = idsOf(before).filter((id) => remove.has(id) && !nextIds.has(id))
    if (removing.length) {
      const del = await checkDelete()
      if (!del.ok) return { ok: false, error: del.error }
    }
    // keep every stored item the caller didn't explicitly remove (stale list / omission ≠ delete)
    const kept = before.filter((x) => {
      const id = x && typeof x === 'object' ? (x as { id?: unknown }).id : null
      return typeof id === 'string' && !nextIds.has(id) && !remove.has(id)
    })
    if (kept.length) {
      const merged = cfg.schema.safeParse([...next, ...kept])
      if (!merged.success) return { ok: false, error: 'The list changed elsewhere and can’t be merged — reload and try again.' }
      stored = merged.data
    }
  }

  const updatedAt = new Date().toISOString()
  const { error } = await sb.from('settings').upsert({ key, value: stored, updated_at: updatedAt })
  if (error) return { ok: false, error: `The database refused: ${error.message}` }
  updateTag(TAGS.settings)
  // 'site' feeds the root layout (banner, WhatsApp number) and the static home hero: also expire every
  // prerendered route by path, so the CDN copy is regenerated even if a host drops the custom tag purge.
  if (key === 'site') revalidatePath('/', 'layout')
  return { ok: true, value: stored, updatedAt }
}
