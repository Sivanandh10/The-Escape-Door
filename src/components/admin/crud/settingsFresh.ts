// Fresh (uncached) reads of public.settings rows for the ADMIN edit forms. Server only.
// The public site reads settings through 'use cache' (repo.ts) — fine for visitors, wrong for an edit form: a stale
// cached copy would be shown to the admin and then saved back over newer values. Admin pages are already dynamic
// (requireAdmin reads the session), so reading the row directly costs nothing extra.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'

export interface FreshSetting<T> {
  value: T | null
  /** row's updated_at (ISO) — sent back on save so a newer save by a teammate isn't overwritten silently */
  updatedAt: string | null
}

export async function readSettingFresh<T>(key: string): Promise<FreshSetting<T>> {
  try {
    const sb = supabaseAdmin() ?? (await supabaseServer())
    if (!sb) return { value: null, updatedAt: null }
    const { data, error } = await sb.from('settings').select('value, updated_at').eq('key', key).maybeSingle()
    if (error || !data) return { value: null, updatedAt: null }
    const row = data as { value?: T; updated_at?: string }
    return { value: row.value ?? null, updatedAt: row.updated_at ?? null }
  } catch {
    return { value: null, updatedAt: null }
  }
}
