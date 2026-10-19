'use server'
// Server side of the settings-stored admin lists (hoodie tiers, tee fits, apparel custom, saved QR links).
// public.settings RLS only lets `settings.edit` write, but these keys belong to other rooms (catalog.edit /
// qr.use). So the action re-checks the caller's permission for THAT key, validates with zod, then writes
// with the service role (falls back to the caller's cookie client when the service key is missing).
// Hierarchy rule: a list delete must be declared (`opts.remove`) and is superadmin only (checkDelete()).
// Stored items the caller's list silently lacks (a stale tab, a teammate's new item, a hand-crafted call)
// are merged back instead of being dropped — so nobody can delete by omission, and no update is lost.
// After a write: updateTag('settings') so /, /custom, /fests and S05/S07/S09 update immediately.
import { updateTag } from 'next/cache'
import { TAGS } from '@/lib/data/repo'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import { checkDelete, checkPerm } from '../server'
import { SETTING_KEYS, isSettingKey, type SettingKey } from './settingsSchemas'

export type SettingSaveResult = { ok: true; value: unknown } | { ok: false; error: string }

export interface SettingSaveOptions {
  /** list keys: ids the caller means to delete (superadmin only). Anything else missing is kept. */
  remove?: string[]
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

  const { error } = await sb.from('settings').upsert({ key, value: stored })
  if (error) return { ok: false, error: `The database refused: ${error.message}` }
  updateTag(TAGS.settings)
  return { ok: true, value: stored }
}
