'use server'
// Admin → Vouchers → "Checkout settings" (settings key 'checkout'). Owner: CHECKOUT.
// Re-checks settings.edit server-side, validates with zod, writes on the caller's cookie-bound client (RLS:
// "settings editors insert/update"), then updateTag('settings') so /checkout shows the new fee straight away.
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { TAGS } from '@/lib/data/repo'
import { supabaseServer } from '@/lib/supabase/server'
import { checkPerm } from '@/components/admin/server'
import type { CheckoutSettings } from '@/lib/checkout/server'

const schema = z.object({
  giftWrapFee: z.number({ error: 'Enter a number (0 = free)' }).int('Whole rupees only').min(0, 'Can’t be negative').max(5000, 'Keep it under ₹5,000'),
})

export type SettingsResult = { ok: true; value: CheckoutSettings } | { ok: false; error: string; field?: string }

export async function saveCheckoutSettings(input: unknown): Promise<SettingsResult> {
  const auth = await checkPerm('settings.edit')
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    const i = parsed.error.issues[0]
    return { ok: false, error: i?.message ?? 'Check the value', field: String(i?.path[0] ?? '') }
  }
  const sb = await supabaseServer()
  if (!sb) return { ok: false, error: 'Supabase is not connected.' }
  const { error } = await sb.from('settings').upsert({ key: 'checkout', value: parsed.data }, { onConflict: 'key' })
  if (error) return { ok: false, error: `The database refused: ${error.message}` }
  updateTag(TAGS.settings)
  return { ok: true, value: parsed.data }
}
